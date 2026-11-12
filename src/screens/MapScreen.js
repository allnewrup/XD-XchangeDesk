import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { FlatList, Linking, Platform, StyleSheet, Text, View } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../state/AppState.js';
import { AREAS } from '../data/seed.js';
import { fmtNum, km, rateDigits, mapsUrl } from '../lib/pricing.js';
import { Button, Card } from '../components/ui.js';
import { C } from '../theme.js';

// The native map needs: iOS (Apple Maps, no key), Expo Go (Expo's own key), or Android with a Google Maps API key in the build.
// On Android without a key the Google Maps SDK crashes the whole app when a map is created, so we never create one then
// and show a branch list instead. react-native-maps is loaded only when it can work (it does not exist on web).
const inExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
const hasAndroidKey = !!Constants.expoConfig?.android?.config?.googleMaps?.apiKey;
const nativeMapOk = Platform.OS === 'ios' || (Platform.OS === 'android' && (inExpoGo || hasAndroidKey));
let Maps = null;
if (nativeMapOk) { try { Maps = require('react-native-maps'); } catch { Maps = null; } }
const MAX_PINS = 250;

export default function MapScreen({ navigation, route }) {
  const { s, userLoc, origin, sorted, best } = useApp();
  const ref = useRef(null);

  const pins = useMemo(() => {
    const all = sorted.slice(0, 80).flatMap((r) => r.branches.map((b) => ({ r, b, d: km(origin, [b.lat, b.lng]) })));
    return all.sort((a, b) => a.d - b.d).slice(0, MAX_PINS);
  }, [sorted, origin]);

  const region = useMemo(() => {
    const a = AREAS.find((x) => x.id === s.areaId);
    const [lat, lng] = userLoc ? [userLoc.lat, userLoc.lng] : a?.center ?? [24.9, 54.9];
    const wide = !userLoc && (!a || a.kind === 'all');
    return { latitude: lat, longitude: lng, latitudeDelta: wide ? 2.6 : a?.kind === 'emirate' && !userLoc ? 0.6 : 0.08, longitudeDelta: wide ? 2.6 : a?.kind === 'emirate' && !userLoc ? 0.6 : 0.08 };
  }, [s.areaId, userLoc]);

  useEffect(() => { ref.current?.animateToRegion?.(region, 400); }, [region]);

  // "On map" from a provider screen: fly to that branch.
  const focus = route.params?.focus;
  useEffect(() => {
    if (!focus) return;
    const hit = pins.find((p) => p.r.provider.id === focus.pid && p.b.id === focus.bid);
    const b = hit?.b ?? sorted.find((r) => r.provider.id === focus.pid)?.branches.find((x) => x.id === focus.bid);
    if (b) ref.current?.animateToRegion?.({ latitude: b.lat, longitude: b.lng, latitudeDelta: 0.01, longitudeDelta: 0.01 }, 500);
  }, [focus, pins, sorted]);

  const open = useCallback((id) => navigation.navigate('Provider', { id }), [navigation]);

  if (!Maps) {
    const web = Platform.OS === 'web';
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top']}>
        <FlatList
          data={pins.slice(0, 40)} keyExtractor={(x) => x.b.id} contentContainerStyle={{ padding: 16, gap: 10 }}
          ListHeaderComponent={(
            <View style={{ gap: 4, marginBottom: 6 }}>
              <Text style={st.t}>Nearby branches</Text>
              <Text style={st.s}>{web ? 'The interactive map is available in the iPhone and Android apps.' : 'The in-app map is not enabled in this build, so here are the closest matching branches. Tap one for details, or open it in Google Maps.'} {pins.length} match your search.</Text>
            </View>
          )}
          renderItem={({ item: { r, b, d } }) => (
            <Card style={{ gap: 6 }}>
              <Text style={st.name}>{r.provider.name}</Text>
              <Text style={st.s}>{b.area === b.emirate ? b.emirate : `${b.area}, ${b.emirate}`} · {d < 1 ? `${Math.round(d * 1000)} m` : `${d.toFixed(1)} km`} · {fmtNum(s.mode === 'sell' ? r.q.sellRate : r.q.buyRate, rateDigits(r.q.sellRate))} {s.to} per {s.from}</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Button small title="Details" onPress={() => open(r.provider.id)} />
                <Button small icon="open-outline" title="Google Maps" onPress={() => Linking.openURL(mapsUrl(b, r.provider)).catch(() => {})} />
              </View>
            </Card>
          )}
        />
      </SafeAreaView>
    );
  }
  const { default: MapView, Marker } = Maps;
  return (
    <View style={{ flex: 1 }}>
      <MapView ref={ref} style={{ flex: 1 }} initialRegion={region} showsUserLocation={!!userLoc} showsMyLocationButton={false} accessibilityLabel="Map of matching branches">
        {pins.map(({ r, b }) => {
          const rate = s.mode === 'sell' ? r.q.sellRate : r.q.buyRate;
          return (
            <Marker
              key={b.id} coordinate={{ latitude: b.lat, longitude: b.lng }} pinColor={r === best ? C.go : C.sky} tracksViewChanges={false}
              title={r.provider.name} description={`${fmtNum(rate, rateDigits(rate))} ${s.to} per ${s.from} · ${b.area}`} onCalloutPress={() => open(r.provider.id)}
            />
          );
        })}
      </MapView>
      <SafeAreaView edges={['top']} style={st.overlay} pointerEvents="none">
        <View style={st.chip}><Text style={st.chipText}>{pins.length} branches · green = best rate · tap a pin, then its label for details</Text></View>
      </SafeAreaView>
    </View>
  );
}

const st = StyleSheet.create({
  fallback: { flex: 1, padding: 24, backgroundColor: C.bg, justifyContent: 'center', gap: 8 },
  t: { fontSize: 24, fontWeight: '800', color: C.ink }, s: { fontSize: 14, color: C.muted, lineHeight: 20 }, name: { fontSize: 16, fontWeight: '800', color: C.ink },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center' },
  chip: { marginTop: 8, backgroundColor: 'rgba(255,255,255,.92)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  chipText: { fontSize: 12, fontWeight: '600', color: C.ink },
});
