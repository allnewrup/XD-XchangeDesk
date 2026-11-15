import React, { useEffect, useState } from 'react';
import { rateDigits } from '../lib/pricing.js';

const TICKER_CODES = ['USD', 'EUR', 'GBP', 'INR', 'PKR', 'PHP'];

function uaeClock() {
  return new Date().toLocaleTimeString('en-GB', {
    timeZone: 'Asia/Dubai',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

export default function TopTicker({ mid, prevMid, live, syncing, flashMap = {}, onSelectPair }) {
  const [clock, setClock] = useState(uaeClock);

  useEffect(() => {
    const id = setInterval(() => setClock(uaeClock()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="bg-terminal text-slate-200 border-b border-slate-800">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-1.5 text-[11px] font-mono sm:px-6">
        <div className="flex items-center gap-2 shrink-0">
          <span className="relative flex h-2 w-2" aria-hidden="true">
            {live && (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            )}
            <span className={`relative inline-flex h-2 w-2 rounded-full ${live ? 'bg-emerald-400' : 'bg-amber-400'}`} />
          </span>
          <span className="font-semibold tracking-wider text-white uppercase">
            {live
              ? 'Dubai FX Markets · Live 5s Stream'
              : syncing
                ? 'Connecting Live FX Feeds…'
                : 'Reconnecting Live Feeds'}
          </span>
        </div>

        <div className="hidden lg:flex items-center gap-3 overflow-x-auto" aria-label="Live AED mid-market ticker">
          {TICKER_CODES.filter((c) => mid[c] && mid.AED).map((code) => {
            const val = mid[code] / mid.AED;
            const digits = rateDigits(val);
            const prevVal = prevMid?.[code] && prevMid?.AED ? prevMid[code] / prevMid.AED : null;
            const pct = prevVal ? ((val - prevVal) / prevVal) * 100 : null;
            const tick = flashMap[code];
            const flashCls = tick === 'up'
              ? 'bg-emerald-500/20 text-emerald-200'
              : tick === 'down'
                ? 'bg-red-500/20 text-red-200'
                : 'text-slate-300 hover:bg-white/10 hover:text-white';

            return (
              <button
                key={code}
                type="button"
                onClick={() => onSelectPair('AED', code)}
                className={`flex items-center gap-1.5 rounded px-1.5 py-0.5 transition-colors whitespace-nowrap ${flashCls}`}
                title={`Switch comparison to AED → ${code}`}
              >
                <span className="text-slate-400">AED/{code}</span>
                <span className="font-semibold text-white tabular-nums">{val.toFixed(digits)}</span>
                {pct != null && Math.abs(pct) >= 0.005 && (
                  <span className={`text-[10px] font-bold tabular-nums ${pct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {pct >= 0 ? '+' : ''}{pct.toFixed(2)}%
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 text-slate-400 shrink-0 tabular-nums">
          <span className="hidden sm:inline">{live ? 'LIVE FEED' : 'SYNCING'}</span>
          <span aria-hidden="true" className="hidden sm:inline">·</span>
          <span className="text-slate-200 font-medium">GMT+4 {clock}</span>
        </div>
      </div>
    </div>
  );
}
