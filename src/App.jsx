import React, { useMemo, useState, useCallback, useRef, useEffect, lazy, Suspense } from 'react';
import { AREAS, EMIRATES } from './data/seed.js';
import {
  getWarmSnapshot,
  saveWarmSnapshot,
  refreshLiveRates,
  refreshSpotRates,
  fetchPairHistory,
  enrichFromGoogle,
} from './services/fxDataService.js';
import { km, fmtNum, rateDigits, ageLabel, guessHomeCurrency, directionsUrl } from './lib/pricing.js';
import { applyPatch, originFor, deriveRows, isSpecificArea, sortRows, pairNoteFor } from './lib/results.js';
import { computeDashboardMetrics } from './lib/analytics.js';
import { evaluateTriggeredAlerts } from './lib/liveRates.js';
import { downloadComparisonCsv } from './lib/exportCsv.js';
import TopTicker from './components/TopTicker.jsx';
import HeaderNav from './components/HeaderNav.jsx';
import SyncStrip from './components/SyncStrip.jsx';
import HeroMatrix from './components/HeroMatrix.jsx';
import KpiStrip from './components/KpiStrip.jsx';
import OperatorFilters from './components/OperatorFilters.jsx';
import ProviderCard from './components/ProviderCard.jsx';
import RightRail from './components/RightRail.jsx';
import CompareDock from './components/CompareDock.jsx';
import CompareTray from './components/CompareTray.jsx';
import RateAlertsModal from './components/RateAlertsModal.jsx';
import MultiTransferModal from './components/MultiTransferModal.jsx';
const MapPanel = lazy(() => import('./components/MapPanel.jsx'));
import { QrModal } from './components/QrBadge.jsx';
import ChatLauncher from './components/ChatLauncher.jsx';
import { useRoute, Link } from './lib/router.jsx';
import { SiteNav } from './pages/PageShell.jsx';

const PAGE_VIEWS = {
  '/about': lazy(() => import('./pages/About.jsx')),
  '/methodology': lazy(() => import('./pages/Methodology.jsx')),
  '/sources': lazy(() => import('./pages/Sources.jsx')),
  '/contact': lazy(() => import('./pages/Contact.jsx')),
  '/privacy': lazy(() => import('./pages/Privacy.jsx')),
  '/terms': lazy(() => import('./pages/Terms.jsx')),
};

const ALERTS_KEY = 'xd-rate-alerts-v1';

function loadAlerts() {
  try {
    const raw = JSON.parse(localStorage.getItem(ALERTS_KEY) || '[]');
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

class MapBoundary extends React.Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed
      ? <div className="panel p-5 text-sm text-red-700" role="alert">The map could not load. Reload the page to try again. The list of branches still works.</div>
      : this.props.children;
  }
}

const BADGE = {
  rate: { text: 'Best Rate', cls: 'badge-gold' },
  rating: { text: 'Top Rated', cls: 'badge-steel' },
  branches: { text: 'Most Branches', cls: 'badge-copper' },
};

const LIVE_SPOT_INTERVAL_MS = 5000;
const FULL_CONSENSUS_INTERVAL_MS = 180000;

export default function App() {
  const route = useRoute();
  const PageView = PAGE_VIEWS[route];
  const [data, setData] = useState(getWarmSnapshot);
  const [s, setS] = useState(() => {
    const home = guessHomeCurrency();
    return {
      from: home ?? 'AED',
      to: home ? 'AED' : 'INR',
      amount: 10000,
      amountText: '10000',
      mode: 'sell',
      channel: 'cash',
      areaId: 'all',
      minRating: 0,
      openNow: false,
      query: '',
      emirates: Object.fromEntries(EMIRATES.map((e) => [e, true])),
      type: 'all',
      sort: 'rate',
    };
  });

  const sRef = useRef(s);
  const set = useCallback((patch) => {
    sRef.current = applyPatch(sRef.current, patch);
    setS((p) => applyPatch(p, patch));
  }, []);

  const [activeTab, setActiveTab] = useState('dashboard');
  const [compare, setCompareState] = useState([]);
  const compareRef = useRef(compare);
  const setCompare = useCallback((v) => setCompareState((c) => {
    const n = typeof v === 'function' ? v(c) : v;
    compareRef.current = n;
    return n;
  }), []);
  const [matrixOpen, setMatrixOpen] = useState(false);

  const [alerts, setAlerts] = useState(loadAlerts);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [calcOpen, setCalcOpen] = useState(false);

  useEffect(() => {
    try { localStorage.setItem(ALERTS_KEY, JSON.stringify(alerts)); } catch { /* ignore */ }
  }, [alerts]);

  const [picked, setPicked] = useState({});
  const pickedRef = useRef(picked);
  pickedRef.current = picked;
  const [sel, setSel] = useState(null);
  const [panel, setPanel] = useState('map');
  const [reviewPid, setReviewPid] = useState(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [userLoc, setUserLocState] = useState(null);
  const userLocRef = useRef(null);
  const setUserLoc = useCallback((v) => { userLocRef.current = v; setUserLocState(v); }, []);
  const [geo, setGeo] = useState({ busy: false, err: '' });

  const locate = useCallback(() => new Promise((resolve) => {
    const fail = (err) => { setGeo({ busy: false, err }); resolve({ ok: false, err }); };
    if (!navigator.geolocation) { fail('Your browser does not support location.'); return; }
    setGeo({ busy: true, err: '' });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude, acc: pos.coords.accuracy });
        setGeo({ busy: false, err: '' });
        set({ sort: 'near' });
        resolve({ ok: true });
      },
      (e) => fail(e.code === 1 ? 'Location permission was denied. Allow it in your browser settings to see nearby branches.' : 'Could not get your location. Try again.'),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  }), [set, setUserLoc]);

  const [refreshing, setRefreshing] = useState(false);
  const [status, setStatus] = useState({ tone: 'info', text: 'Connecting live market feeds…' });
  const [flashMap, setFlashMap] = useState({});
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [trendRange, setTrendRange] = useState('24H');
  const [liveHistory24h, setLiveHistory24h] = useState(null);
  const [liveTrendSeries, setLiveTrendSeries] = useState(null);

  const panelRef = useRef(null);
  const resultsRef = useRef(null);
  const trendsRef = useRef(null);
  const fullBusyRef = useRef(false);
  const spotBusyRef = useRef(false);
  const placesEnrichedRef = useRef(false);
  const flashTimerRef = useRef(null);

  const fmtTime = (d) => d.toLocaleString('en-AE', { timeZone: 'Asia/Dubai', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
  const fmtTimeSec = (d) => d.toLocaleString('en-AE', { timeZone: 'Asia/Dubai', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  const providersRef = useRef(data.providers);
  providersRef.current = data.providers;
  const dataRef = useRef(data);
  dataRef.current = data;

  const triggerFlash = useCallback((changed) => {
    const keys = Object.keys(changed || {});
    if (!keys.length) return;
    setFlashMap(changed);
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    flashTimerRef.current = setTimeout(() => setFlashMap({}), 1200);
  }, []);

  const refreshFull = useCallback(async (silent = false) => {
    if (fullBusyRef.current) return;
    fullBusyRef.current = true;
    setRefreshing(true);
    try {
      const live = await refreshLiveRates([sRef.current.from, sRef.current.to]);
      let nextProviders = providersRef.current;
      let placesMode = dataRef.current.source?.places ?? 'seed';
      if (!placesEnrichedRef.current) {
        const enriched = await enrichFromGoogle(providersRef.current);
        nextProviders = enriched.providers;
        placesMode = enriched.enriched ? 'google' : 'seed';
        placesEnrichedRef.current = true;
      }
      setData((d) => {
        const next = {
          ...d,
          providers: nextProviders,
          mid: live.mid,
          perUsd: live.perUsd,
          prevPerUsd: live.prevPerUsd,
          prevMid: live.prevMid,
          updatedAt: live.updatedAt,
          quotedAt: live.quotedAt,
          quoteTimes: live.quoteTimes,
          dailyCodes: live.dailyCodes ?? [],
          sourceInfo: live.sourceInfo,
          sourceStatus: live.sourceStatus,
          liveHost: live.host,
          source: { ...d.source, rates: live.host, places: placesMode },
        };
        saveWarmSnapshot(next);
        return next;
      });
      setStatus({
        tone: 'ok',
        text: `Live consensus across ${live.sourcesUsed?.length ?? 1}/${live.sourcesTried ?? 1} feeds (${live.host}), synced ${fmtTimeSec(live.updatedAt)} GST.`,
      });
    } catch (e) {
      setStatus({ tone: 'err', text: silent ? `${e.message} Auto-retrying…` : e.message });
    } finally {
      fullBusyRef.current = false;
      setRefreshing(false);
    }
  }, []);

  const refreshSpot = useCallback(async () => {
    if (spotBusyRef.current || fullBusyRef.current) return;
    if (!dataRef.current.perUsd) return;
    spotBusyRef.current = true;
    try {
      const { data: nextData, changed } = await refreshSpotRates(
        dataRef.current,
        [sRef.current.from, sRef.current.to],
      );
      setData(nextData);
      saveWarmSnapshot(nextData);
      triggerFlash(changed);
      setStatus({
        tone: 'ok',
        text: `Live spot stream active (${nextData.liveHost || 'Yahoo Finance FX spot'}), synced ${fmtTimeSec(nextData.updatedAt)} GST.`,
      });
    } catch {
      /* keep last live consensus if transient spot poll fails; full loop retries */
    } finally {
      spotBusyRef.current = false;
    }
  }, [triggerFlash]);

  useEffect(() => {
    refreshFull(true);
    const fullId = setInterval(() => {
      if (document.visibilityState === 'visible') refreshFull(true);
    }, FULL_CONSENSUS_INTERVAL_MS);
    const spotId = setInterval(() => {
      if (document.visibilityState === 'visible') refreshSpot();
    }, LIVE_SPOT_INTERVAL_MS);
    const onWake = () => {
      if (document.visibilityState === 'visible') refreshSpot();
    };
    document.addEventListener('visibilitychange', onWake);
    window.addEventListener('focus', onWake);
    window.addEventListener('online', onWake);
    return () => {
      clearInterval(fullId);
      clearInterval(spotId);
      document.removeEventListener('visibilitychange', onWake);
      window.removeEventListener('focus', onWake);
      window.removeEventListener('online', onWake);
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    };
  }, [refreshFull, refreshSpot]);

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Immediately pull spot quotes if the user switches to a currency not yet spot-quoted
  useEffect(() => {
    if (!dataRef.current.perUsd) return;
    const fromSpot = dataRef.current.sourceInfo?.[s.from]?.source === 'yahoo' || s.from === 'USD';
    const toSpot = dataRef.current.sourceInfo?.[s.to]?.source === 'yahoo' || s.to === 'USD';
    if (!fromSpot || !toSpot) refreshSpot();
  }, [s.from, s.to, refreshSpot]);

  const pairMid = (data.mid[s.to] && data.mid[s.from]) ? data.mid[s.to] / data.mid[s.from] : 1;

  // Keep real historical 24H and active trendRange charts anchored to live mid-rate
  useEffect(() => {
    let cancelled = false;
    fetchPairHistory(s.from, s.to, '24H', pairMid).then((res) => {
      if (!cancelled) setLiveHistory24h(res);
    });
    if (trendRange !== '24H') {
      fetchPairHistory(s.from, s.to, trendRange, pairMid).then((res) => {
        if (!cancelled) setLiveTrendSeries(res);
      });
    }
    return () => { cancelled = true; };
  }, [s.from, s.to, trendRange, pairMid]);

  const area = AREAS.find((a) => a.id === s.areaId) ?? AREAS[0];
  const pairQuotedAt = useMemo(() => {
    const times = data.quoteTimes ? [s.from, s.to].map((c) => data.quoteTimes[c]).filter(Boolean) : [];
    return times.length ? new Date(Math.min(...times.map((d) => d.getTime()))) : data.quotedAt;
  }, [data.quoteTimes, data.quotedAt, s.from, s.to]);

  const pairDaily = !!data.liveHost && (data.dailyCodes ?? []).some((c) => c === s.from || c === s.to);
  const quoteAgeMin = pairQuotedAt ? (nowMs - pairQuotedAt.getTime()) / 60000 : 0;
  const quoteStale = (!data.liveHost && status.tone === 'err') || (!pairDaily && quoteAgeMin > 24 * 60);
  const hasRatings = useMemo(() => data.providers.some((p) => p.rating != null), [data.providers]);
  const codes = useMemo(() => Object.keys(data.mid), [data.mid]);
  const pairNote = useMemo(() => pairNoteFor(data, s.from, s.to), [data.sourceInfo, s.from, s.to]); // eslint-disable-line react-hooks/exhaustive-deps
  const triggeredAlerts = useMemo(() => evaluateTriggeredAlerts(alerts, data.mid), [alerts, data.mid]);

  const origin = originFor(s, userLoc);
  const PAGE = 12;
  const [shown, setShown] = useState(PAGE);
  const filterSig = JSON.stringify([s.query, s.sort, s.type, s.minRating, s.openNow, s.areaId, s.emirates, s.from, s.to, s.mode, s.channel]);
  useEffect(() => { setShown(PAGE); }, [filterSig]);

  // All rows before type filter (for accurate category counts)
  const baseRows = useMemo(
    () => deriveRows(data, { ...s, type: 'all' }, picked, origin),
    [data, s.query, s.minRating, s.openNow, s.areaId, s.emirates, s.from, s.to, s.mode, s.channel, picked, origin[0], origin[1]], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const counts = useMemo(() => ({
    all: baseRows.length,
    exchange: baseRows.filter((r) => r.provider.type === 'exchange').length,
    bank: baseRows.filter((r) => r.provider.type === 'bank').length,
  }), [baseRows]);

  const rows = useMemo(
    () => (s.type === 'all' ? baseRows : baseRows.filter((r) => r.provider.type === s.type)),
    [baseRows, s.type],
  );

  const specificArea = isSpecificArea(s, userLoc);
  const sorted = useMemo(() => sortRows(rows, s, specificArea), [rows, s.sort, s.mode, specificArea]); // eslint-disable-line react-hooks/exhaustive-deps
  const sortedRef = useRef(sorted);
  sortedRef.current = sorted;

  // Sync live conversion rate to the browser tab title
  useEffect(() => {
    const defaultTitle = 'Xchange Desk · UAE exchange rate comparison';
    if (PageView || !pairMid) {
      document.title = defaultTitle;
      return undefined;
    }
    const digits = rateDigits(pairMid);
    document.title = `1 ${s.from} = ${pairMid.toFixed(digits)} ${s.to} · Xchange Desk`;
    return () => { document.title = defaultTitle; };
  }, [PageView, s.from, s.to, pairMid]);

  // Keyboard shortcuts when focus is outside form fields: "/" search, "r" sync, "s" swap currencies
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      if (e.key === '/') {
        const input = document.getElementById('storeSearch');
        if (input) {
          e.preventDefault();
          input.focus();
          input.select?.();
        }
      } else if (e.key === 'r' || e.key === 'R') {
        refreshFull(false);
      } else if (e.key === 's' || e.key === 'S') {
        set({ from: sRef.current.to, to: sRef.current.from });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [refreshFull, set]);

  // Programmatic browser JavaScript API for live state, rate queries, and CSV export
  useEffect(() => {
    window.XchangeDesk = {
      getState: () => ({ ...sRef.current }),
      getMidRate: (from = sRef.current.from, to = sRef.current.to) => {
        const mid = dataRef.current.mid;
        return mid?.[from] && mid?.[to] ? mid[to] / mid[from] : null;
      },
      getTopProviders: (limit = 5) => sortedRef.current.slice(0, limit).map((r) => ({
        id: r.provider.id,
        name: r.provider.name,
        type: r.provider.type,
        rate: sRef.current.mode === 'sell' ? r.q.sellRate : r.q.buyRate,
        fee: sRef.current.channel === 'bank' ? r.q.feeBase : 0,
        total: r.total,
        marginPct: r.q.marginPct,
      })),
      setPair: (from, to, amount) => {
        const patch = { from: String(from || 'AED').toUpperCase(), to: String(to || 'INR').toUpperCase() };
        if (amount != null && Number(amount) > 0) {
          patch.amount = Number(amount);
          patch.amountText = String(amount);
        }
        set(patch);
      },
      refreshRates: () => refreshFull(false),
      exportTopCsv: (limit = 10) => downloadComparisonCsv(sortedRef.current.slice(0, limit), sRef.current),
    };
    return () => { delete window.XchangeDesk; };
  }, [set, refreshFull]);

  const metrics = useMemo(
    () => computeDashboardMetrics(rows, s, data.providers),
    [rows, s.mode, s.channel, data.providers], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const stats = useMemo(() => {
    if (!rows.length) return null;
    const totals = rows.map((r) => r.total);
    const bestRate = rows.reduce((a, b) => ((s.mode === 'sell' ? b.total > a.total : b.total < a.total) ? b : a));
    const rated = rows.filter((r) => r.provider.rating != null);
    const topRated = rated.length ? rated.reduce((a, b) => (b.provider.rating > a.provider.rating ? b : a)) : null;
    const mostBr = rows.reduce((a, b) => (b.branches.length > a.branches.length ? b : a));
    return { min: Math.min(...totals), max: Math.max(...totals), bestRate, topRated, mostBr };
  }, [rows, s.mode]);

  const pins = useMemo(() => rows.flatMap((r) => r.branches.map((b) => {
    const rate = s.mode === 'sell' ? r.q.sellRate : r.q.buyRate;
    return { p: r.provider, b, rate, digits: rateDigits(Math.max(r.q.sellRate, r.q.buyRate)), dist: userLoc ? km(origin, [b.lat, b.lng]) : null };
  })), [rows, s.mode, userLoc]); // eslint-disable-line react-hooks/exhaustive-deps

  const nearest = useMemo(() => (userLoc ? [...pins].sort((a, b) => a.dist - b.dist).slice(0, 3) : []), [pins, userLoc]);
  const selected = pins.find((x) => x.p.id === sel?.pid && x.b.id === sel?.bid) ?? null;

  const onMapRef = useRef(null);
  const onMap = (pid, bid) => {
    setSel({ pid, bid });
    setPanel('map');
    if (window.innerWidth < 1280) panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  onMapRef.current = onMap;

  const onReviews = (pid) => {
    setReviewPid(pid);
    setPanel('reviews');
    if (window.innerWidth < 1280) panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const toggleCompare = (id) => setCompare((c) => (c.includes(id) ? c.filter((x) => x !== id) : c.length < 4 ? [...c, id] : c));
  useEffect(() => { setCompare((c) => c.filter((id) => rows.some((r) => r.provider.id === id))); }, [rows]); // eslint-disable-line react-hooks/exhaustive-deps
  const compareRows = compare.map((id) => rows.find((r) => r.provider.id === id)).filter(Boolean);

  const badgeFor = (r) => {
    if (!stats) return [];
    const b = [];
    if (r === stats.bestRate) b.push(BADGE.rate);
    if (stats.topRated && r === stats.topRated) b.push(BADGE.rating);
    if (r === stats.mostBr && r.branches.length > 1) b.push(BADGE.branches);
    return b;
  };

  const handleNavTab = (tabId) => {
    if (tabId === 'alerts') {
      setAlertsOpen(true);
      return;
    }
    if (tabId === 'calculator') {
      setCalcOpen(true);
      return;
    }
    setActiveTab(tabId);
    if (tabId === 'comparison') {
      resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (tabId === 'trends') {
      trendsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const chatApp = useMemo(() => ({
    state: () => sRef.current,
    data: () => dataRef.current,
    userLoc: () => userLocRef.current,
    picked: () => pickedRef.current,
    compare: () => compareRef.current,
    set,
    setCompare,
    locate,
    focus: (pid, bid) => { setPicked((x) => ({ ...x, [pid]: bid })); onMapRef.current(pid, bid); },
  }), [set, setCompare, locate]);

  return (
    <>
      {PageView && (
        <Suspense fallback={<p className="p-6 text-sm text-steel-600" role="status">Loading…</p>}>
          <PageView data={data} />
        </Suspense>
      )}

      <div id="top" hidden={!!PageView} className="min-h-screen flex flex-col" style={{ paddingBottom: compareRows.length >= 1 ? '5.5rem' : '0' }}>
        <TopTicker
          mid={data.mid}
          prevMid={data.prevMid}
          live={!!data.liveHost}
          syncing={refreshing}
          flashMap={flashMap}
          onSelectPair={(from, to) => set({ from, to, mode: 'sell' })}
        />

        <HeaderNav
          activeTab={activeTab}
          onSelectTab={handleNavTab}
          query={s.query}
          onQueryChange={(q) => set({ query: q })}
          providers={data.providers}
          alertCount={triggeredAlerts.length || alerts.length}
          onOpenAlerts={() => setAlertsOpen(true)}
          onOpenQr={() => setQrOpen(true)}
          onSearchSubmit={() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
        />

        <SyncStrip
          status={status}
          pairNote={pairNote}
          updatedAt={data.updatedAt}
          fmtTimeSec={fmtTimeSec}
          live={!!data.liveHost}
          userLoc={userLoc}
          geo={geo}
          onLocate={locate}
          onClearLoc={() => setUserLoc(null)}
          onRefresh={() => refreshFull(false)}
          refreshing={refreshing}
          providerCount={data.providers.length}
        />

        <main className="mx-auto w-full max-w-[1440px] flex-1 space-y-4 px-4 py-5 sm:px-6">
          {quoteStale && (
            <p className="rounded-lg border border-amber-300 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-900" role="alert">
              <strong>The market quote for {s.from}/{s.to} is {ageLabel(pairQuotedAt)} old.</strong> Currency markets may be closed (weekends) or the feed may be delayed, so treat the figures below as indicative guides.
            </p>
          )}

          {triggeredAlerts.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3.5 py-2.5 text-xs text-emerald-900" role="status">
              <div>
                <strong className="uppercase tracking-wider">Live Alert Triggered:</strong>{' '}
                {triggeredAlerts[0].from} → {triggeredAlerts[0].to} reached{' '}
                <span className="font-mono font-bold">
                  {triggeredAlerts[0].currentMid.toFixed(triggeredAlerts[0].digits || 4)}
                </span>{' '}
                (target ≥ {triggeredAlerts[0].target.toFixed(triggeredAlerts[0].digits || 4)}).
                {triggeredAlerts.length > 1 && ` (+${triggeredAlerts.length - 1} more)`}
              </div>
              <button
                type="button"
                onClick={() => setAlertsOpen(true)}
                className="rounded border border-emerald-300 bg-white px-2.5 py-1 text-xs font-bold text-go hover:bg-emerald-100"
              >
                Manage Alerts
              </button>
            </div>
          )}

          {/* Mobile Search Input (visible when header search is hidden on narrow screens) */}
          <div className="sm:hidden">
            <input
              type="search"
              value={s.query}
              onChange={(e) => set({ query: e.target.value })}
              placeholder="Search providers, areas or addresses…"
              aria-label="Search providers on mobile"
              className="field bg-white text-sm"
            />
          </div>

          <HeroMatrix
            s={s}
            set={set}
            codes={codes}
            mid={data.mid}
            metrics={metrics}
            providerCount={sorted.length}
            specificArea={specificArea}
            areaLabel={area.label}
            userLoc={userLoc}
            onCompareProviders={() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            onOpenAlertModal={() => setAlertsOpen(true)}
          />

          <KpiStrip
            s={s}
            mid={data.mid}
            prevMid={data.prevMid}
            metrics={metrics}
            pairDaily={pairDaily}
            updatedAt={data.updatedAt}
            live={!!data.liveHost}
            liveSeries24h={liveHistory24h}
            nowMs={nowMs}
          />

          {/* Main 2-column workspace */}
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_390px] xl:items-start">
            <section ref={resultsRef} className="min-w-0 space-y-3 scroll-mt-20" aria-label="Exchange providers comparison list">
              <OperatorFilters
                s={s}
                set={set}
                totalCount={sorted.length}
                counts={counts}
                hasRatings={hasRatings}
              />

              {userLoc && (
                <section className="panel p-4" aria-label="Nearest branches to you">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-display text-lg font-bold uppercase tracking-wide text-ink">Nearest Branches To You</h3>
                    <span className="text-xs text-steel-500">
                      GPS straight-line distance{userLoc.acc > 500 ? ` (±${Math.round(userLoc.acc)} m)` : ''}
                    </span>
                  </div>
                  {nearest.length === 0 ? (
                    <p className="mt-2 text-xs text-steel-500">No branches match the current filters.</p>
                  ) : (
                    <ol className="mt-2.5 grid gap-2.5 md:grid-cols-3">
                      {nearest.map((x, i) => (
                        <li key={x.b.id} className="well flex flex-col justify-between gap-1.5 p-3">
                          <div className="flex items-center gap-2">
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-go text-[11px] font-bold text-white">{i + 1}</span>
                            <strong className="min-w-0 truncate text-xs text-ink">{x.p.name}</strong>
                          </div>
                          <p className="text-xs text-steel-600">
                            {x.b.area} · <strong className="text-ink">{x.dist < 1 ? `${Math.round(x.dist * 1000)} m` : `${x.dist.toFixed(1)} km`}</strong> · {fmtNum(x.rate, x.digits)}
                          </p>
                          <div className="flex gap-2">
                            <button type="button" className="btn btn-sm flex-1" onClick={() => onMap(x.p.id, x.b.id)}>On map</button>
                            <a className="btn btn-sm flex-1" href={directionsUrl(x.b, x.p)} target="_blank" rel="noreferrer">Directions ↗</a>
                          </div>
                        </li>
                      ))}
                    </ol>
                  )}
                </section>
              )}

              {sorted.length === 0 && (
                <div className="panel p-8 text-center">
                  <p className="font-display text-xl font-bold uppercase text-ink">No exchange houses match</p>
                  <p className="mt-1 text-sm text-steel-600">Try a different search query, or reset the open-now, type, or location filters.</p>
                  <button
                    type="button"
                    onClick={() => set({
                      query: '',
                      minRating: 0,
                      openNow: false,
                      emirates: Object.fromEntries(EMIRATES.map((e) => [e, true])),
                      type: 'all',
                      sort: 'rate',
                      areaId: 'all',
                    })}
                    className="btn btn-primary mt-4"
                  >
                    Reset All Filters
                  </button>
                </div>
              )}

              <div className="space-y-3">
                {sorted.slice(0, shown).map((r, idx) => (
                  <ProviderCard
                    key={r.provider.id}
                    row={r}
                    rank={idx + 1}
                    s={s}
                    quotedAt={pairQuotedAt}
                    live={!!data.liveHost}
                    daily={pairDaily}
                    distKm={userLoc ? km(origin, [r.branch.lat, r.branch.lng]) : null}
                    selected={sel?.pid === r.provider.id}
                    badges={badgeFor(r)}
                    savings={stats ? (s.mode === 'sell' ? r.total - stats.min : stats.max - r.total) : 0}
                    bestTotal={stats ? (s.mode === 'sell' ? stats.max : stats.min) : null}
                    compared={compare.includes(r.provider.id)}
                    compareDisabled={compare.length >= 4}
                    onCompare={toggleCompare}
                    onMap={onMap}
                    onReviews={onReviews}
                    hasRatings={hasRatings}
                    onPickBranch={(pid, bid) => { setPicked((x) => ({ ...x, [pid]: bid })); setSel({ pid, bid }); }}
                  />
                ))}
              </div>

              {sorted.length > shown && (
                <div className="flex justify-center pt-2">
                  <button type="button" className="btn" onClick={() => setShown((n) => n + PAGE)}>
                    Show {Math.min(PAGE, sorted.length - shown)} more providers ({sorted.length - shown} remaining)
                  </button>
                </div>
              )}
            </section>

            <RightRail
              s={s}
              data={data}
              metrics={metrics}
              panel={panel}
              setPanel={setPanel}
              MapBoundary={MapBoundary}
              MapPanel={MapPanel}
              pins={pins}
              sel={sel}
              selected={selected}
              onMap={onMap}
              bestId={stats?.bestRate.provider.id}
              userLoc={userLoc}
              nearest={nearest}
              reviewPid={reviewPid}
              panelRef={panelRef}
              trendsRef={trendsRef}
              trendRange={trendRange}
              onTrendRangeChange={setTrendRange}
              liveTrendSeries={trendRange === '24H' ? liveHistory24h : liveTrendSeries}
            />
          </div>

          {/* What to bring & disclaimer */}
          <section aria-label="What to bring and estimates notice" className="panel p-4 sm:p-5 text-xs leading-relaxed text-steel-600">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <h2 className="font-display text-base font-bold uppercase tracking-wide text-ink">Counter Requirements &amp; Limits</h2>
                <ul className="mt-1.5 list-disc space-y-1 pl-4">
                  <li><strong className="text-ink">Photo ID:</strong> UAE exchange houses require an original Emirates ID (residents) or passport (visitors).</li>
                  <li><strong className="text-ink">Cash vs. Bank Transfer:</strong> Cash gets the board rate with no flat fee; bank transfers add a flat fee with a tighter spread.</li>
                </ul>
              </div>
              <div>
                <h2 className="font-display text-base font-bold uppercase tracking-wide text-ink">Indicative Rate Notice</h2>
                <p className="mt-1.5">
                  Market mid-rates are live consensus across public feeds. Provider rates are estimates modelled from typical spreads; branch locations and hours come from OpenStreetMap (© OpenStreetMap contributors). Confirm final counter rates before transacting.
                </p>
              </div>
            </div>
          </section>
        </main>

        {/* Footer */}
        <footer className="border-t border-steel-200 bg-white">
          <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3 px-4 py-4 text-xs text-steel-500 sm:px-6">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="font-display text-sm font-bold uppercase tracking-wide text-ink">
                DXB <span className="text-sky">FX</span>
              </span>
              <span className="font-semibold uppercase tracking-wider text-steel-600">
                Xchange Desk · UAE Exchange Comparison Terminal
              </span>
              <span className="hidden md:inline text-steel-300" aria-hidden="true">|</span>
              <span className="hidden md:inline">
                Rates: {data.updatedAt ? `${fmtTimeSec(data.updatedAt)} GST` : 'Connecting…'} · Branches: {new Date(__OSM_FETCHED__).toLocaleDateString('en-GB', { timeZone: 'Asia/Dubai', day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            </div>
            <SiteNav current="/" />
          </div>
        </footer>

        <CompareDock
          rows={compareRows}
          s={s}
          onOpenMatrix={() => setMatrixOpen(true)}
          onClear={() => setCompare([])}
        />

        <CompareTray
          rows={compareRows}
          s={s}
          open={matrixOpen}
          onClose={() => setMatrixOpen(false)}
          onRemove={toggleCompare}
          onClear={() => setCompare([])}
        />

        <RateAlertsModal
          open={alertsOpen}
          onClose={() => setAlertsOpen(false)}
          s={s}
          mid={data.mid}
          bestRow={stats?.bestRate ?? null}
          alerts={alerts}
          onAddAlert={(al) => setAlerts((prev) => [al, ...prev])}
          onRemoveAlert={(id) => setAlerts((prev) => prev.filter((a) => a.id !== id))}
        />

        <MultiTransferModal
          open={calcOpen}
          onClose={() => setCalcOpen(false)}
          rows={sorted}
          s={s}
        />

        {qrOpen && <QrModal onClose={() => setQrOpen(false)} />}
        <ChatLauncher app={chatApp} lift={compareRows.length >= 1} />
      </div>
    </>
  );
}
