import { ageLabel, rateDigits } from './pricing.js';
import { pairNoteFor } from './results.js';

/** Freshness and provenance of the market rate behind a currency pair. */
export function marketInfo(data, from, to) {
  const times = data.quoteTimes ? [from, to].map((c) => data.quoteTimes[c]).filter(Boolean) : [];
  const quotedAt = times.length ? new Date(Math.min(...times.map((t) => t.getTime()))) : data.quotedAt;
  const live = !!data.liveHost;
  const daily = live && (data.dailyCodes ?? []).some((c) => c === from || c === to);
  const ageMin = quotedAt ? (Date.now() - quotedAt.getTime()) / 60000 : 0;
  const mid = data.mid[to] / data.mid[from];
  return {
    mid, digits: rateDigits(mid), live, daily, quotedAt,
    age: quotedAt ? ageLabel(quotedAt) : null,
    stale: !daily && ageMin > 30,
    note: pairNoteFor(data, from, to),
  };
}
