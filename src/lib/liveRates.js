// Pure live-rate merging, cross-history building, and rate-alert evaluation helpers.
// Kept free of DOM/env globals so node:test can verify live-stream math deterministically.
import { rateDigits } from './pricing.js';

const okNum = (v) => typeof v === 'number' && Number.isFinite(v) && v > 0;

/**
 * Merges a lightweight Yahoo spot batch (`{ perUsd, prevClosePerUsd, times }`) into the existing
 * snapshot `prevData`, recomputing AED-normalized `mid` and `prevMid`, tracking which codes moved.
 */
export function mergeSpotIntoSnapshot(prevData, spotResult, fetchedAt = new Date()) {
  if (!spotResult || !spotResult.perUsd) return { data: prevData, changed: {} };

  const nextPerUsd = { ...(prevData.perUsd ?? {}), ...spotResult.perUsd };
  const aedPerUsd = nextPerUsd.AED;
  if (!okNum(aedPerUsd)) return { data: prevData, changed: {} };

  const nextPrevPerUsd = {
    ...(prevData.prevPerUsd ?? {}),
    ...(spotResult.prevClosePerUsd ?? {}),
  };
  const prevAedPerUsd = okNum(nextPrevPerUsd.AED) ? nextPrevPerUsd.AED : aedPerUsd;

  const nextMid = { ...(prevData.mid ?? {}), AED: 1 };
  for (const [code, val] of Object.entries(nextPerUsd)) {
    if (okNum(val)) nextMid[code] = val / aedPerUsd;
  }

  const nextPrevMid = { ...(prevData.prevMid ?? {}), AED: 1 };
  for (const [code, val] of Object.entries(nextPrevPerUsd)) {
    if (okNum(val)) nextPrevMid[code] = val / prevAedPerUsd;
  }

  const nextQuoteTimes = { ...(prevData.quoteTimes ?? {}) };
  const aedTime = spotResult.times?.AED ?? nextQuoteTimes.AED ?? fetchedAt;
  const spotCodes = new Set(Object.keys(spotResult.perUsd));

  for (const code of spotCodes) {
    const legTime = spotResult.times?.[code] ?? fetchedAt;
    nextQuoteTimes[code] = new Date(Math.min(legTime.getTime(), aedTime.getTime()));
  }

  const prevDaily = new Set(prevData.dailyCodes ?? []);
  for (const code of spotCodes) prevDaily.delete(code);

  const nextSourceInfo = { ...(prevData.sourceInfo ?? {}) };
  for (const code of spotCodes) {
    const existing = nextSourceInfo[code];
    nextSourceInfo[code] = {
      source: 'yahoo',
      agree: existing?.agree ?? 1,
      total: existing?.total ?? 1,
      rejected: existing?.rejected ?? [],
    };
  }

  const nextSourceStatus = Array.isArray(prevData.sourceStatus)
    ? prevData.sourceStatus.map((src) =>
        src.id === 'yahoo' ? { ...src, ok: true, asOf: aedTime } : src
      )
    : [{ id: 'yahoo', label: 'Yahoo Finance FX spot', kind: 'spot', ok: true, asOf: aedTime }];

  const changed = {};
  for (const [code, nextVal] of Object.entries(nextMid)) {
    const prevVal = prevData.mid?.[code];
    if (okNum(prevVal) && okNum(nextVal)) {
      const rel = (nextVal - prevVal) / prevVal;
      if (Math.abs(rel) > 1e-8) {
        changed[code] = rel > 0 ? 'up' : 'down';
      }
    }
  }

  const coreTimes = ['USD', 'EUR', 'GBP', 'INR']
    .map((c) => nextQuoteTimes[c])
    .filter(Boolean)
    .map((d) => d.getTime());
  const quotedAt = coreTimes.length ? new Date(Math.min(...coreTimes)) : fetchedAt;

  const prevHost = prevData.liveHost || '';
  const liveHost = prevHost.includes('Yahoo Finance FX spot')
    ? prevHost
    : prevHost
      ? `Yahoo Finance FX spot, ${prevHost}`
      : 'Yahoo Finance FX spot';

  return {
    changed,
    data: {
      ...prevData,
      perUsd: nextPerUsd,
      prevPerUsd: nextPrevPerUsd,
      mid: nextMid,
      prevMid: nextPrevMid,
      quoteTimes: nextQuoteTimes,
      dailyCodes: [...prevDaily],
      sourceInfo: nextSourceInfo,
      sourceStatus: nextSourceStatus,
      liveHost,
      updatedAt: fetchedAt,
      quotedAt,
      source: { ...(prevData.source ?? {}), rates: liveHost },
    },
  };
}

/**
 * Downsamples and combines two USD-base close arrays (`USD->from` and `USD->to`)
 * into a clean `from -> to` historical series anchored on `liveMid`.
 */
export function buildCrossHistorySeries({
  fromCloses,
  toCloses,
  liveMid,
  range = '24H',
  targetPoints = 24,
}) {
  if (!okNum(liveMid)) return null;
  const fromValid = Array.isArray(fromCloses) ? fromCloses.filter(okNum) : [];
  const toValid = Array.isArray(toCloses) ? toCloses.filter(okNum) : [];
  if (fromValid.length < 2 || toValid.length < 2) return null;

  const rawCross = [];
  const sampleCount = Math.min(targetPoints, Math.max(fromValid.length, toValid.length));
  for (let i = 0; i < sampleCount; i++) {
    const t = sampleCount === 1 ? 1 : i / (sampleCount - 1);
    const fi = Math.min(fromValid.length - 1, Math.round(t * (fromValid.length - 1)));
    const ti = Math.min(toValid.length - 1, Math.round(t * (toValid.length - 1)));
    const ratio = toValid[ti] / fromValid[fi];
    if (okNum(ratio)) rawCross.push(ratio);
  }
  if (rawCross.length < 2) return null;

  // Always anchor the final point on the current live mid-market rate
  rawCross[rawCross.length - 1] = liveMid;

  const min = Math.min(...rawCross);
  const max = Math.max(...rawCross);
  const first = rawCross[0];
  const deltaPct = first > 0 ? ((liveMid - first) / first) * 100 : 0;
  const digits = rateDigits(liveMid);

  const labels = range === '24H'
    ? ['24h ago', '16h ago', '8h ago', 'Live Now']
    : range === '7D'
      ? ['5d ago', '3d ago', '1d ago', 'Live Now']
      : ['1M ago', '20d ago', '10d ago', 'Live Now'];

  return {
    points: rawCross,
    min,
    max,
    deltaPct,
    digits,
    labels,
    source: 'yahoo',
  };
}

/**
 * Evaluates saved browser rate alerts against current live mid-market rates.
 */
export function evaluateTriggeredAlerts(alerts, mid) {
  if (!Array.isArray(alerts) || !mid) return [];
  const triggered = [];
  for (const al of alerts) {
    const f = mid[al.from];
    const t = mid[al.to];
    if (!okNum(f) || !okNum(t)) continue;
    const curMid = t / f;
    if (curMid >= al.target) {
      triggered.push({ ...al, currentMid: curMid });
    }
  }
  return triggered;
}
