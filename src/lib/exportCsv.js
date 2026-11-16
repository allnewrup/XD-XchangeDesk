// Pure client-side CSV builder and browser download helper for side-by-side comparison exports.
import { rateDigits, hoursLabel } from './pricing.js';

function csvCell(val) {
  const str = String(val ?? '');
  return /[",\n\r]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

export function buildComparisonCsv(rows, s) {
  if (!Array.isArray(rows) || !rows.length) return '';
  const headers = [
    'Provider',
    'Type',
    'From',
    'To',
    'Amount',
    'Mode',
    'Channel',
    'Rate',
    'Fee',
    s.mode === 'sell' ? 'RecipientGets' : 'YouPay',
    'SpreadPct',
    'NearestBranch',
    'Hours',
  ];

  const lines = [headers.join(',')];
  for (const r of rows) {
    const activeRate = s.mode === 'sell' ? r.q.sellRate : r.q.buyRate;
    const digits = rateDigits(activeRate);
    const branchLabel = r.branch.area === r.branch.emirate
      ? r.branch.emirate
      : `${r.branch.area}, ${r.branch.emirate}`;

    lines.push([
      r.provider.name,
      r.provider.type === 'bank' ? 'UAE Retail Bank' : 'Exchange House',
      s.from,
      s.to,
      s.amount,
      s.mode,
      s.channel,
      activeRate.toFixed(digits),
      s.channel === 'bank' ? r.q.feeBase.toFixed(2) : '0.00',
      r.total.toFixed(2),
      r.q.marginPct.toFixed(2),
      branchLabel,
      hoursLabel(r.branch),
    ].map(csvCell).join(','));
  }
  return lines.join('\n');
}

export function downloadComparisonCsv(rows, s) {
  const csv = buildComparisonCsv(rows, s);
  if (!csv || typeof document === 'undefined') return false;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `xchange-desk-${s.from}-${s.to}.csv`.toLowerCase();
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}
