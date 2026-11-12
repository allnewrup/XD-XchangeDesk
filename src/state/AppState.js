import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState as RNAppState } from 'react-native';
import * as Location from 'expo-location';
import { getLocales } from 'expo-localization';
import { EMIRATES } from '../data/seed.js';
import { getSnapshot, refreshLiveRates } from '../lib/fx.js';
import { guessHomeCurrency } from '../lib/pricing.js';
import { applyPatch, originFor, deriveRows, isSpecificArea, sortRows } from '../lib/results.js';
import { load, save } from '../lib/storage.js';

const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

const KEY = { search: 'xd.search.v1', rates: 'xd.rates.v1', saved: 'xd.saved.v1' };
const REFRESH_MS = 60_000;

const reviveDates = (o) => Object.fromEntries(Object.entries(o ?? {}).map(([k, v]) => [k, new Date(v)]));

function defaultSearch() {
  const home = guessHomeCurrency(getLocales()[0]?.regionCode); // visitors start as "foreign cash -> AED"; UAE residents as "AED -> INR"
  return {
    from: home ?? 'AED', to: home ? 'AED' : 'INR', amount: 1000, amountText: '1000', mode: 'sell', channel: 'cash', areaId: 'all',
    minRating: 0, openNow: false, query: '', emirates: Object.fromEntries(EMIRATES.map((e) => [e, true])), type: 'all', sort: 'rate',
  };
}

export function AppProvider({ children }) {
  const [ready, setReady] = useState(false);
  const [data, setData] = useState(getSnapshot);
  const [s, setS] = useState(defaultSearch);
  const [userLoc, setUserLoc] = useState(null); // {lat, lng, acc}
  const [geo, setGeo] = useState({ busy: false, err: '' });
  const [saved, setSavedState] = useState([]); // [{from,to}]
  const [status, setStatus] = useState({ tone: 'info', text: 'Fetching live market rates…' });
  const [refreshing, setRefreshing] = useState(false);
  const [fromCache, setFromCache] = useState(false);

  // Restore the last search, saved pairs and the last known rates, so the app is useful before (or without) the network.
  useEffect(() => {
    (async () => {
      const [search, rates, sv] = await Promise.all([load(KEY.search), load(KEY.rates), load(KEY.saved, [])]);
      if (search) setS((p) => ({ ...p, ...search }));
      if (Array.isArray(sv)) setSavedState(sv);
      if (rates?.mid) {
        setData((d) => ({
          ...d, mid: rates.mid, quoteTimes: reviveDates(rates.quoteTimes), sourceInfo: rates.sourceInfo, sourceStatus: (rates.sourceStatus ?? []).map((x) => ({ ...x, asOf: x.asOf ? new Date(x.asOf) : null })),
          dailyCodes: rates.dailyCodes ?? [], updatedAt: new Date(rates.updatedAt), quotedAt: new Date(rates.quotedAt), liveHost: rates.host,
        }));
        setFromCache(true);
      }
      setReady(true);
    })();
  }, []);

  useEffect(() => { if (ready) save(KEY.search, s); }, [s, ready]);
  useEffect(() => { if (ready) save(KEY.saved, saved); }, [saved, ready]);

  const set = useCallback((patch) => setS((p) => applyPatch(p, patch)), []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const live = await refreshLiveRates();
      setData((d) => ({ ...d, mid: live.mid, updatedAt: live.updatedAt, quotedAt: live.quotedAt, quoteTimes: live.quoteTimes, dailyCodes: live.dailyCodes ?? [], sourceInfo: live.sourceInfo, sourceStatus: live.sourceStatus, liveHost: live.host }));
      setFromCache(false);
      setStatus({ tone: 'ok', text: `Market rates cross-checked across ${live.sourcesUsed?.length ?? 1} of ${live.sourcesTried ?? 1} sources.` });
      save(KEY.rates, { mid: live.mid, quoteTimes: live.quoteTimes, sourceInfo: live.sourceInfo, sourceStatus: live.sourceStatus, dailyCodes: live.dailyCodes, updatedAt: live.updatedAt, quotedAt: live.quotedAt, host: live.host });
    } catch (e) {
      setStatus({ tone: 'err', text: `${e.message} Showing the last known rates.` });
    } finally {
      setRefreshing(false);
    }
  }, []);

  // Load rates once restored, then every minute while the app is in the foreground and again when it returns to it.
  const lastRef = useRef(0);
  useEffect(() => {
    if (!ready) return undefined;
    const go = () => { lastRef.current = Date.now(); refresh(); };
    go();
    const id = setInterval(() => { if (RNAppState.currentState === 'active') go(); }, REFRESH_MS);
    const sub = RNAppState.addEventListener('change', (st) => { if (st === 'active' && Date.now() - lastRef.current > REFRESH_MS) go(); });
    return () => { clearInterval(id); sub.remove(); };
  }, [ready, refresh]);

  const locate = useCallback(async () => {
    setGeo({ busy: true, err: '' });
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') { setGeo({ busy: false, err: 'Location permission was denied. Allow it in Settings to see nearby branches.' }); return { ok: false }; }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude, acc: pos.coords.accuracy ?? 0 });
      setGeo({ busy: false, err: '' });
      set({ sort: 'near' });
      return { ok: true };
    } catch {
      setGeo({ busy: false, err: 'Could not get your location. Try again.' });
      return { ok: false };
    }
  }, [set]);
  const clearLocation = useCallback(() => { setUserLoc(null); setS((p) => (p.sort === 'near' ? { ...p, sort: 'rate' } : p)); }, []);

  const isSaved = useCallback((from, to) => saved.some((x) => x.from === from && x.to === to), [saved]);
  const toggleSaved = useCallback((from, to) => setSavedState((l) => (l.some((x) => x.from === from && x.to === to) ? l.filter((x) => !(x.from === from && x.to === to)) : [{ from, to }, ...l].slice(0, 20))), []);

  const origin = useMemo(() => originFor(s, userLoc), [s.areaId, userLoc]); // eslint-disable-line react-hooks/exhaustive-deps
  const specific = isSpecificArea(s, userLoc);
  const rows = useMemo(() => deriveRows(data, s, {}, origin), [data, s, origin]);
  const sorted = useMemo(() => sortRows(rows, s, specific), [rows, s.sort, s.mode, specific]); // eslint-disable-line react-hooks/exhaustive-deps
  const best = useMemo(() => (rows.length ? rows.reduce((a, b) => ((s.mode === 'sell' ? b.total > a.total : b.total < a.total) ? b : a)) : null), [rows, s.mode]);

  const value = { ready, data, s, set, userLoc, geo, locate, clearLocation, saved, isSaved, toggleSaved, status, refreshing, refresh, fromCache, origin, specific, rows, sorted, best };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
