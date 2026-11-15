import React, { useEffect } from 'react';
import { Mark, Icon } from './ui.jsx';
import { fmtNum, rateDigits, hoursLabel } from '../lib/pricing.js';

export default function CompareTray({ rows, s, open, onClose, onRemove, onClear }) {
  useEffect(() => {
    if (!open) return undefined;
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);

  if (!open || rows.length < 2) return null;

  const verb = s.mode === 'sell' ? 'Recipient gets' : 'You pay';
  const better = s.mode === 'sell' ? Math.max : Math.min;
  const bestTotal = better(...rows.map((r) => r.total));
  const bestRating = Math.max(...rows.map((r) => r.provider.rating ?? 0));
  const cell = 'px-3.5 py-2.5 align-top border-b border-steel-100';
  const rate = (r) => (s.mode === 'sell' ? r.q.sellRate : r.q.buyRate);
  const lines = [
    ['Estimated Rate', (r) => <span className="font-mono tabular-nums">{rate(r).toFixed(rateDigits(rate(r)))}</span>],
    [verb, (r) => <strong className={`font-mono tabular-nums ${r.total === bestTotal ? 'text-go' : 'text-ink'}`}>{fmtNum(r.total)} {s.to}{r.total === bestTotal ? ' ✓' : ''}</strong>],
    ['Transfer Fee', (r) => (s.channel === 'bank' ? `${fmtNum(r.q.feeBase)} ${s.from}` : '0.00 (Cash)')],
    ['Spread vs Mid', (r) => <span className="font-mono tabular-nums">{r.q.marginPct.toFixed(2)}%</span>],
    ...(rows.some((r) => r.provider.rating != null) ? [
      ['Google Rating', (r) => r.provider.rating == null ? <span className="text-steel-500">Not loaded</span> : <span className={r.provider.rating === bestRating ? 'font-semibold text-go' : ''}>{r.provider.rating.toFixed(1)} ★ · {r.provider.reviewCount.toLocaleString('en-AE')}</span>],
    ] : []),
    ['Matching Branches', (r) => `${r.branches.length} in view`],
    ['Nearest Branch', (r) => `${r.branch.area}, ${r.branch.emirate}`],
    ['Hours', (r) => hoursLabel(r.branch)],
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Side-by-side comparison matrix"
      onClick={onClose}
    >
      <div className="panel w-full max-w-5xl p-4 sm:p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="label text-sky">Side-by-Side Matrix</div>
            <h2 className="font-display text-2xl font-bold uppercase tracking-wide text-ink">
              Comparing {rows.length} Providers · {fmtNum(s.amount, 0)} {s.from} → {s.to}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" className="btn btn-sm" onClick={() => { onClear(); onClose(); }}>
              Clear All
            </button>
            <button type="button" className="btn btn-primary btn-sm" onClick={onClose}>
              <Icon.close width="14" height="14" /> Close Matrix
            </button>
          </div>
        </div>

        <div className="max-h-[65vh] overflow-auto rounded-lg border border-steel-200">
          <table className="w-full min-w-[600px] border-collapse text-left text-xs sm:text-sm">
            <thead className="bg-steel-50">
              <tr>
                <th className={`${cell} sticky left-0 bg-steel-50 font-bold text-steel-500 uppercase text-[11px]`}>Metric</th>
                {rows.map((r) => (
                  <th key={r.provider.id} className={`${cell} min-w-[170px]`}>
                    <div className="flex items-center gap-2">
                      <Mark provider={r.provider} size={30} />
                      <span className="font-display text-base font-bold leading-tight tracking-wide text-ink">{r.provider.name}</span>
                      <button
                        type="button"
                        aria-label={`Remove ${r.provider.name}`}
                        className="ml-auto text-steel-400 hover:text-ink"
                        onClick={() => onRemove(r.provider.id)}
                      >
                        <Icon.close width="14" height="14" />
                      </button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white">
              {lines.map(([label, fn]) => (
                <tr key={label} className="hover:bg-steel-50/50">
                  <th scope="row" className={`${cell} label sticky left-0 bg-white`}>{label}</th>
                  {rows.map((r) => <td key={r.provider.id} className={cell}>{fn(r)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
