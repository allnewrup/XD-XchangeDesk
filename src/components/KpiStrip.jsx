import React from 'react';
import { rateDigits } from '../lib/pricing.js';

function liveFreshnessLabel(updatedAt, nowMs, pairDaily, live) {
  if (!live || !updatedAt) return 'Syncing…';
  if (pairDaily) return 'Daily Consensus';
  const sec = Math.max(0, Math.round((nowMs - updatedAt.getTime()) / 1000));
  if (sec < 60) return `Synced ${sec}s ago`;
  return `Synced ${Math.round(sec / 60)}m ago`;
}

export default function KpiStrip({ s, mid, prevMid, metrics, pairDaily, updatedAt, live, liveSeries24h, nowMs }) {
  const pairMid = (mid[s.to] && mid[s.from]) ? mid[s.to] / mid[s.from] : 1;
  const digits = rateDigits(pairMid);
  // Only real history is drawn; with none, the sparkline and the change figure are simply left out.
  const series = liveSeries24h ?? { points: [], min: 0, max: 0, deltaPct: 0 };

  const prevPairMid = (prevMid?.[s.to] && prevMid?.[s.from]) ? prevMid[s.to] / prevMid[s.from] : null;
  const deltaPct = prevPairMid ? ((pairMid - prevPairMid) / prevPairMid) * 100 : liveSeries24h ? series.deltaPct : null;

  // Build SVG polyline points
  const w = 220;
  const h = 34;
  const min = series.min;
  const max = series.max;
  const span = max - min || 1e-6;
  const svgPts = series.points
    .map((v, i) => {
      const x = (i / Math.max(1, series.points.length - 1)) * w;
      const y = h - 4 - ((v - min) / span) * (h - 8);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  const bestPct = metrics.bestSpreadPct;
  const maxBankPct = metrics.maxBankMarkupPct;
  const efficiencyBarWidth = maxBankPct > 0 ? Math.max(8, Math.min(100, (bestPct / maxBankPct) * 100)) : 20;

  return (
    <section aria-label="Corridor KPI analytics" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {/* 1. Interbank Reference */}
      <div className="panel flex flex-col justify-between p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="label">Interbank Reference</div>
            <div className="mt-0.5 text-xs font-bold uppercase tracking-wide text-ink">
              {s.from} / {s.to} Mid-Market
            </div>
          </div>
          {deltaPct != null && <span className={`rounded px-2 py-0.5 font-mono text-[11px] font-bold border tabular-nums ${
            deltaPct >= 0
              ? 'bg-emerald-50 text-go border-emerald-200'
              : 'bg-red-50 text-red-600 border-red-200'
          }`}>
            {deltaPct >= 0 ? '+' : ''}{deltaPct.toFixed(2)}%
          </span>}
        </div>

        <div className="mt-2 flex items-baseline gap-2">
          <span className="font-mono text-2xl font-bold text-ink tabular-nums">
            {pairMid.toFixed(digits)}
          </span>
          <span className="text-xs font-medium text-steel-500">
            {s.to} / {s.from}
          </span>
        </div>

        <div className="mt-2">
          <svg viewBox={`0 0 ${w} ${h}`} className="h-8 w-full overflow-visible" aria-hidden="true">
            <polyline fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" points={svgPts} />
          </svg>
          <div className="mt-1 flex items-center justify-between text-[11px] font-mono text-steel-500 tabular-nums">
            <span>{liveSeries24h ? `Low: ${min.toFixed(digits)}` : ''}</span>
            <span className="text-go font-semibold">{liveFreshnessLabel(updatedAt, nowMs, pairDaily, live)}</span>
            <span>{liveSeries24h ? `High: ${max.toFixed(digits)}` : ''}</span>
          </div>
        </div>
      </div>

      {/* 2. Corridor Efficiency */}
      <div className="panel flex flex-col justify-between p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="label">Corridor Efficiency</div>
            <div className="mt-0.5 text-xs font-bold uppercase tracking-wide text-ink">
              Best Available Margin
            </div>
          </div>
          <span className="text-amber-600" aria-hidden="true">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" /></svg>
          </span>
        </div>

        <div className="mt-2 flex items-baseline gap-2">
          <span className="font-mono text-2xl font-bold text-sky tabular-nums">
            {bestPct.toFixed(2)}%
          </span>
          <span className="truncate text-xs font-semibold text-go">
            {metrics.bestRow ? metrics.bestRow.provider.name : '—'}
          </span>
        </div>

        <div className="mt-3">
          <div className="h-2 w-full overflow-hidden rounded-full bg-steel-100">
            <div className="h-full rounded-full bg-sky transition-all duration-300" style={{ width: `${efficiencyBarWidth}%` }} />
          </div>
          <p className="mt-2 text-[11px] leading-snug text-steel-500">
            Retail banks in view charge up to <strong className="font-semibold text-red-600">{maxBankPct.toFixed(2)}% markup</strong> on currency conversions.
          </p>
        </div>
      </div>

      {/* 3. Transfer Fee Benchmark */}
      <div className="panel flex flex-col justify-between p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="label">Fee Benchmark</div>
            <div className="mt-0.5 text-xs font-bold uppercase tracking-wide text-ink">
              Avg Bank Transfer Fee
            </div>
          </div>
          <span className="rounded bg-steel-100 px-2 py-0.5 font-mono text-[11px] font-bold text-steel-600 border border-steel-200">
            {s.channel === 'cash' ? 'Cash: 0 AED' : 'Bank Mode'}
          </span>
        </div>

        <div className="mt-2 flex items-baseline gap-2">
          <span className="font-mono text-2xl font-bold text-ink tabular-nums">
            {metrics.avgBankFee.toFixed(2)}
          </span>
          <span className="text-xs font-medium text-steel-500">AED fixed (banks)</span>
        </div>

        <div className="mt-3 space-y-1 text-[11px] text-steel-500">
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-go shrink-0" aria-hidden="true" />
            <span>Cash counter exchange carries <strong className="text-ink">0.00 AED</strong> flat fee.</span>
          </div>
          <p>Exchange bank-transfer fees average <strong className="text-ink">{(metrics.avgExchangeFee || 0).toFixed(2)} AED</strong>.</p>
        </div>
      </div>

      {/* 4. Directory Coverage */}
      <div className="panel flex flex-col justify-between p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="label">Directory Index</div>
            <div className="mt-0.5 text-xs font-bold uppercase tracking-wide text-ink">
              UAE Branch Footprint
            </div>
          </div>
          <span className="text-sky" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 17l6-6 4 4 8-8" />
              <path d="M17 7h4v4" />
            </svg>
          </span>
        </div>

        <div className="mt-2 flex items-baseline gap-2">
          <span className="font-mono text-2xl font-bold text-ink tabular-nums">
            {metrics.totalBranches.toLocaleString('en')}
          </span>
          <span className="text-xs font-medium text-steel-500">OSM branches</span>
        </div>

        <div className="mt-2 grid grid-cols-2 gap-1.5">
          {metrics.emirateBreakdown.map((item) => (
            <div key={item.emirate} className="well flex items-center justify-between px-2 py-1 text-[11px]">
              <span className="font-semibold text-steel-600 truncate">{item.emirate}</span>
              <span className="font-mono font-bold text-ink tabular-nums">{item.pct}%</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
