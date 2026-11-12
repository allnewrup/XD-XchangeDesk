import React, { useMemo, useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useApp } from '../state/AppState.js';
import { quote, convert, fmtNum, rateDigits, hoursLabel, isOpenNow, km, directionsUrl, reviewsUrl } from '../lib/pricing.js';
import { C } from '../theme.js';
import { Banner, Button, Card, Label, Mark, Pill, mono } from '../components/ui.js';

export default function ProviderScreen({ route, navigation }) {
  const { data, s, origin, specific } = useApp();
  const p = data.providers.find((x) => x.id === route.params.id);
  const [more, setMore] = useState(false);
  const q = useMemo(() => (p ? quote(p, data.mid, s.from, s.to, s.channel) : null), [p, data.mid, s.from, s.to, s.channel]);
  const branches = useMemo(() => (p ? [...p.branches].map((b) => ({ b, d: km(origin, [b.lat, b.lng]) })).sort((x, y) => x.d - y.d) : []), [p, origin]);
  if (!p) return <View style={{ padding: 20 }}><Text>This provider is no longer in the list.</Text></View>;

  const total = convert(q, s.amount, s.mode);
  const rate = s.mode === 'sell' ? q.sellRate : q.buyRate;
  const open = (url) => Linking.openURL(url).catch(() => {});
  const list = more ? branches : branches.slice(0, 8);

  return (
    <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={{ padding: 16, gap: 14 }}>
      <View style={st.top}>
        <Mark provider={p} size={56} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text accessibilityRole="header" style={st.name}>{p.name}</Text>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <Pill tone={p.type === 'bank' ? 'sky' : 'off'}>{p.type === 'bank' ? 'Bank' : 'Exchange house'}</Pill>
            <Text style={st.sub}>{p.branches.length} branch{p.branches.length === 1 ? '' : 'es'} in the UAE</Text>
          </View>
        </View>
      </View>

      <Card style={{ gap: 6 }}>
        <Label>Your estimate · {s.from} → {s.to} · {s.channel === 'bank' ? 'bank transfer' : 'cash'}</Label>
        <Text style={st.big}>{fmtNum(total)} <Text style={{ fontSize: 16 }}>{s.to}</Text></Text>
        <Text style={st.sub}>{s.mode === 'sell' ? `You hand over ${fmtNum(s.amount, 0)} ${s.from} and receive` : `You buy ${fmtNum(s.amount, 0)} ${s.from} and pay`} about this much.</Text>
        <View style={st.table}>
          <Line k="Estimated rate" v={`1 ${s.from} = ${rate.toFixed(rateDigits(rate))} ${s.to}`} />
          <Line k="Market (mid) rate" v={`${q.mid.toFixed(rateDigits(q.mid))}`} />
          <Line k="Modelled spread" v={`${q.marginPct.toFixed(2)}%`} />
          <Line k="Fee" v={s.channel === 'bank' ? `${fmtNum(q.feeBase)} ${s.from}` : 'None for cash'} />
        </View>
        <Text style={st.fine}>
          {p.spreadBasis === 'profile'
            ? 'The spread is our model of this exchange house’s typical spread. It is not measured from its counter.'
            : 'No published spread exists for this provider, so a category average is used (exchange houses 0.65%, banks 1.8%). Its rate equals other providers in the same category.'}
        </Text>
      </Card>

      <Banner tone="info">Estimates, not offers. Confirm the final rate and fees with the provider before you transact.</Banner>

      <View style={{ gap: 8 }}>
        <Label>Branches{specific ? ' · nearest first' : ''}</Label>
        {list.map(({ b, d }) => {
          const isOpen = isOpenNow(b);
          return (
            <Card key={b.id} style={{ gap: 6 }}>
              <View style={st.rowBetween}>
                <Text style={st.bName}>{b.area === b.emirate ? b.emirate : `${b.area}, ${b.emirate}`}</Text>
                <Pill tone={isOpen ? 'go' : 'off'}>{isOpen === null ? 'Hours not listed' : isOpen ? 'Open now' : 'Closed'}</Pill>
              </View>
              <Text style={st.sub}>{[b.address, b.hours ? hoursLabel(b) : null, specific ? (d < 1 ? `${Math.round(d * 1000)} m away` : `${d.toFixed(1)} km away`) : null].filter(Boolean).join(' · ') || 'Address not listed'}</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Button small icon="map" title="On map" onPress={() => navigation.navigate('Tabs', { screen: 'Map', params: { focus: { pid: p.id, bid: b.id } } })} />
                <Button small icon="navigate" title="Directions" onPress={() => open(directionsUrl(b, p))} />
              </View>
            </Card>
          );
        })}
        {!more && branches.length > 8 && <Button title={`Show all ${branches.length} branches`} onPress={() => setMore(true)} />}
        <Text style={st.fine}>Branches and hours come from OpenStreetMap and can be incomplete or out of date. {p.type === 'bank' ? 'A bank branch may not offer currency exchange; confirm before you go.' : ''}</Text>
      </View>

      <Button icon="star-outline" title="Reviews on Google Maps" onPress={() => open(reviewsUrl(p))} />
    </ScrollView>
  );
}

const Line = ({ k, v }) => (
  <View style={st.rowBetween}><Text style={st.sub}>{k}</Text><Text style={st.val}>{v}</Text></View>
);

const st = StyleSheet.create({
  top: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  name: { fontSize: 24, fontWeight: '900', color: C.ink },
  sub: { fontSize: 13, color: C.muted, flexShrink: 1 },
  big: { ...mono, fontSize: 30, fontWeight: '800', color: C.ink },
  table: { marginTop: 8, gap: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.line, paddingTop: 8 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  val: { ...mono, fontSize: 14, fontWeight: '700', color: C.ink },
  fine: { fontSize: 12, lineHeight: 17, color: C.faint },
  bName: { fontSize: 16, fontWeight: '800', color: C.ink, flex: 1 },
});
