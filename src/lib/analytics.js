// Pure dashboard analytics, spread transparency metrics, trend curve synthesis, and multi-transfer math.
// Decoupled from React components so all calculations are unit-tested deterministically.
import { rateDigits } from './pricing.js';

/**
 * Computes institutional KPI metrics and spread tier benchmarks from currently filtered rows.
 */
export function computeDashboardMetrics(rows, s, allProviders = []) {
  const totalBranches = allProviders.reduce((acc, p) => acc + p.branches.length, 0);
  const emirateCounts = {};
  for (const p of allProviders) {
    for (const b of p.branches) {
      emirateCounts[b.emirate] = (emirateCounts[b.emirate] || 0) + 1;
    }
  }
  const emirateBreakdown = Object.entries(emirateCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([emirate, count]) => ({
      emirate,
      count,
      pct: totalBranches > 0 ? +((count / totalBranches) * 100).toFixed(1) : 0,
    }));

  if (!rows.length) {
    return {
      bestRow: null,
      worstRow: null,
      avgBankTotal: null,
      avgBankSavings: 0,
      bestSpreadPct: 0,
      avgBankFee: 0,
      maxBankMarkupPct: 0,
      totalBranches,
      emirateBreakdown,
      spreadTiers: [],
    };
  }

  const isSell = s.mode === 'sell';
  const bestRow = rows.reduce((a, b) => ((isSell ? b.total > a.total : b.total < a.total) ? b : a));
  const worstRow = rows.reduce((a, b) => ((isSell ? b.total < a.total : b.total > a.total) ? b : a));

  const banks = rows.filter((r) => r.provider.type === 'bank');
  const exchanges = rows.filter((r) => r.provider.type === 'exchange');
  const profiledExchanges = exchanges.filter((r) => r.provider.spreadBasis === 'profile');
  const categoryExchanges = exchanges.filter((r) => r.provider.spreadBasis !== 'profile');

  const avgBankTotal = banks.length
    ? banks.reduce((acc, r) => acc + r.total, 0) / banks.length
    : worstRow.total;

  const avgBankSavings = isSell
    ? Math.max(0, bestRow.total - avgBankTotal)
    : Math.max(0, avgBankTotal - bestRow.total);

  const avgBankFee = banks.length
    ? banks.reduce((acc, r) => acc + (r.provider.fee?.bank ?? 0), 0) / banks.length
    : rows.reduce((acc, r) => acc + (r.provider.fee?.bank ?? 0), 0) / rows.length;

  const avgExchangeFee = exchanges.length
    ? exchanges.reduce((acc, r) => acc + (r.provider.fee?.bank ?? 0), 0) / exchanges.length
    : 0;

  const maxBankMarkupPct = banks.length
    ? Math.max(...banks.map((r) => r.q.marginPct))
    : Math.max(...rows.map((r) => r.q.marginPct));

  const minMax = (list) => {
    if (!list.length) return null;
    const vals = list.map((r) => r.q.marginPct);
    return { min: Math.min(...vals), max: Math.max(...vals) };
  };

  const topEx = minMax(profiledExchanges.length ? profiledExchanges : exchanges);
  const stdEx = minMax(categoryExchanges.length ? categoryExchanges : exchanges);
  const bankRange = minMax(banks);

  const spreadTiers = [
    { id: 'interbank', label: 'Interbank Mid-Market', min: 0, max: 0, tone: 'emerald', note: '0.00% Baseline' },
    ...(topEx ? [{ id: 'profile', label: 'Profiled Exchange Houses', min: topEx.min, max: topEx.max, tone: 'blue' }] : []),
    ...(stdEx ? [{ id: 'category', label: 'Standard Physical Kiosks', min: stdEx.min, max: stdEx.max, tone: 'amber' }] : []),
    ...(bankRange ? [{ id: 'bank', label: 'UAE Retail Banks', min: bankRange.min, max: bankRange.max, tone: 'red' }] : []),
  ];

  return {
    bestRow,
    worstRow,
    avgBankTotal,
    avgBankSavings,
    bestSpreadPct: bestRow.q.marginPct,
    avgBankFee,
    avgExchangeFee,
    maxBankMarkupPct,
    totalBranches,
    emirateBreakdown,
    spreadTiers,
  };
}

/**
 * Generates a deterministic reference curve anchored to the live mid-market rate
 * for the selected pair and timeframe ('24H' | '7D' | '1M').
 */
export function buildTrendSeries(midRate, from, to, range = '24H') {
  if (!Number.isFinite(midRate) || midRate <= 0) {
    return { points: [], min: 0, max: 0, deltaPct: 0, labels: [] };
  }
  const count = range === '24H' ? 12 : range === '7D' ? 14 : 16;
  const amp = range === '24H' ? 0.0032 : range === '7D' ? 0.0075 : 0.014;
  let hash = 0;
  for (const ch of `${from}${to}${range}`) hash = (hash * 31 + ch.charCodeAt(0)) % 997;

  const points = [];
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    const wave = Math.sin((t * 2.6 + (hash % 7) * 0.4) * Math.PI) * 0.55 + Math.cos((t * 4.3 + (hash % 5) * 0.3) * Math.PI) * 0.25;
    // Anchor final point directly on the live midRate
    const offset = (1 - t) * (wave * amp - amp * 0.35);
    points.push(midRate * (1 + offset));
  }
  points[points.length - 1] = midRate;

  const min = Math.min(...points);
  const max = Math.max(...points);
  const first = points[0];
  const deltaPct = first > 0 ? ((midRate - first) / first) * 100 : 0;
  const digits = rateDigits(midRate);

  const labels = range === '24H'
    ? ['00:00 GST', '08:00 GST', '16:00 GST', 'Live Now']
    : range === '7D'
      ? ['6d ago', '4d ago', '2d ago', 'Today']
      : ['30d ago', '20d ago', '10d ago', 'Today'];

  return { points, min, max, deltaPct, digits, labels };
}

/**
 * Compares splitting a total remittance into `count` smaller transfers vs 1 consolidated transfer.
 */
export function computeMultiTransferComparison(row, amount, count, channel, mode) {
  if (!row || amount <= 0 || count < 1) {
    return { singleTotal: 0, splitTotal: 0, totalFeesSingle: 0, totalFeesSplit: 0, difference: 0 };
  }
  const perTranche = amount / count;
  const rate = mode === 'sell' ? row.q.sellRate : row.q.buyRate;
  const feePerTransfer = channel === 'bank' ? row.q.feeBase : 0;

  if (mode === 'sell') {
    const singleTotal = Math.max(0, amount - feePerTransfer) * rate;
    const splitTotal = Math.max(0, perTranche - feePerTransfer) * rate * count;
    return {
      singleTotal,
      splitTotal,
      totalFeesSingle: feePerTransfer,
      totalFeesSplit: feePerTransfer * count,
      difference: singleTotal - splitTotal,
    };
  }
  const singleTotal = (amount + feePerTransfer) * rate;
  const splitTotal = (perTranche + feePerTransfer) * rate * count;
  return {
    singleTotal,
    splitTotal,
    totalFeesSingle: feePerTransfer,
    totalFeesSplit: feePerTransfer * count,
    difference: splitTotal - singleTotal,
  };
}
