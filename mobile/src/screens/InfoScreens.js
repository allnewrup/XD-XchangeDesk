import React from 'react';
import { Linking, ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DOCS } from '../content.js';
import { useApp } from '../state/AppState.js';
import osm from '../data/osm-uae.json';
import { SITE } from '../data/site.js';
import { ageLabel, fmtUae } from '../lib/pricing.js';
import { C, R } from '../theme.js';
import { Banner, Card, Label, Button } from '../components/ui.js';

const open = (url) => Linking.openURL(url).catch(() => {});

export function DocScreen({ route }) {
  const doc = DOCS[route.params.doc];
  return (
    <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={{ padding: 16, gap: 8 }}>
      <Text accessibilityRole="header" style={st.h1}>{doc.title}</Text>
      {doc.updated ? <Text style={st.fine}>Last updated: {doc.updated}</Text> : null}
      {doc.blocks.map((b, i) => {
        if (b.h) return <Text key={i} accessibilityRole="header" style={st.h2}>{b.h}</Text>;
        if (b.p) return <Text key={i} style={st.p}>{b.p}</Text>;
        if (b.note) return <Banner key={i}>{b.note}</Banner>;
        if (b.li) return <View key={i} style={{ gap: 6 }}>{b.li.map((t, j) => <View key={j} style={st.li}><Text style={st.dot}>•</Text><Text style={[st.p, { flex: 1 }]}>{t}</Text></View>)}</View>;
        if (b.link) return <Button key={i} icon="open-outline" title={b.link[0]} onPress={() => open(b.link[1])} style={{ marginTop: 6 }} />;
        return null;
      })}
    </ScrollView>
  );
}

const SOURCES = [
  ['yahoo', 'Yahoo Finance FX spot', 'Minute-level spot quotes for the major currencies. Unofficial public endpoint, relayed by our server.', 'Live while markets are open'],
  ['ecb', 'ECB via Frankfurter', 'European Central Bank reference rates for about 30 currencies.', 'Once per working day, around 16:00 CET'],
  ['erapi', 'open.er-api.com', 'Daily reference rates for about 160 currencies.', 'Once per day'],
  ['fawaz', 'fawazahmed0 currency-api', 'Community-maintained daily rates for 300+ currencies.', 'Once per day'],
];

export function SourcesScreen() {
  const { data, fromCache } = useApp();
  const status = data.sourceStatus ?? [];
  const branches = data.providers.reduce((a, p) => a + p.branches.length, 0);
  return (
    <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Text accessibilityRole="header" style={st.h1}>Data sources and update times</Text>
      {data.updatedAt
        ? <Text style={st.p}>Rates last fetched <Text style={{ fontWeight: '800', color: C.ink }}>{fmtUae(data.updatedAt, true)} UAE time</Text>{fromCache ? ' (a previous session; the app refreshes whenever it has a connection)' : ''}. “Quote as of” is when the source itself published its dirham quote; daily sources can be many hours earlier.</Text>
        : <Banner>Live rates have not loaded yet. The app is showing a built-in offline sample table.</Banner>}
      {SOURCES.map(([id, label, what, cadence]) => {
        const s = status.find((x) => x.id === id);
        return (
          <Card key={id} style={{ gap: 4 }}>
            <View style={st.between}><Text style={st.h3}>{label}</Text>{s ? <Text style={[st.badge, { color: s.ok ? C.go : C.bad }]}>{s.ok ? 'Reachable' : 'Unavailable'}</Text> : null}</View>
            <Text style={st.p}>{what}</Text>
            <Text style={st.fine}>{cadence}</Text>
            {s?.asOf ? <Text style={st.fine}>Quote as of {fmtUae(s.asOf, true)} · {ageLabel(new Date(s.asOf))} old</Text> : null}
          </Card>
        );
      })}
      <Text style={st.h2}>Branches and hours</Text>
      <Card style={{ gap: 4 }}>
        <Text style={st.h3}>OpenStreetMap</Text>
        <Text style={st.p}>{data.providers.length} providers and {branches.toLocaleString('en-US')} branches in the UAE, collected through the Overpass API on {fmtUae(osm.fetchedAt, true)} UAE time. Licence: ODbL, © OpenStreetMap contributors. This is a snapshot shipped with the app and refreshed in app updates; a branch may have opened, closed, moved or changed hours since.</Text>
      </Card>
      <Text style={st.h2}>Spreads, ratings and reviews</Text>
      <Text style={st.p}>Provider spreads and bank-transfer fees are modelled by Xchange Desk, not collected from providers. No ratings or reviews are shown.</Text>
      <Text style={st.h2}>Other services</Text>
      <Text style={st.p}>Maps: Apple Maps (iPhone) and Google Maps (Android). Hosting of the rate relay: Vercel.</Text>
    </ScrollView>
  );
}

const ROWS = [
  ['about', 'information-circle-outline', 'About Xchange Desk'],
  ['how', 'calculator-outline', 'How rates are calculated'],
  ['sources', 'time-outline', 'Data sources and update times'],
  ['contact', 'mail-outline', 'Contact'],
  ['privacy', 'lock-closed-outline', 'Privacy Policy'],
  ['terms', 'document-text-outline', 'Terms of Service'],
];

export function MoreScreen({ navigation }) {
  return (
    <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={{ padding: 16, gap: 10 }}>
      <Text accessibilityRole="header" style={st.h1}>More</Text>
      {ROWS.map(([id, icon, label]) => (
        <Pressable key={id} accessibilityRole="button" accessibilityLabel={label} onPress={() => navigation.navigate(id === 'sources' ? 'Sources' : 'Doc', id === 'sources' ? undefined : { doc: id })} style={({ pressed }) => [st.row, pressed && { opacity: 0.7 }]}>
          <Ionicons name={icon} size={22} color={C.sky} />
          <Text style={st.rowText}>{label}</Text>
          <Ionicons name="chevron-forward" size={18} color={C.faint} />
        </Pressable>
      ))}
      <Text style={[st.fine, { textAlign: 'center', marginTop: 12 }]}>{SITE.name} · independent comparison tool. Not an exchange house and not affiliated with the providers listed. Rates are estimates.</Text>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  h1: { fontSize: 28, fontWeight: '900', color: C.ink, marginBottom: 4 },
  h2: { fontSize: 18, fontWeight: '800', color: C.ink, marginTop: 14 },
  h3: { fontSize: 16, fontWeight: '800', color: C.ink, flex: 1 },
  p: { fontSize: 15, lineHeight: 22, color: C.text },
  fine: { fontSize: 12, lineHeight: 17, color: C.faint },
  li: { flexDirection: 'row', gap: 8 },
  dot: { fontSize: 15, color: C.muted, lineHeight: 22 },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  badge: { fontSize: 12, fontWeight: '800' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.card, borderRadius: R.md, paddingHorizontal: 14, minHeight: 54, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line },
  rowText: { flex: 1, fontSize: 16, fontWeight: '600', color: C.ink },
});
