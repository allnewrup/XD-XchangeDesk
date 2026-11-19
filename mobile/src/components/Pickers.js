import React, { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, SectionList, Switch, Text, TextInput, View, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AREAS, EMIRATES } from '../data/seed.js';
import { currencySections, flagFor } from '../lib/currencies.js';
import { C, R } from '../theme.js';
import { Button, Label, Segmented } from './ui.js';

function Sheet({ visible, title, onClose, children }) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
        <View style={st.head}>
          <Text accessibilityRole="header" style={st.title}>{title}</Text>
          <Button title="Done" kind="ghost" small onPress={onClose} />
        </View>
        {children}
      </SafeAreaView>
    </Modal>
  );
}

/** Currency list with search; the pair buttons on the Compare screen open it. */
export function CurrencyPicker({ visible, codes, selected, onSelect, onClose, title }) {
  const [q, setQ] = useState('');
  const sections = useMemo(() => currencySections(codes, q), [codes, q]);
  return (
    <Sheet visible={visible} title={title} onClose={() => { setQ(''); onClose(); }}>
      <View style={st.searchWrap}>
        <Ionicons name="search" size={18} color={C.faint} />
        <TextInput
          value={q} onChangeText={setQ} placeholder="Search currency or code" placeholderTextColor={C.faint} autoCorrect={false} autoCapitalize="none"
          style={st.search} accessibilityLabel="Search currency" clearButtonMode="while-editing"
        />
      </View>
      <SectionList
        sections={sections} keyExtractor={(c) => c.code} keyboardShouldPersistTaps="handled" stickySectionHeadersEnabled
        renderSectionHeader={({ section }) => <View style={st.sec}><Label>{section.title}</Label></View>}
        renderItem={({ item }) => (
          <Pressable accessibilityRole="button" accessibilityState={{ selected: item.code === selected }} onPress={() => { setQ(''); onSelect(item.code); }} style={({ pressed }) => [st.row, pressed && { backgroundColor: C.well }]}>
            <Text style={{ fontSize: 24 }}>{item.flag}</Text>
            <View style={{ flex: 1 }}>
              <Text style={st.code}>{item.code}</Text>
              <Text style={st.name} numberOfLines={1}>{item.name}</Text>
            </View>
            {item.code === selected && <Ionicons name="checkmark-circle" size={22} color={C.sky} />}
          </Pressable>
        )}
        ListEmptyComponent={<Text style={{ padding: 20, color: C.muted }}>No currency matches “{q}”.</Text>}
      />
    </Sheet>
  );
}

export function AreaPicker({ visible, areaId, onSelect, onClose }) {
  const list = areaId === 'multi' ? [...AREAS, { id: 'multi', label: 'Custom emirates (set in Filters)', kind: 'multi' }] : AREAS;
  return (
    <Sheet visible={visible} title="Where?" onClose={onClose}>
      <FlatList
        data={list} keyExtractor={(a) => a.id}
        renderItem={({ item }) => (
          <Pressable accessibilityRole="button" accessibilityState={{ selected: item.id === areaId }} onPress={() => { if (item.id !== 'multi') onSelect(item.id); onClose(); }} style={({ pressed }) => [st.row, pressed && { backgroundColor: C.well }]}>
            <Ionicons name={item.kind === 'area' ? 'location' : 'map'} size={18} color={C.faint} />
            <Text style={[st.code, { flex: 1, fontWeight: item.kind === 'area' ? '600' : '800' }]}>{item.kind === 'area' ? `${item.label}, ${item.emirate}` : item.label}</Text>
            {item.id === areaId && <Ionicons name="checkmark-circle" size={22} color={C.sky} />}
          </Pressable>
        )}
      />
    </Sheet>
  );
}

const SORTS = [['rate', 'Best rate'], ['high', 'Rate: high to low'], ['low', 'Rate: low to high'], ['near', 'Closest']];

export function FiltersSheet({ visible, s, set, onClose }) {
  return (
    <Sheet visible={visible} title="Filters" onClose={onClose}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 18 }}>
        <View style={{ gap: 8 }}>
          <Label>Type</Label>
          <Segmented label="Provider type" value={s.type} onChange={(type) => set({ type })} options={[['all', 'All'], ['exchange', 'Exchange houses'], ['bank', 'Banks']]} />
        </View>
        <View style={st.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={st.code}>Open now</Text>
            <Text style={st.name}>Uses UAE time. Branches with no listed hours are hidden.</Text>
          </View>
          <Switch value={s.openNow} onValueChange={(openNow) => set({ openNow })} accessibilityLabel="Open now" />
        </View>
        <View style={{ gap: 4 }}>
          <Label>Emirates</Label>
          {EMIRATES.map((em) => (
            <View key={em} style={st.switchRow}>
              <Text style={[st.code, { flex: 1 }]}>{em}</Text>
              <Switch value={!!s.emirates[em]} onValueChange={(on) => set({ emirates: { ...s.emirates, [em]: on } })} accessibilityLabel={em} />
            </View>
          ))}
        </View>
        <View style={{ gap: 8 }}>
          <Label>Sort by</Label>
          {SORTS.map(([v, text]) => (
            <Pressable key={v} accessibilityRole="radio" accessibilityState={{ selected: s.sort === v }} onPress={() => set({ sort: v })} style={st.switchRow}>
              <Text style={[st.code, { flex: 1 }]}>{text}</Text>
              {s.sort === v && <Ionicons name="checkmark-circle" size={22} color={C.sky} />}
            </Pressable>
          ))}
        </View>
        <Button title="Reset filters" onPress={() => set({ query: '', openNow: false, type: 'all', sort: 'rate', areaId: 'all' })} />
      </ScrollView>
    </Sheet>
  );
}

/** Pair button showing a flag and code. */
export function PairButton({ label, code, onPress }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${label} currency ${code}. Change`} onPress={onPress} style={({ pressed }) => [st.pair, pressed && { opacity: 0.7 }]}>
      <Label>{label}</Label>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 }}>
        <Text style={{ fontSize: 22 }}>{flagFor(code)}</Text>
        <Text style={{ fontSize: 20, fontWeight: '800', color: C.ink, flex: 1 }}>{code}</Text>
        <Ionicons name="chevron-down" size={16} color={C.faint} />
      </View>
    </Pressable>
  );
}

const st = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10 },
  title: { fontSize: 22, fontWeight: '800', color: C.ink },
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginBottom: 8, paddingHorizontal: 12, backgroundColor: C.well, borderRadius: R.md },
  search: { flex: 1, minHeight: 44, fontSize: 16, color: C.ink },
  sec: { backgroundColor: C.bg, paddingHorizontal: 16, paddingVertical: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, minHeight: 54, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line, backgroundColor: C.card },
  code: { fontSize: 16, fontWeight: '700', color: C.ink },
  name: { fontSize: 13, color: C.muted },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48, backgroundColor: C.card, paddingHorizontal: 12, borderRadius: R.md },
  pair: { flex: 1, backgroundColor: C.well, borderRadius: R.md, paddingHorizontal: 12, paddingVertical: 8, minHeight: 56 },
});
