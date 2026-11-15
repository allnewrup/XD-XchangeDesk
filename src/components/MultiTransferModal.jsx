import React, { useEffect, useState } from 'react';
import { computeMultiTransferComparison } from '../lib/analytics.js';
import { fmtNum } from '../lib/pricing.js';
import { Icon } from './ui.jsx';

export default function MultiTransferModal({ open, onClose, rows, s }) {
  const [selectedId, setSelectedId] = useState('');
  const [transfers, setTransfers] = useState(4);
  const [calcChannel, setCalcChannel] = useState('bank');

  useEffect(() => {
    if (rows.length && !rows.some((r) => r.provider.id === selectedId)) {
      setSelectedId(rows[0].provider.id);
    }
  }, [rows, selectedId]);

  useEffect(() => {
    if (!open) return undefined;
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);

  if (!open) return null;

  const activeRow = rows.find((r) => r.provider.id === selectedId) ?? rows[0] ?? null;
  const res = computeMultiTransferComparison(activeRow, s.amount, transfers, calcChannel, s.mode);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Multi-transfer calculator"
      onClick={onClose}
    >
      <div className="panel w-full max-w-xl p-5 sm:p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="label text-sky">Fee Optimization</div>
            <h2 className="mt-0.5 font-display text-2xl font-bold uppercase tracking-wide text-ink">
              Multi-Transfer Calculator
            </h2>
            <p className="mt-1 text-xs text-steel-600">
              See how splitting {fmtNum(s.amount, 0)} {s.from} into multiple transfers affects flat bank transfer fees vs sending one consolidated remittance.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close multi-transfer calculator" className="btn btn-sm !px-2">
            <Icon.close width="15" height="15" />
          </button>
        </div>

        {!activeRow ? (
          <p className="mt-4 rounded-lg border border-steel-200 bg-steel-50 p-4 text-sm text-steel-600">
            No providers match your current filters. Adjust filters to run multi-transfer math.
          </p>
        ) : (
          <div className="mt-4 space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="block sm:col-span-2">
                <span className="label">Provider</span>
                <select
                  value={activeRow.provider.id}
                  onChange={(e) => setSelectedId(e.target.value)}
                  className="field mt-1 text-xs font-semibold"
                >
                  {rows.slice(0, 20).map((r) => (
                    <option key={r.provider.id} value={r.provider.id}>
                      {r.provider.name} ({r.provider.type === 'bank' ? 'Bank' : 'Exchange'})
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="label">Number of Transfers</span>
                <select
                  value={transfers}
                  onChange={(e) => setTransfers(Number(e.target.value))}
                  className="field mt-1 text-xs font-mono font-bold"
                >
                  {[2, 3, 4, 6, 8, 12].map((n) => (
                    <option key={n} value={n}>{n}x transfers</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="flex items-center gap-2">
              <span className="label">Channel:</span>
              <button
                type="button"
                onClick={() => setCalcChannel('bank')}
                aria-pressed={calcChannel === 'bank'}
                className="key"
              >
                Bank Transfer (Flat Fee Applies)
              </button>
              <button
                type="button"
                onClick={() => setCalcChannel('cash')}
                aria-pressed={calcChannel === 'cash'}
                className="key"
              >
                Cash Counter (0 Fee)
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
                <div className="label text-go">1 Consolidated Transfer</div>
                <div className="mt-1 font-mono text-xl font-bold text-ink tabular-nums">
                  {fmtNum(res.singleTotal, 2)} {s.to}
                </div>
                <div className="mt-1 text-xs text-steel-600 font-mono">
                  Total fee: {calcChannel === 'bank' ? `${fmtNum(res.totalFeesSingle, 2)} ${s.from}` : `0.00 ${s.from}`}
                </div>
              </div>

              <div className="rounded-xl border border-steel-200 bg-steel-50 p-4">
                <div className="label">{transfers} Split Transfers ({fmtNum(s.amount / transfers, 0)} {s.from} each)</div>
                <div className="mt-1 font-mono text-xl font-bold text-ink tabular-nums">
                  {fmtNum(res.splitTotal, 2)} {s.to}
                </div>
                <div className="mt-1 text-xs text-steel-600 font-mono">
                  Total fees: {calcChannel === 'bank' ? `${fmtNum(res.totalFeesSplit, 2)} ${s.from}` : `0.00 ${s.from}`}
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-steel-200 bg-white px-4 py-3 text-xs text-steel-600">
              {res.difference > 0.01 ? (
                <span>
                  Consolidating into a single transfer saves <strong className="font-mono text-go">{fmtNum(res.difference, 2)} {s.to}</strong> in cumulative flat transfer fees.
                </span>
              ) : (
                <span>
                  Cash counter transfers carry no flat fee here, so splitting into {transfers} transfers yields the same total as 1 transfer.
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
