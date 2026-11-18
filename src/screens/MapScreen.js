import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../state/AppState.js';
import { AREAS } from '../data/seed.js';
import { fmtNum, km, rateDigits, mapsUrl } from '../lib/pricing.js';
import { Button, Card } from '../components/ui.js';
import { C } from '../theme.js';

// The map is MapLibre (native, free, no API key) drawing OpenFreeMap tiles: the same OpenStreetMap-based map as the website.
// It needs a real build, so it is not available in Expo Go or on web; there we show a branch list instead.
// The module is loaded only where it can work, so a missing native module can never take the app down.
const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';
const inExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
const nativeMapOk = Platform.OS !== 'web' && !inExpoGo;
let ML = null;
if (nativeMapOk) { try { ML = require('@maplibre/maplibre-react-native'); } catch { ML = null; } }
const MAX_PINS = 250;
const zoomFor = (delta) => Math.max(3, Math.min(17, Math.log2(360 / delta)));

export default function MapScreen({ navigation, route }) {
  const { s, userLoc, origin, sorted, best } = useApp();
  const ref = useRef(null);

  const pins = useMemo(() => {
    const all = sorted.slice(0, 80).flatMap((r) => r.branches.map((b) => ({ r, b, d: km(origin, [b.lat, b.lng]) })));
    return all.sort((a, b) => a.d - b.d).slice(0, MAX_PINS);
  }, [sorted, origin]);

  const view = useMemo(() => {
    const a = AREAS.find((x) => x.id === s.areaId);
    const [lat, lng] = userLoc ? [userLoc.lat, userLoc.lng] : a?.center ?? [24.9, 54.9];
    const wide = !userLoc && (!a || a.kind === 'all');
    const delta = wide ? 2.6 : a?.kind === 'emirate' && !userLoc ? 0.6 : 0.08;
    return { center: [lng, lat], zoom: zoomFor(delta) };
  }, [s.areaId, userLoc]);
  const firstView = useRef(view);

  const [picked, setPicked] = useState(null); // { pid, bid }
  const geo = useMemo(() => ({
    type: 'FeatureCollection',
    features: pins.map(({ r, b }) => ({
      type: 'Feature',
      properties: { pid: r.provider.id, bid: b.id, best: r === best ? 1 : 0 },
      geometry: { type: 'Point', coordinates: [b.lng, b.lat] },
    })),
  }), [pins, best]);
  const me = useMemo(() => ({
    type: 'FeatureCollection',
    features: userLoc ? [{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [userLoc.lng, userLoc.lat] } }] : [],
  }), [userLoc]);
  const sel = useMemo(() => {
    if (!picked) return null;
    const hit = pins.find((p) => p.r.provider.id === picked.pid && p.b.id === picked.bid);
    if (hit) return hit;
    const r = sorted.find((x) => x.provider.id === picked.pid);
    const b = r?.branches.find((x) => x.id === picked.bid);
    return r && b ? { r, b, d: km(origin, [b.lat, b.lng]) } : null;
  }, [picked, pins, sorted, origin]);

  useEffect(() => { if (view !== firstView.current) ref.current?.easeTo?.({ center: view.center, zoom: view.zoom, duration: 500 }); }, [view]);

  // "On map" from a provider screen: fly to that branch and select it.
  const focus = route.params?.focus;
  useEffect(() => {
    if (!focus) return;
    const r = sorted.find((x) => x.provider.id === focus.pid);
    const b = r?.branches.find((x) => x.id === focus.bid);
    if (!b) return;
    setPicked({ pid: focus.pid, bid: focus.bid });
    ref.current?.flyTo?.({ center: [b.lng, b.lat], zoom: 15, duration: 800 });
  }, [focus, sorted]);

  const onPinPress = useCallback((e) => {
    const f = e?.nativeEvent?.features?.[0]?.properties;
    if (f?.pid) { e.stopPropagation?.(); setPicked({ pid: f.pid, bid: f.bid }); }
  }, []);

  const openStore = useCallback((r, b) => navigation.navigate('Store', { pid: r.provider.id, bid: b.id }), [navigation]);
  const place = (b) => (b.area === b.emirate ? b.emirate : `${b.area}, ${b.emirate}`);
  const dist = (d) => (d < 1 ? `${Math.round(d * 1000)} m` : `${d.toFixed(1)} km`);

  // Tapping the name/details part opens the store; the buttons stay siblings so screen readers can still reach them.
  const storeCard = (r, b, d, rate) => (
    <Card style={{ gap: 6 }}>
      <Pressable
        accessibilityRole="button" accessibilityLabel={`${r.provider.name}, ${place(b)}. Open store`}
        onPress={() => openStore(r, b)} style={({ pressed }) => [{ gap: 4 }, pressed && { opacity: 0.6 }]}
      >
        <Text style={st.name}>{r.provider.name}</Text>
        <Text style={st.s}>{place(b)} · {dist(d)} · {fmtNum(rate, rateDigits(rate))} {s.to} per {s.from}</Text>
      </Pressable>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button small kind="primary" icon="storefront-outline" title="Open store" onPress={() => openStore(r, b)} />
        <Button small icon="open-outline" title="Google Maps" onPress={() => Linking.openURL(mapsUrl(b, r.provider)).catch(() => {})} />
      </View>
    </Card>
  );

  if (!ML) {
    const web = Platform.OS === 'web';
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top']}>
        <FlatList
          data={pins.slice(0, 40)} keyExtractor={(x) => x.b.id} contentContainerStyle={{ padding: 16, gap: 10 }}
          ListHeaderComponent={(
            <View style={{ gap: 4, marginBottom: 6 }}>
              <Text style={st.t}>Nearby branches</Text>
              <Text style={st.s}>{web ? 'The interactive map is available in the iPhone and Android apps.' : 'The interactive map needs the installed app (it is not available in Expo Go), so here are the closest matching branches. Tap one to open the store, or open it in Google Maps.'} {pins.length} match your search.</Text>
            </View>
          )}
          renderItem={({ item: { r, b, d } }) => storeCard(r, b, d, s.mode === 'sell' ? r.q.sellRate : r.q.buyRate)}
        />
      </SafeAreaView>
    );
  }
  const { Map: MapView, Camera, GeoJSONSource, Layer } = ML;
  const rate = sel ? (s.mode === 'sell' ? sel.r.q.sellRate : sel.r.q.buyRate) : 0;
  return (
    <View style={{ flex: 1 }}>
      <MapView style={{ flex: 1 }} mapStyle={STYLE_URL} onPress={() => setPicked(null)} accessibilityLabel="Map of matching branches">
        <Camera ref={ref} initialViewState={{ center: firstView.current.center, zoom: firstView.current.zoom }} />
        <GeoJSONSource id="branches" data={geo} onPress={onPinPress}>
          <Layer
            id="branch-pins" type="circle"
            paint={{
              'circle-radius': ['case', ['==', ['get', 'best'], 1], 9, 7],
              'circle-color': ['case', ['==', ['get', 'best'], 1], C.go, C.sky],
              'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2,
            }}
          />
        </GeoJSONSource>
        <GeoJSONSource id="me" data={me}>
          <Layer id="me-dot" type="circle" paint={{ 'circle-radius': 7, 'circle-color': '#1a73e8', 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 3 }} />
        </GeoJSONSource>
      </MapView>
      <SafeAreaView edges={['top']} style={st.overlay} pointerEvents="none">
        <View style={st.chip}><Text style={st.chipText}>{pins.length} branches · green = best rate · tap a pin</Text></View>
      </SafeAreaView>
      {sel && <View style={st.sheet}>{storeCard(sel.r, sel.b, sel.d, rate)}</View>}
      <Text style={st.attr} pointerEvents="none">© OpenStreetMap contributors · OpenFreeMap · OpenMapTiles</Text>
    </View>
  );
}

const st = StyleSheet.create({
  fallback: { flex: 1, padding: 24, backgroundColor: C.bg, justifyContent: 'center', gap: 8 },
  t: { fontSize: 24, fontWeight: '800', color: C.ink }, s: { fontSize: 14, color: C.muted, lineHeight: 20 }, name: { fontSize: 16, fontWeight: '800', color: C.ink },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center' },
  chip: { marginTop: 8, backgroundColor: 'rgba(255,255,255,.92)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  sheet: { position: 'absolute', left: 12, right: 12, bottom: 24 },
  attr: { position: 'absolute', right: 6, bottom: 4, fontSize: 9, color: 'rgba(0,0,0,.6)', backgroundColor: 'rgba(255,255,255,.7)', paddingHorizontal: 4, borderRadius: 3 },
  chipText: { fontSize: 12, fontWeight: '600', color: C.ink },
});
