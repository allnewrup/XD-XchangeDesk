import React from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../state/AppState.js';
import { flagFor } from '../lib/currencies.js';
import { marketInfo } from '../lib/market.js';
import { C } from '../theme.js';
import { Card, Label, mono } from '../components/ui.js';

const PRESETS = [['USD', 'AED'], ['EUR', 'AED'], ['GBP', 'AED'], ['AED', 'INR'], ['AED', 'PHP'], ['AED', 'PKR'], ['AED', 'USD'], ['SAR', 'AED']];

export default function SavedScreen({ navigation }) {
  const { data, saved, toggleSaved, set } = useApp();
  const go = (from, to) => { set({ from, to }); navigation.navigate('Compare'); };
  const Pair = ({ from, to, removable }) => {
    const m = data.mid[from] && data.mid[to] ? marketInfo(data, from, to) : null;
    return (
      <Card style={st.pair}>
        <Pressable accessibilityRole="button" accessibilityLabel={`${from} to ${to}. Compare providers`} onPress={() => go(from, to)} style={st.pairMain}>
          <Text style={{ fontSize: 22 }}>{flagFor(from)}</Text><Text style={st.code}>{from}</Text>
          <Ionicons name="arrow-forward" size={16} color={C.faint} />
          <Text style={{ fontSize: 22 }}>{flagFor(to)}</Text><Text style={st.code}>{to}</Text>
          {m ? <Text style={st.rate}>{m.mid.toFixed(m.digits)}</Text> : null}
        </Pressable>
        {removable ? <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${from} to ${to}`} onPress={() => toggleSaved(from, to)} hitSlop={10}><Ionicons name="star" size={22} color={C.gold2} /></Pressable> : null}
      </Card>
    );
  };
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top']}>
      <FlatList
        data={saved} keyExtractor={(x) => `${x.from}${x.to}`} contentContainerStyle={{ padding: 16, gap: 10 }}
        ListHeaderComponent={<Text accessibilityRole="header" style={st.title}>Saved pairs</Text>}
        ListEmptyComponent={<Text style={st.empty}>Tap “Save pair” on the Compare screen and your favourite currency pairs will appear here with their live market rate.</Text>}
        renderItem={({ item }) => <Pair from={item.from} to={item.to} removable />}
        ListFooterComponent={(
          <View style={{ gap: 10, marginTop: 16 }}>
            <Label>Quick starts</Label>
            {PRESETS.filter(([f, t]) => !saved.some((x) => x.from === f && x.to === t)).map(([f, t]) => <Pair key={f + t} from={f} to={t} />)}
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  title: { fontSize: 26, fontWeight: '900', color: C.ink, marginBottom: 6 },
  empty: { fontSize: 14, color: C.muted, lineHeight: 20, marginBottom: 6 },
  pair: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  pairMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 },
  code: { fontSize: 17, fontWeight: '800', color: C.ink },
  rate: { ...mono, marginLeft: 'auto', fontSize: 15, fontWeight: '700', color: C.ink },
});
