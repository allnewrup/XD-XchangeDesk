/**
 * fxDataService — the single adapter between the UI and every data source.
 *
 * Two-tier always-live FX pipeline:
 *   1. getWarmSnapshot()    loads the latest browser-cached live snapshot (or pre-loaded seed on first visit).
 *   2. refreshLiveRates()   pulls full 160+ currency consensus across Yahoo FX spot, ECB, open.er-api, and fawazahmed0.
 *   3. refreshSpotRates()   high-frequency (~5s) spot updates from Yahoo FX for active corridors + ticker pairs.
 *   4. fetchPairHistory()   real Yahoo FX intraday/weekly/monthly closes for the Reference Curve & KPI sparkline.
 *   5. enrichFromGoogle()   optional Google Places enrichment hook when VITE_PLACES_PROXY is configured.
 */
import { SEED_MID_PER_AED, CURRENCIES } from '../data/seed.js';
import { PROVIDERS } from '../data/providers.js';
import { mergeSpotIntoSnapshot, buildCrossHistorySeries } from '../lib/liveRates.js';

const RATE_ENDPOINTS = [
  'https://open.er-api.com/v6/latest/AED',
  'https://api.exchangerate-api.com/v4/latest/AED',
];

const WARM_CACHE_KEY = 'xd-live-snapshot-v1';
const WARM_TTL_MS = 24 * 60 * 60 * 1000;

export const CORE_SPOT_CODES = CURRENCIES.map((c) => c.code).filter((c) => c !== 'USD');

// Set VITE_PLACES_PROXY to a server route that forwards to Google Places API (New)
// "places:searchText" / "places/{id}" so the API key never reaches the browser.
const PLACES_PROXY = import.meta.env?.VITE_PLACES_PROXY;

export function getSnapshot() {
  return {
    providers: PROVIDERS,
    mid: { ...SEED_MID_PER_AED },
    perUsd: null,
    prevPerUsd: null,
    prevMid: null,
    dailyCodes: [],
    updatedAt: null, // null => seed data, never fetched
    source: { rates: 'seed', places: 'seed', reviews: 'seed' },
  };
}

export function getWarmSnapshot() {
  const base = getSnapshot();
  if (typeof localStorage === 'undefined') return base;
  try {
    const raw = JSON.parse(localStorage.getItem(WARM_CACHE_KEY) || 'null');
    if (!raw || !raw.mid || !okNum(raw.mid.AED) || !raw.savedAt) return base;
    if (Date.now() - raw.savedAt > WARM_TTL_MS) return base;
    const reviveDate = (v) => (v ? new Date(v) : null);
    const quoteTimes = {};
    if (raw.quoteTimes) {
      for (const [k, v] of Object.entries(raw.quoteTimes)) {
        if (v) quoteTimes[k] = new Date(v);
      }
    }
    return {
      ...base,
      mid: raw.mid,
      perUsd: raw.perUsd ?? null,
      prevPerUsd: raw.prevPerUsd ?? null,
      prevMid: raw.prevMid ?? null,
      dailyCodes: Array.isArray(raw.dailyCodes) ? raw.dailyCodes : [],
      quoteTimes,
      sourceInfo: raw.sourceInfo ?? undefined,
      sourceStatus: Array.isArray(raw.sourceStatus)
        ? raw.sourceStatus.map((s) => ({ ...s, asOf: reviveDate(s.asOf) }))
        : undefined,
      liveHost: raw.liveHost ?? null,
      updatedAt: reviveDate(raw.updatedAt),
      quotedAt: reviveDate(raw.quotedAt),
      source: { ...base.source, rates: raw.liveHost ?? 'cached-live' },
    };
  } catch {
    return base;
  }
}

export function saveWarmSnapshot(d) {
  if (typeof localStorage === 'undefined' || !d?.mid || !d?.updatedAt) return;
  try {
    const quoteTimes = {};
    if (d.quoteTimes) {
      for (const [k, v] of Object.entries(d.quoteTimes)) {
        if (v instanceof Date) quoteTimes[k] = v.toISOString();
      }
    }
    localStorage.setItem(WARM_CACHE_KEY, JSON.stringify({
      savedAt: Date.now(),
      mid: d.mid,
      perUsd: d.perUsd ?? null,
      prevPerUsd: d.prevPerUsd ?? null,
      prevMid: d.prevMid ?? null,
      dailyCodes: d.dailyCodes ?? [],
      quoteTimes,
      sourceInfo: d.sourceInfo ?? null,
      sourceStatus: (d.sourceStatus ?? []).map((s) => ({
        ...s,
        asOf: s.asOf instanceof Date ? s.asOf.toISOString() : s.asOf,
      })),
      liveHost: d.liveHost ?? null,
      updatedAt: d.updatedAt instanceof Date ? d.updatedAt.toISOString() : d.updatedAt,
      quotedAt: d.quotedAt instanceof Date ? d.quotedAt.toISOString() : d.quotedAt,
    }));
  } catch {
    /* ignore storage quota errors */
  }
}

async function fetchJson(url, ms = 8000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctl.signal, cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

/**
 * Market-rate sources. Each one is normalised to units of <ccy> per 1 USD, with a timestamp per currency.
 * They are cross-checked against each other in buildConsensus(): outliers are discarded and the freshest
 * surviving quote wins, so one stale or wrong feed can't poison the numbers.
 */
const SOURCES = [
  { id: 'yahoo', label: 'Yahoo Finance FX spot', kind: 'spot', priority: 0 },
  { id: 'ecb', label: 'ECB via Frankfurter', kind: 'daily', priority: 1 },
  { id: 'erapi', label: 'open.er-api.com', kind: 'daily', priority: 2 },
  { id: 'fawaz', label: 'fawazahmed0 currency-api', kind: 'daily', priority: 3 },
];
const SRC = Object.fromEntries(SOURCES.map((s) => [s.id, s]));
const BASE_TOLERANCE = 0.0025, DRIFT_PER_SQRT_HOUR = 0.002, MAX_TOLERANCE = 0.015;

const okNum = (v) => typeof v === 'number' && Number.isFinite(v) && v > 0;

/** Minute-level spot quotes for core currencies + any active corridor currencies, through /api/yahoo. */
async function fromYahoo(extraCodes = []) {
  const codes = [...new Set([...CORE_SPOT_CODES, ...extraCodes])]
    .filter((c) => /^[A-Z]{3}$/.test(c) && c !== 'USD');

  const settled = await Promise.allSettled(
    codes.map(async (code) => {
      const j = await fetchJson(`/api/yahoo/v8/finance/chart/USD${code}=X?interval=1m&range=1d&_=${Date.now()}`, 6500);
      const m = j?.chart?.result?.[0]?.meta;
      if (!m || !okNum(m.regularMarketPrice)) throw new Error(`No quote for USD${code}`);
      const prevClose = okNum(m.chartPreviousClose)
        ? m.chartPreviousClose
        : okNum(m.previousClose)
          ? m.previousClose
          : m.regularMarketPrice;
      const ts = m.regularMarketTime ? new Date(m.regularMarketTime * 1000) : new Date();
      return [code, m.regularMarketPrice, prevClose, ts];
    }),
  );

  const perUsd = { USD: 1 };
  const prevClosePerUsd = { USD: 1 };
  const times = {};
  let okCount = 0;

  for (const res of settled) {
    if (res.status !== 'fulfilled') continue;
    const [code, price, prevClose, ts] = res.value;
    perUsd[code] = price;
    prevClosePerUsd[code] = prevClose;
    times[code] = ts;
    okCount += 1;
  }

  if (!okCount || !okNum(perUsd.AED)) {
    throw new Error('Yahoo FX spot unavailable');
  }
  times.USD = times.AED ?? new Date(Math.max(...Object.values(times).map((d) => d.getTime())));
  return { id: 'yahoo', perUsd, prevClosePerUsd, times };
}

/** Daily reference rates for ~160 currencies. */
async function fromErApi() {
  let lastErr;
  for (const url of RATE_ENDPOINTS.map((u) => u.replace('/AED', '/USD'))) {
    try {
      const j = await fetchJson(url);
      if (!j.rates) throw new Error('No rates in response');
      const ts = j.time_last_update_unix ? new Date(j.time_last_update_unix * 1000) : new Date();
      const perUsd = {}, times = {};
      for (const [c, v] of Object.entries(j.rates)) if (/^[A-Z]{3}$/.test(c) && okNum(v)) { perUsd[c] = v; times[c] = ts; }
      return { id: 'erapi', perUsd, times };
    } catch (e) { lastErr = e; }
  }
  throw lastErr;
}

/** European Central Bank reference rates (about 30 currencies), published each working day around 16:00 CET. */
async function fromEcb() {
  const j = await fetchJson('https://api.frankfurter.dev/v1/latest?base=USD');
  if (!j.rates || !j.date) throw new Error('No ECB rates');
  const ts = new Date(`${j.date}T15:00:00Z`);
  const perUsd = { USD: 1 }, times = { USD: ts };
  for (const [c, v] of Object.entries(j.rates)) if (okNum(v)) { perUsd[c] = v; times[c] = ts; }
  return { id: 'ecb', perUsd, times };
}

/** Community-maintained daily rates for 300+ currencies. */
async function fromFawaz() {
  let lastErr;
  for (const url of ['https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json', 'https://latest.currency-api.pages.dev/v1/currencies/usd.json']) {
    try {
      const j = await fetchJson(url);
      if (!j.usd || !j.date) throw new Error('No rates in response');
      const ts = new Date(`${j.date}T00:00:00Z`);
      const perUsd = {}, times = {};
      for (const [c, v] of Object.entries(j.usd)) if (/^[a-z]{3}$/.test(c) && okNum(v)) { perUsd[c.toUpperCase()] = v; times[c.toUpperCase()] = ts; }
      return { id: 'fawaz', perUsd, times };
    } catch (e) { lastErr = e; }
  }
  throw lastErr;
}

/**
 * For every currency: gather each source's quote, drop outliers (when 3+ sources quote it), then take the
 * freshest remaining quote, with ties broken by source priority. Returns per-currency provenance too.
 */
export function buildConsensus(results) {
  const codes = new Set(results.flatMap((r) => Object.keys(r.perUsd)));
  const perUsd = {}, time = {}, info = {};
  for (const code of codes) {
    const cands = results.filter((r) => okNum(r.perUsd[code])).map((r) => ({ id: r.id, v: r.perUsd[code], t: r.times[code] ?? new Date(0) }));
    if (cands.length < 2 && !cands.some((c) => c.id === 'yahoo')) continue;
    let kept = cands;
    if (cands.length >= 3) {
      kept = cands.filter((c) => cands.some((o) => {
        if (o === c) return false;
        const gapH = Math.abs(c.t - o.t) / 36e5;
        const tol = Math.min(MAX_TOLERANCE, BASE_TOLERANCE + DRIFT_PER_SQRT_HOUR * Math.sqrt(gapH));
        return Math.abs(c.v - o.v) / Math.min(c.v, o.v) <= tol;
      }));
    }
    kept.sort((a, b) => b.t - a.t || SRC[a.id].priority - SRC[b.id].priority);
    const best = kept[0];
    perUsd[code] = best.v; time[code] = best.t;
    info[code] = { source: best.id, agree: kept.length, total: cands.length, rejected: cands.filter((c) => !kept.includes(c)).map((c) => c.id) };
  }
  return { perUsd, time, info };
}

export async function refreshLiveRates(extraCodes = []) {
  const settled = await Promise.allSettled([fromYahoo(extraCodes), fromEcb(), fromErApi(), fromFawaz()]);
  const results = settled.filter((s) => s.status === 'fulfilled').map((s) => s.value);
  if (!results.length || !results.some((r) => okNum(r.perUsd.AED))) {
    const why = settled.find((s) => s.status === 'rejected')?.reason?.message ?? 'network error';
    throw new Error(`Live rates unavailable (${why}). Showing the last known rates.`);
  }
  const { perUsd, time, info } = buildConsensus(results);
  if (!okNum(perUsd.AED)) throw new Error('Live rates unavailable (no AED quote). Showing the last known rates.');

  const yahooRes = settled[0].status === 'fulfilled' ? settled[0].value : null;
  const prevPerUsd = yahooRes?.prevClosePerUsd ?? null;
  const prevAedPerUsd = okNum(prevPerUsd?.AED) ? prevPerUsd.AED : perUsd.AED;

  const mid = {}, prevMid = {}, quoteTimes = {}, sourceInfo = {}, daily = [];
  for (const code of Object.keys(perUsd)) {
    mid[code] = perUsd[code] / perUsd.AED; // units per 1 AED
    if (prevPerUsd && okNum(prevPerUsd[code])) {
      prevMid[code] = prevPerUsd[code] / prevAedPerUsd;
    }
    quoteTimes[code] = new Date(Math.min(time[code].getTime(), time.AED.getTime()));
    sourceInfo[code] = info[code];
    if (SRC[info[code].source].kind === 'daily') daily.push(code);
  }

  const ids = ['yahoo', 'ecb', 'erapi', 'fawaz'];
  const sourceStatus = settled.map((s, i) => ({
    id: ids[i], label: SRC[ids[i]].label, kind: SRC[ids[i]].kind, ok: s.status === 'fulfilled',
    asOf: s.status === 'fulfilled' ? (s.value.times.AED ?? s.value.times.USD ?? null) : null,
  }));
  const used = results.map((r) => SRC[r.id].label);
  const quotedAt = new Date(Math.min(...['USD', 'EUR', 'GBP', 'INR'].filter((c) => quoteTimes[c]).map((c) => quoteTimes[c].getTime())));
  return {
    mid, perUsd, prevPerUsd, prevMid, quoteTimes, sourceInfo, sourceStatus, dailyCodes: daily,
    updatedAt: new Date(), quotedAt, host: used.join(', '), sourcesUsed: used, sourcesTried: SOURCES.length,
  };
}

/**
 * Lightweight live spot refresh (~200ms) for core pairs and the active selected corridor.
 */
export async function refreshSpotRates(prevData, extraCodes = []) {
  const spot = await fromYahoo(extraCodes);
  return mergeSpotIntoSnapshot(prevData, spot, new Date());
}

const HISTORY_CACHE = new Map();
const RANGE_SPEC = {
  '24H': { range: '1d', interval: '15m', ttl: 15_000 },
  '7D': { range: '5d', interval: '1h', ttl: 60_000 },
  '1M': { range: '1mo', interval: '1d', ttl: 180_000 },
};

async function fetchUsdSeriesCloses(code, spec) {
  if (code === 'USD') return [1, 1];
  const j = await fetchJson(`/api/yahoo/v8/finance/chart/USD${code}=X?interval=${spec.interval}&range=${spec.range}`, 6000);
  const closes = j?.chart?.result?.[0]?.indicators?.quote?.[0]?.close;
  if (!Array.isArray(closes)) return null;
  const clean = closes.filter(okNum);
  return clean.length >= 2 ? clean : null;
}

/**
 * Fetches real historical FX close series from Yahoo Finance for `(from, to, range)`
 * and anchors the final point on the current `liveMid`.
 */
export async function fetchPairHistory(from, to, range = '24H', liveMid) {
  const spec = RANGE_SPEC[range] ?? RANGE_SPEC['24H'];
  const key = `${from}-${to}-${range}`;
  const cached = HISTORY_CACHE.get(key);
  if (cached && Date.now() - cached.fetchedAt < spec.ttl) {
    return buildCrossHistorySeries({
      fromCloses: cached.fromCloses,
      toCloses: cached.toCloses,
      liveMid,
      range,
    });
  }
  try {
    const [fromCloses, toCloses] = await Promise.all([
      fetchUsdSeriesCloses(from, spec),
      fetchUsdSeriesCloses(to, spec),
    ]);
    if (!fromCloses || !toCloses) return null;
    HISTORY_CACHE.set(key, { fromCloses, toCloses, fetchedAt: Date.now() });
    return buildCrossHistorySeries({ fromCloses, toCloses, liveMid, range });
  } catch {
    return null;
  }
}

/**
 * Google Places enrichment. Returns providers unchanged when no proxy is configured,
 * so the UI keeps working with the seed ratings and sample reviews.
 */
export async function enrichFromGoogle(providers) {
  if (!PLACES_PROXY) return { providers, enriched: false };
  const out = [];
  for (const p of providers) {
    try {
      const data = await fetchJson(`${PLACES_PROXY}?q=${encodeURIComponent(`${p.name} UAE`)}`);
      out.push({
        ...p,
        rating: data.rating ?? p.rating,
        reviewCount: data.userRatingCount ?? p.reviewCount,
        reviews: data.reviews?.length
          ? data.reviews.map((r) => ({
              name: r.authorAttribution?.displayName ?? 'Google user',
              stars: r.rating,
              branch: r.branch ?? 'UAE',
              daysAgo: Math.max(0, Math.round((Date.now() - new Date(r.publishTime)) / 864e5)),
              text: r.text?.text ?? '',
              verified: true,
            }))
          : p.reviews,
      });
    } catch {
      out.push(p);
    }
  }
  return { providers: out, enriched: true };
}
