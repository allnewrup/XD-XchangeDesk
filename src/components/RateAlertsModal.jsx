import React, { useEffect, useRef, useState } from 'react';
import { rateDigits } from '../lib/pricing.js';
import { Icon } from './ui.jsx';

export default function RateAlertsModal({
  open,
  onClose,
  s,
  mid,
  bestRow,
  alerts,
  onAddAlert,
  onRemoveAlert,
}) {
  const pairMid = (mid[s.to] && mid[s.from]) ? mid[s.to] / mid[s.from] : 1;
  const bestRate = bestRow ? (s.mode === 'sell' ? bestRow.q.sellRate : bestRow.q.buyRate) : pairMid;
  const digits = rateDigits(bestRate);
  const [targetText, setTargetText] = useState(() => (bestRate * 1.005).toFixed(digits));
  const [note, setNote] = useState('');

  const bestRateRef = useRef(bestRate);
  bestRateRef.current = bestRate;

  useEffect(() => {
    if (!open) return;
    setTargetText((bestRateRef.current * 1.005).toFixed(digits));
  }, [open, s.from, s.to, digits]);

  useEffect(() => {
    if (!open) return undefined;
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);

  if (!open) return null;

  const submit = (e) => {
    e.preventDefault();
    const target = parseFloat(targetText);
    if (!Number.isFinite(target) || target <= 0) return;
    onAddAlert({
      id: `${Date.now()}`,
      from: s.from,
      to: s.to,
      target,
      digits,
      note: note.trim(),
      createdAt: new Date().toISOString(),
    });
    setNote('');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Corridor rate alerts"
      onClick={onClose}
    >
      <div className="panel w-full max-w-lg p-5 sm:p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="label text-sky">Corridor Monitor</div>
            <h2 className="mt-0.5 font-display text-2xl font-bold uppercase tracking-wide text-ink">
              Rate Alerts ({s.from} → {s.to})
            </h2>
            <p className="mt-1 text-xs text-steel-600">
              Track target rates in this browser. Whenever live consensus or best estimated provider rates cross your target while open, they highlight below.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close rate alerts" className="btn btn-sm !px-2">
            <Icon.close width="15" height="15" />
          </button>
        </div>

        <form onSubmit={submit} className="mt-4 rounded-xl border border-steel-200 bg-steel-50 p-3.5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-semibold text-ink">Current Best Est. Rate:</span>
            <span className="font-mono font-bold text-sky tabular-nums">
              1 {s.from} = {bestRate.toFixed(digits)} {s.to}
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="label">Target Rate ({s.to} per 1 {s.from})</span>
              <input
                type="number"
                step="any"
                min="0"
                required
                value={targetText}
                onChange={(e) => setTargetText(e.target.value)}
                className="field mt-1 bg-white font-mono text-sm"
              />
            </label>
            <label className="block">
              <span className="label">Label (optional)</span>
              <input
                type="text"
                maxLength={50}
                placeholder="e.g. Monthly home transfer"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="field mt-1 bg-white text-sm"
              />
            </label>
          </div>

          <button type="submit" className="btn btn-primary w-full text-xs font-bold uppercase tracking-wider">
            Save {s.from}/{s.to} Rate Alert
          </button>
        </form>

        <div className="mt-4">
          <div className="label mb-2">Active Alerts ({alerts.length})</div>
          {alerts.length === 0 ? (
            <p className="rounded-lg border border-dashed border-steel-200 p-4 text-center text-xs text-steel-500">
              No corridor alerts saved yet. Add one above to monitor target exchange thresholds.
            </p>
          ) : (
            <ul className="max-h-56 space-y-2 overflow-y-auto">
              {alerts.map((al) => {
                const curMid = (mid[al.to] && mid[al.from]) ? mid[al.to] / mid[al.from] : null;
                const triggered = curMid != null && curMid >= al.target;
                return (
                  <li key={al.id} className="flex items-center justify-between gap-3 rounded-lg border border-steel-200 bg-white px-3 py-2 text-xs">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <strong className="font-mono text-ink">{al.from} → {al.to}</strong>
                        <span className="font-mono font-semibold text-sky tabular-nums">≥ {al.target.toFixed(al.digits || 4)}</span>
                        {triggered && (
                          <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold uppercase text-go border border-emerald-200">
                            Target Reached
                          </span>
                        )}
                      </div>
                      {al.note && <p className="truncate text-steel-500">{al.note}</p>}
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemoveAlert(al.id)}
                      aria-label={`Delete alert ${al.from} to ${al.to}`}
                      className="text-xs font-semibold text-red-600 hover:underline shrink-0"
                    >
                      Remove
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
