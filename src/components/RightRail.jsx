import React, { Suspense } from 'react';
import { Link } from '../lib/router.jsx';
import ReviewsDrawer from './ReviewsDrawer.jsx';

export default function RightRail({
  s,
  data,
  metrics,
  panel,
  setPanel,
  MapBoundary,
  MapPanel,
  pins,
  sel,
  selected,
  onMap,
  bestId,
  userLoc,
  nearest,
  reviewPid,
  panelRef,
  trendsRef,
  trendRange,
  onTrendRangeChange,
  liveTrendSeries,
}) {
  const pairMid = (data.mid[s.to] && data.mid[s.from]) ? data.mid[s.to] / data.mid[s.from] : 1;
  // Only real history is ever drawn. If the feed has nothing for this pair, say so instead of inventing a curve.
  const series = liveTrendSeries ?? { points: [], min: 0, max: 0, deltaPct: 0, labels: [], digits: 4 };

  // Trend SVG geometry
  const w = 320;
  const h = 118;
  const padX = 6;
  const padY = 12;
  const span = series.max - series.min || 1e-6;
  const coords = series.points.map((v, i) => {
    const x = padX + (i / Math.max(1, series.points.length - 1)) * (w - padX * 2);
    const y = h - padY - ((v - series.min) / span) * (h - padY * 2);
    return { x, y };
  });
  const linePath = coords.map((pt, i) => `${i === 0 ? 'M' : 'L'}${pt.x.toFixed(1)},${pt.y.toFixed(1)}`).join(' ');
  const areaPath = coords.length
    ? `${linePath} L${coords[coords.length - 1].x.toFixed(1)},${h} L${coords[0].x.toFixed(1)},${h} Z`
    : '';
  const lastPt = coords[coords.length - 1];

  const maxTierVal = Math.max(3.5, ...metrics.spreadTiers.map((t) => t.max));
  const barColors = {
    emerald: 'bg-go',
    blue: 'bg-sky',
    amber: 'bg-amber-500',
    red: 'bg-red-600',
  };

  return (
    <aside className="flex min-w-0 flex-col gap-4" aria-label="Analytics, map and market feed">
      {/* 1. Historical Dynamics Trendline */}
      <section ref={trendsRef} className="panel p-4 scroll-mt-20" aria-label="Historical dynamics trendline">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="label">Reference Curve</div>
            <h2 className="mt-0.5 font-display text-lg font-bold uppercase tracking-wide text-ink">
              {s.from}/{s.to} Trendline
            </h2>
          </div>
          <div className="inline-flex rounded-lg border border-steel-200 bg-steel-50 p-0.5" role="group" aria-label="Trendline timeframe">
            {['24H', '7D', '1M'].map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => onTrendRangeChange(r)}
                aria-pressed={trendRange === r}
                className={`rounded-md px-2 py-1 text-[11px] font-bold transition-colors ${
                  trendRange === r ? 'bg-white text-sky shadow-sm' : 'text-steel-500 hover:text-ink'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

{liveTrendSeries && (
        <div className="mt-3 flex items-baseline justify-between text-xs">
          <span className="font-mono text-steel-600 tabular-nums">
            Peak: <strong className="text-ink">{series.max.toFixed(series.digits)}</strong>
          </span>
          <span className={`font-mono font-bold tabular-nums ${series.deltaPct >= 0 ? 'text-go' : 'text-red-600'}`}>
            {series.deltaPct >= 0 ? '+' : ''}{series.deltaPct.toFixed(2)}% ({trendRange})
          </span>
        </div>
        )}

        <div className="mt-2 rounded-lg border border-steel-100 bg-steel-50/60 p-2">
          {!liveTrendSeries ? (
            <p className="flex h-28 items-center justify-center px-4 text-center text-xs text-steel-500" role="status">No price history to show yet. It is still loading, or the feed has nothing for this pair.</p>
          ) : (<>
          <svg viewBox={`0 0 ${w} ${h}`} className="h-28 w-full overflow-visible" aria-hidden="true">
            <defs>
              <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0b5fd8" stopOpacity="0.22" />
                <stop offset="100%" stopColor="#0b5fd8" stopOpacity="0.01" />
              </linearGradient>
            </defs>
            {[0.25, 0.5, 0.75].map((f) => (
              <line key={f} x1={padX} x2={w - padX} y1={h * f} y2={h * f} stroke="#e2e8f0" strokeDasharray="3 3" />
            ))}
            {areaPath && <path d={areaPath} fill="url(#trendGrad)" />}
            {linePath && <path d={linePath} fill="none" stroke="#0b5fd8" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />}
            {lastPt && (
              <circle cx={lastPt.x} cy={lastPt.y} r="4" fill="#0b5fd8" stroke="#ffffff" strokeWidth="2" />
            )}
          </svg>
          <div className="mt-1 flex items-center justify-between text-[10px] font-mono text-steel-500">
            {series.labels.map((lbl) => <span key={lbl}>{lbl}</span>)}
          </div>
          </>)}
        </div>

        <div className="mt-3 flex items-center justify-between gap-2 text-xs">
          <span className="text-steel-500">
            {liveTrendSeries ? 'Yahoo FX historical closes:' : 'Price history:'}
          </span>
          <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-go border border-emerald-200">
            {liveTrendSeries ? 'Live FX History' : 'Unavailable'}
          </span>
        </div>
      </section>

      {/* 2. Spread Transparency Meter */}
      <section className="panel p-4" aria-label="Spread transparency meter">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded bg-sky/10 text-sky" aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M4 20V10M12 20V4M20 20v-7" /></svg>
          </span>
          <h2 className="font-display text-lg font-bold uppercase tracking-wide text-ink">
            Spread Transparency Meter
          </h2>
        </div>
        <p className="mt-1 text-xs text-steel-500">
          Estimated margin each provider category adds on top of interbank mid-market rates for {s.from}/{s.to}.
        </p>

        <div className="mt-3.5 space-y-3">
          {metrics.spreadTiers.map((tier) => {
            const widthPct = tier.max === 0 ? 4 : Math.max(8, Math.min(100, (tier.max / maxTierVal) * 100));
            const labelText = tier.note || (tier.min === tier.max ? `${tier.min.toFixed(2)}%` : `+${tier.min.toFixed(2)}% – ${tier.max.toFixed(2)}%`);
            return (
              <div key={tier.id}>
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-medium text-steel-600">{tier.label}</span>
                  <span className={`font-mono font-bold tabular-nums ${
                    tier.tone === 'emerald' ? 'text-go' : tier.tone === 'red' ? 'text-red-600' : tier.tone === 'blue' ? 'text-sky' : 'text-amber-700'
                  }`}>
                    {labelText}
                  </span>
                </div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-steel-100">
                  <div className={`h-full rounded-full ${barColors[tier.tone]}`} style={{ width: `${widthPct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 3. Interactive Branch Map / Google Reviews */}
      <div ref={panelRef} className="scroll-mt-20">
        {data.providers.some((p) => p.reviews?.length) && (
          <div className="mb-2 flex gap-2" role="tablist" aria-label="Map and reviews panel">
            <button role="tab" type="button" className="key" aria-selected={panel === 'map'} onClick={() => setPanel('map')}>
              Branch Map
            </button>
            <button role="tab" type="button" className="key" aria-selected={panel === 'reviews'} onClick={() => setPanel('reviews')}>
              Google Reviews
            </button>
          </div>
        )}
        {panel === 'map' ? (
          <MapBoundary>
            <Suspense fallback={<div className="panel p-5 text-sm text-steel-600">Loading vector branch map…</div>}>
              <MapPanel
                pins={pins}
                selectedId={sel?.bid}
                selected={selected}
                onSelect={onMap}
                bestId={bestId}
                user={userLoc}
                nearIds={nearest.map((x) => x.b.id)}
              />
            </Suspense>
          </MapBoundary>
        ) : (
          <ReviewsDrawer provider={data.providers.find((p) => p.id === reviewPid)} onClose={() => setPanel('map')} />
        )}
      </div>

      {/* 4. Regulated Market Feed & Sources Card */}
      <section className="panel p-4" aria-label="Regulated market feed">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded bg-sky/10 text-sky" aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M12 2l7 4v6c0 5-3.5 9-7 10-3.5-1-7-5-7-10V6l7-4z" /></svg>
          </span>
          <h2 className="font-display text-lg font-bold uppercase tracking-wide text-ink">
            Market Feed &amp; Directory
          </h2>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-steel-600">
          Market mid-rates are cross-checked across Yahoo Finance FX spot, ECB (Frankfurter), open.er-api.com, and fawazahmed0. Provider rates are indicative estimates; confirm final rates at the counter.
        </p>

        {data.sourceStatus?.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {data.sourceStatus.map((src) => (
              <span
                key={src.id}
                className={`rounded border px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider ${
                  src.ok
                    ? 'border-emerald-200 bg-emerald-50 text-go'
                    : 'border-steel-200 bg-steel-50 text-steel-500'
                }`}
              >
                {src.id} {src.ok ? 'OK' : 'OFFLINE'}
              </span>
            ))}
          </div>
        )}

        <div className="mt-3 flex flex-wrap gap-3 border-t border-steel-100 pt-2.5 text-xs">
          <Link to="/methodology" className="font-semibold text-sky hover:underline">How we calculate</Link>
          <Link to="/sources" className="font-semibold text-sky hover:underline">Live source status</Link>
        </div>
      </section>
    </aside>
  );
}
