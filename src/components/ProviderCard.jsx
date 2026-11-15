import React, { useState } from 'react';
import { Mark, Stars, Icon } from './ui.jsx';
import { fmtNum, rateDigits, ageLabel, isOpenNow, hoursLabel, directionsUrl, mapsUrl, reviewsUrl } from '../lib/pricing.js';

function estimateLabel(quotedAt, live, daily) {
  if (!live || !quotedAt) return 'Syncing live rates…';
  if (daily) return `Daily fix · ${ageLabel(quotedAt)} old`;
  const ageMs = Date.now() - quotedAt.getTime();
  if (ageMs < 90_000) return 'Live spot quote · active';
  return `Market quote · ${ageLabel(quotedAt)} old`;
}

export default function ProviderCard({
  row,
  rank,
  s,
  quotedAt,
  live,
  daily,
  distKm,
  selected,
  onMap,
  onReviews,
  hasRatings,
  compared,
  compareDisabled,
  onCompare,
  badges,
  savings,
  bestTotal,
  onPickBranch,
}) {
  const [expanded, setExpanded] = useState(false);
  const { provider: p, branch: b, branches, q, total } = row;
  const d = rateDigits(Math.max(q.sellRate, q.buyRate));
  const activeRate = s.mode === 'sell' ? q.sellRate : q.buyRate;
  const open = isOpenNow(b);
  const verb = s.mode === 'sell' ? 'Recipient gets' : 'You pay';
  const cur = s.to;

  const midTotal = s.amount * q.mid;
  const spreadCost = Math.abs(midTotal - total);
  const spreadPct = midTotal ? (spreadCost / midTotal) * 100 : 0;

  // Identify high-markup banks compared to best offer
  const isHighMarkup = p.type === 'bank' && spreadPct >= 1.5;
  const diffVsBest = bestTotal != null
    ? (s.mode === 'sell' ? Math.max(0, bestTotal - total) : Math.max(0, total - bestTotal))
    : 0;
  const aedMarkupPenalty = q.mid > 0 ? diffVsBest / (s.to === 'AED' ? 1 : (s.from === 'AED' ? q.mid : 1)) : 0;

  const isTopPick = rank === 1;
  const isSecondPick = rank === 2;

  // Accent bar color on left edge like the mockup cards
  const accentColor = isHighMarkup ? '#dc2626' : (isTopPick ? '#0b5fd8' : (isSecondPick ? '#059669' : p.hue));

  const payoutColor = isHighMarkup
    ? 'text-red-600'
    : (isTopPick || isSecondPick ? 'text-go' : 'text-ink');

  const ctaClass = isTopPick
    ? 'btn btn-primary'
    : isSecondPick
      ? 'btn btn-emerald'
      : 'btn';

  return (
    <article
      className={`panel relative overflow-hidden transition-shadow ${selected ? 'ring-2 ring-sky' : ''}`}
      style={{ borderLeft: `4px solid ${accentColor}` }}
      aria-label={p.name}
    >
      <div className="p-4 sm:p-5">
        {/* Main horizontal row */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          {/* Left: Monogram + Identity + Metadata */}
          <div className="flex min-w-0 items-start gap-3.5">
            <Mark provider={p} size={46} />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-display text-xl font-bold uppercase tracking-wide text-ink leading-tight">
                  {p.name}
                </h3>
                {isTopPick && <span className="badge-gold">Rank #1 Best Value</span>}
                {!isTopPick && badges.map((x) => (
                  <span key={x.text} className={x.cls}>{x.text}</span>
                ))}
                {isHighMarkup && <span className="badge-red">High Exchange Markup</span>}
              </div>

              <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-steel-600">
                {p.rating != null && (
                  <>
                    <span className="inline-flex items-center gap-1 font-semibold text-ink">
                      <Stars value={p.rating} size={12} /> {p.rating.toFixed(1)}
                    </span>
                    <span className="text-steel-300" aria-hidden="true">·</span>
                  </>
                )}
                {!p.rating && hasRatings && (
                  <>
                    <span>No Google rating</span>
                    <span className="text-steel-300" aria-hidden="true">·</span>
                  </>
                )}
                <span className="font-semibold text-ink">
                  {p.type === 'bank' ? 'UAE Retail Bank' : 'Licensed Exchange House'}
                </span>
                <span className="text-steel-300" aria-hidden="true">·</span>
                <span>{s.channel === 'bank' ? 'Bank Transfer' : 'Cash & Branch Pickup'}</span>
                <span className="text-steel-300" aria-hidden="true">·</span>
                <span className={open === true ? 'font-semibold text-go' : open === false ? 'text-steel-500' : 'text-steel-500'}>
                  {open === null ? 'Hours not listed' : open ? `Open now (${hoursLabel(b)})` : `Closed (${hoursLabel(b)})`}
                </span>
                {distKm != null && (
                  <>
                    <span className="text-steel-300" aria-hidden="true">·</span>
                    <span className="font-semibold text-sky">
                      {distKm < 1 ? `${Math.round(distKm * 1000)} m` : `${distKm.toFixed(1)} km`} away
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Right: Payout + Rate + CTA */}
          <div className="flex flex-wrap items-center justify-between gap-4 md:justify-end md:text-right shrink-0">
            <div>
              <div className="label">{verb}</div>
              <div className={`mt-0.5 font-mono text-2xl font-bold tabular-nums leading-none ${payoutColor}`}>
                {fmtNum(total, 2)} <span className="text-base font-bold">{cur}</span>
              </div>
              <div className="mt-1 font-mono text-[11px] text-steel-500 tabular-nums">
                Fee: {s.channel === 'bank' ? `${fmtNum(q.feeBase)} ${s.from}` : '0.00 AED'} · Rate: {activeRate.toFixed(d)}
              </div>
              {isHighMarkup && diffVsBest > 0.01 && (
                <div className="mt-0.5 font-mono text-[11px] font-semibold text-red-600 tabular-nums">
                  {s.mode === 'sell' ? '−' : '+'}{fmtNum(diffVsBest, 2)} {cur} vs Rank #1
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => onMap(p.id, b.id)}
              className={`${ctaClass} min-w-[140px] text-xs font-bold uppercase tracking-wider`}
            >
              {p.type === 'bank' ? 'View Bank Branch' : 'View Branch & Map'}
            </button>
          </div>
        </div>

        {/* Bottom Metadata & Action Strip */}
        <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2 border-t border-steel-100 pt-2.5 text-xs text-steel-500">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>
              Spread vs Mid-Market:{' '}
              <strong className={`font-mono font-semibold tabular-nums ${isHighMarkup ? 'text-red-600' : 'text-go'}`}>
                +{spreadPct.toFixed(2)}%
              </strong>
            </span>
            <span className="text-steel-300" aria-hidden="true">·</span>
            <span>
              Branch: <strong className="font-semibold text-ink">{b.area === b.emirate ? b.emirate : `${b.area}, ${b.emirate}`}</strong>
              {branches.length > 1 && ` (+${branches.length - 1} more)`}
            </span>
            {savings > 0.01 && !isHighMarkup && (
              <>
                <span className="text-steel-300" aria-hidden="true">·</span>
                <span className="font-semibold text-go tabular-nums">
                  {s.mode === 'sell' ? '+' : '−'}{fmtNum(savings, 2)} {cur} vs worst
                </span>
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className={`flex items-center gap-1.5 font-semibold text-ink ${compareDisabled && !compared ? 'opacity-50' : 'cursor-pointer'}`}>
              <input
                type="checkbox"
                className="h-3.5 w-3.5 rounded border-steel-300 text-sky focus:ring-sky"
                checked={compared}
                disabled={compareDisabled && !compared}
                onChange={() => onCompare(p.id)}
              />
              <span>Compare</span>
            </label>

            <a
              href={directionsUrl(b, p)}
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-sky hover:underline whitespace-nowrap"
            >
              Directions ↗
            </a>

            <button
              type="button"
              onClick={() => setExpanded((e) => !e)}
              aria-expanded={expanded}
              className="font-semibold text-sky hover:underline whitespace-nowrap"
            >
              {expanded ? 'Hide calculation ▴' : 'View fee calculation & branches ▾'}
            </button>
          </div>
        </div>

        {/* High markup warning strip (matching Emirates NBD card in mockup) */}
        {isHighMarkup && diffVsBest > 1 && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50/80 px-3 py-2 text-xs text-red-800">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="mt-0.5 shrink-0 text-red-600" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <p>
              <strong>Hidden Spread Markup:</strong> Even when bank transfers advertise low or zero flat fees, an exchange rate of{' '}
              <span className="font-mono font-semibold">{activeRate.toFixed(d)}</span> embeds roughly{' '}
              <span className="font-mono font-semibold">
                {s.from === 'AED' ? `~${fmtNum(aedMarkupPenalty, 0)} AED` : `~${fmtNum(diffVsBest, 2)} ${cur}`}
              </span>{' '}
              in currency conversion spread vs the top exchange house.
            </p>
          </div>
        )}

        {/* Expandable Details Drawer: Fee Math, Buy/Sell Rates, Branch Selector */}
        {expanded && (
          <div className="mt-3 rounded-lg border border-steel-200 bg-steel-50 p-3.5 text-xs">
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <div className="label">Rate Board (1 {s.from})</div>
                <div className="mt-1 font-mono text-ink tabular-nums">
                  Sell {s.from}: <strong>{q.sellRate.toFixed(d)} {s.to}</strong>
                </div>
                <div className="font-mono text-steel-600 tabular-nums">
                  Buy {s.from}: <strong>{q.buyRate.toFixed(d)} {s.to}</strong>
                </div>
              </div>
              <div>
                <div className="label">Cost Breakdown</div>
                <div className="mt-1 text-ink">
                  Mid-market total: <span className="font-mono font-semibold">{fmtNum(midTotal, 2)} {cur}</span>
                </div>
                <div className="text-steel-600">
                  Spread &amp; fee cost: <span className="font-mono font-semibold">{fmtNum(spreadCost, 2)} {cur} ({spreadPct.toFixed(2)}%)</span>
                </div>
              </div>
              <div>
                <div className="label">Data Provenance</div>
                <div className="mt-1 text-steel-600">{estimateLabel(quotedAt, live, daily)}</div>
                <div className="text-steel-500">
                  {p.spreadBasis === 'category'
                    ? `Category-avg ${p.type} spread (${q.marginPct.toFixed(2)}%)`
                    : `Profiled typical spread (${q.marginPct.toFixed(2)}%)`}
                </div>
              </div>
            </div>

            {branches.length > 0 && (
              <div className="mt-3 border-t border-steel-200 pt-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="label">{branches.length} Matching Branch{branches.length === 1 ? '' : 'es'} (click to select)</span>
                  <div className="flex items-center gap-3">
                    {p.reviews?.length ? (
                      <button type="button" onClick={() => onReviews(p.id)} className="font-semibold text-sky hover:underline">
                        Read Google reviews
                      </button>
                    ) : (
                      <a href={reviewsUrl(p)} target="_blank" rel="noreferrer" className="font-semibold text-sky hover:underline">
                        Reviews on Google ↗
                      </a>
                    )}
                    <a href={mapsUrl(b, p)} target="_blank" rel="noreferrer" className="font-semibold text-sky hover:underline">
                      Open in Google Maps ↗
                    </a>
                  </div>
                </div>
                {b.address && <p className="mt-1 text-steel-600">Selected address: {b.address}</p>}
                {branches.length > 1 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {branches.slice(0, 8).map((br) => {
                      const same = branches.filter((x) => x.area === br.area);
                      const label = same.length > 1 ? `${br.area} ${same.indexOf(br) + 1}` : br.area;
                      return (
                        <button
                          key={br.id}
                          type="button"
                          onClick={() => onPickBranch(p.id, br.id)}
                          aria-pressed={br.id === b.id}
                          className={`rounded-md border px-2 py-1 text-[11px] font-semibold transition-colors ${
                            br.id === b.id
                              ? 'border-sky bg-sky text-white'
                              : 'border-steel-200 bg-white text-steel-600 hover:bg-steel-100'
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                    {branches.length > 8 && (
                      <span className="self-center text-[11px] text-steel-500">+{branches.length - 8} more on map</span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
