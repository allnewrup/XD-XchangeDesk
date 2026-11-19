import React, { useMemo } from 'react';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../state/AppState.js';
import { quote, convert, fmtNum, rateDigits, hoursLabel, isOpenNow, km, directionsUrl, mapsUrl } from '../lib/pricing.js';
import { C } from '../theme.js';
import { Banner, Button, Card, Label, Mark, Pill, mono } from '../components/ui.js';

const placeLabel = (b) => (b.area === b.emirate ? b.emirate : `${b.area}, ${b.emirate}`);

/**
 * The store's own OSM name when it adds something, minus a leading company name
 * ("Al Ansari Exchange, Dubai Festival Plaza Branch" -> "Dubai Festival Plaza Branch"); otherwise "<area> branch".
 */
export function storeName(b, p) {
  let n = (b.osmName ?? '').trim();
  if (n.toLowerCase().startsWith(p.name.toLowerCase())) n = n.slice(p.name.length).replace(/^[\s,\-–—:|]+/, '');
  return n.length >= 3 ? n : `${b.area === b.emirate ? b.emirate : b.area} branch`;
}

/** One branch of a provider: where it is, when it's open, how to get there, and the estimate for the current search. */
export default function StoreScreen({ route, navigation }) {
  const { data, s, origin, specific } = useApp();
  const { pid, bid } = route.params;
  const p = data.providers.find((x) => x.id === pid);
  const b = p?.branches.find((x) => x.id === bid);
  const q = useMemo(() => (p ? quote(p, data.mid, s.from, s.to, s.channel) : null), [p, data.mid, s.from, s.to, s.channel]);
  if (!p || !b) return <View style={{ padding: 20 }}><Text style={st.sub}>This store is no longer in the list.</Text></View>;

  const total = convert(q, s.amount, s.mode);
  const rate = s.mode === 'sell' ? q.sellRate : q.buyRate;
  const isOpen = isOpenNow(b);
  const d = km(origin, [b.lat, b.lng]);
  const open = (url) => Linking.openURL(url).catch(() => {});

  // Back to the company page when we came from it; otherwise open it.
  const allBranches = () => {
    const { routes, index } = navigation.getState();
    const prev = routes[index - 1];
    if (prev?.name === 'Provider' && prev.params?.id === p.id) navigation.goBack();
    else navigation.navigate('Provider', { id: p.id });
  };

  return (
    <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={{ padding: 16, gap: 14 }}>
      <View style={st.top}>
        <Mark provider={p} size={56} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text accessibilityRole="header" style={st.name}>{storeName(b, p)}</Text>
          <Text style={st.company}>{p.name}</Text>
          <Pill tone={p.type === 'bank' ? 'sky' : 'off'}>{p.type === 'bank' ? 'Bank' : 'Exchange house'}</Pill>
        </View>
      </View>

      <Card style={{ gap: 10 }}>
        <View style={st.row}>
          <Ionicons name="location-outline" size={18} color={C.muted} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={st.strong}>{placeLabel(b)}{specific ? ` · ${d < 1 ? `${Math.round(d * 1000)} m away` : `${d.toFixed(1)} km away`}` : ''}</Text>
            <Text style={st.sub}>{b.address || 'Street address not listed'}</Text>
          </View>
        </View>
        <View style={st.row}>
          <Ionicons name="time-outline" size={18} color={C.muted} />
          <View style={{ flex: 1, gap: 2 }}>
            <View style={st.rowBetween}>
              <Text style={st.strong}>{hoursLabel(b)}</Text>
              {isOpen === null ? null : <Pill tone={isOpen ? 'go' : 'off'}>{isOpen ? 'Open now' : 'Closed'}</Pill>}
            </View>
            {b.hoursText ? <Text style={st.sub}>Listed as: {b.hoursText}</Text> : null}
          </View>
        </View>
        <View style={st.buttons}>
          <Button small kind="primary" icon="navigate" title="Directions" onPress={() => open(directionsUrl(b, p))} />
          <Button small icon="map" title="On map" onPress={() => navigation.navigate('Tabs', { screen: 'Map', params: { focus: { pid: p.id, bid: b.id } } })} />
          <Button small icon="open-outline" title="Google Maps" onPress={() => open(mapsUrl(b, p))} />
        </View>
      </Card>

      <Card style={{ gap: 6 }}>
        <Label>Your estimate · {s.from} → {s.to} · {s.channel === 'bank' ? 'bank transfer' : 'cash'}</Label>
        <Text style={st.big}>{fmtNum(total)} <Text style={{ fontSize: 16 }}>{s.to}</Text></Text>
        <Text style={st.sub}>{s.mode === 'sell' ? `You hand over ${fmtNum(s.amount, 0)} ${s.from} and receive` : `You buy ${fmtNum(s.amount, 0)} ${s.from} and pay`} about this much.</Text>
        <View style={st.table}>
          <Line k="Estimated rate" v={`1 ${s.from} = ${rate.toFixed(rateDigits(rate))} ${s.to}`} />
          <Line k="Fee" v={s.channel === 'bank' ? `${fmtNum(q.feeBase)} ${s.from}` : 'None for cash'} />
        </View>
        <Text style={st.fine}>Rates are modelled per company, so this estimate is the same at every {p.name} branch.</Text>
      </Card>

      <Banner tone="info">Estimates, not offers. Confirm the final rate and fees at the counter before you transact.</Banner>

      <Button icon="business-outline" title={`All ${p.branches.length} ${p.name} branch${p.branches.length === 1 ? '' : 'es'}`} onPress={allBranches} />

      <Text style={st.fine}>
        Store details come from OpenStreetMap and can be incomplete or out of date. Open now is worked out from the first listed time range and does not account for days off.
        {p.type === 'bank' ? ' A bank branch may not offer currency exchange; confirm before you go.' : ''}
      </Text>
    </ScrollView>
  );
}

const Line = ({ k, v }) => (
  <View style={st.rowBetween}><Text style={st.sub}>{k}</Text><Text style={st.val}>{v}</Text></View>
);

const st = StyleSheet.create({
  top: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  name: { fontSize: 24, fontWeight: '900', color: C.ink },
  company: { fontSize: 15, fontWeight: '700', color: C.muted },
  row: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  strong: { fontSize: 15, fontWeight: '700', color: C.ink, flexShrink: 1 },
  sub: { fontSize: 13, color: C.muted, flexShrink: 1, lineHeight: 18 },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  big: { ...mono, fontSize: 30, fontWeight: '800', color: C.ink },
  table: { marginTop: 8, gap: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.line, paddingTop: 8 },
  val: { ...mono, fontSize: 14, fontWeight: '700', color: C.ink },
  fine: { fontSize: 12, lineHeight: 17, color: C.faint },
});
