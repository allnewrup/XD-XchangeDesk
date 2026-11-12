import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TextInput, View, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { AREAS } from '../data/seed.js';
import { useApp } from '../state/AppState.js';
import { marketInfo } from '../lib/market.js';
import { fmtNum, fmtUae } from '../lib/pricing.js';
import { C, R, MONO } from '../theme.js';
import { AedBadge, Banner, Button, Card, Label, Segmented, mono } from '../components/ui.js';
import { AreaPicker, CurrencyPicker, FiltersSheet, PairButton } from '../components/Pickers.js';
import ProviderCard from '../components/ProviderCard.js';

const PAGE = 12;

export default function CompareScreen({ navigation }) {
  const { data, s, set, userLoc, geo, locate, clearLocation, isSaved, toggleSaved, status, refreshing, refresh, fromCache, origin, specific, sorted, best } = useApp();
  const [picker, setPicker] = useState(null); // 'from' | 'to' | 'area' | 'filters'
  const [shown, setShown] = useState(PAGE);
  const codes = useMemo(() => Object.keys(data.mid), [data.mid]);
  const mkt = useMemo(() => marketInfo(data, s.from, s.to), [data, s.from, s.to]);
  const area = AREAS.find((a) => a.id === s.areaId);
  const areaLabel = s.areaId === 'multi' ? 'Custom emirates' : area?.label ?? 'All UAE';
  const filterCount = (s.type !== 'all') + s.openNow + (s.areaId === 'multi' ? 1 : 0);
  const saved = isSaved(s.from, s.to);

  useEffect(() => { setShown(PAGE); }, [s.from, s.to, s.mode, s.channel, s.areaId, s.type, s.openNow, s.sort, s.query, s.emirates]);

  const swap = useCallback(() => { Haptics.selectionAsync().catch(() => {}); set({ from: s.to, to: s.from }); }, [s.from, s.to, set]);
  const choose = (key, other) => (code) => { if (code === s[other]) set({ from: s.to, to: s.from }); else set({ [key]: code }); setPicker(null); };

  const header = (
    <View style={{ gap: 12 }}>
      <View style={st.brand}>
        <AedBadge />
        <View style={{ flex: 1 }}>
          <Text accessibilityRole="header" style={st.title}>Xchange Desk</Text>
          <Text style={st.tag}>Compare UAE exchange houses &amp; banks</Text>
        </View>
      </View>

      <Card style={{ gap: 12 }}>
        <View style={st.pairRow}>
          <PairButton label="From" code={s.from} onPress={() => setPicker('from')} />
          <Pressable accessibilityRole="button" accessibilityLabel="Swap currencies" onPress={swap} style={st.swap}><Ionicons name="swap-horizontal" size={22} color={C.sky} /></Pressable>
          <PairButton label="To" code={s.to} onPress={() => setPicker('to')} />
        </View>
        <View>
          <Label>Amount to exchange</Label>
          <View style={st.amount}>
            <Text style={st.amountCode}>{s.from}</Text>
            <TextInput
              value={s.amountText} keyboardType="decimal-pad" accessibilityLabel={`Amount in ${s.from}`} selectTextOnFocus maxLength={14}
              onChangeText={(t) => { const clean = t.replace(/[^0-9.]/g, ''); set({ amountText: clean, amount: parseFloat(clean) || 0 }); }}
              style={st.amountInput}
            />
          </View>
        </View>
        <Segmented label="Direction" value={s.mode} onChange={(mode) => set({ mode })} options={[['sell', `Sell ${s.from}`], ['buy', `Buy ${s.from}`]]} />
        <Segmented label="Payment" value={s.channel} onChange={(channel) => set({ channel })} options={[['cash', 'Cash'], ['bank', 'Bank transfer']]} />
        <View style={st.actions}>
          <Button small icon={saved ? 'star' : 'star-outline'} title={saved ? 'Saved' : 'Save pair'} onPress={() => { Haptics.selectionAsync().catch(() => {}); toggleSaved(s.from, s.to); }} />
          <Button small icon="refresh" title="Refresh rates" onPress={refresh} disabled={refreshing} />
        </View>
      </Card>

      {best ? (
        <Pressable accessibilityRole="button" accessibilityLabel={`Best right now: ${best.provider.name}, ${fmtNum(best.total)} ${s.to}. Open details`} onPress={() => navigation.navigate('Provider', { id: best.provider.id })} style={st.bestCard}>
          <Text style={st.bestLabel}>★ BEST RIGHT NOW · ESTIMATE</Text>
          <Text style={st.bestName} numberOfLines={1}>{best.provider.name}</Text>
          <Text style={st.bestTotal}>{s.mode === 'sell' ? 'You receive' : 'You pay'} {fmtNum(best.total)} {s.to}</Text>
        </Pressable>
      ) : null}

      <View style={st.board}>
        <Text style={st.boardLabel}>{mkt.live ? (fromCache && !refreshing ? 'LAST KNOWN' : 'LIVE MARKET') : 'OFFLINE SAMPLE'}</Text>
        <Text style={st.boardRate} adjustsFontSizeToFit numberOfLines={1}>1 {s.from} = {mkt.mid.toFixed(mkt.digits)} {s.to}</Text>
        {mkt.quotedAt ? <Text style={[st.boardSub, mkt.stale && { color: C.led }]}>{mkt.daily ? 'daily reference rate' : 'quote'} {fmtUae(mkt.quotedAt)} · {mkt.age} old</Text> : null}
      </View>
      <Text style={[st.status, status.tone === 'err' && { color: C.bad }]}>{status.text}{mkt.note ? `\n${mkt.note}` : ''}</Text>
      {mkt.stale && <Banner>The market quote for {s.from}/{s.to} is {mkt.age} old. Markets may be closed or the feed delayed, so treat the numbers as rough guides.</Banner>}
      <Banner tone="info"><Text style={{ fontWeight: '700', color: C.ink }}>Estimates, not counter rates. </Text>Each provider's figure is the market rate plus that provider's modelled spread. The real rate and fees are set at the counter.</Banner>

      <View style={st.filterRow}>
        <Button small icon="location" title={areaLabel} onPress={() => setPicker('area')} style={{ flexShrink: 1 }} />
        <Button small icon="options" title={filterCount ? `Filters (${filterCount})` : 'Filters'} onPress={() => setPicker('filters')} />
        {userLoc
          ? <Button small icon="navigate" kind="primary" title="Near me" onPress={clearLocation} accessibilityLabel="Location on. Tap to turn off" />
          : <Button small icon="navigate-outline" title={geo.busy ? 'Locating…' : 'Near me'} onPress={locate} disabled={geo.busy} />}
      </View>
      {geo.err ? <Banner tone="bad">{geo.err}</Banner> : null}

      <View style={st.search}>
        <Ionicons name="search" size={18} color={C.faint} />
        <TextInput
          value={s.query} onChangeText={(query) => set({ query })} placeholder="Search stores, areas or addresses" placeholderTextColor={C.faint}
          autoCorrect={false} autoCapitalize="none" returnKeyType="search" clearButtonMode="while-editing" accessibilityLabel="Search exchange houses, areas or addresses" style={st.searchInput}
        />
      </View>
      <Text style={st.count} accessibilityLiveRegion="polite">
        {sorted.length} provider{sorted.length === 1 ? '' : 's'} · {s.amount.toLocaleString('en-US')} {s.from} to {s.to} · {s.mode === 'sell' ? 'selling' : 'buying'} {s.from} · {s.channel === 'bank' ? 'bank transfer' : 'cash'}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top']}>
      <FlatList
        data={sorted.slice(0, shown)} keyExtractor={(r) => r.provider.id} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
        contentContainerStyle={{ padding: 16, gap: 12 }}
        ListHeaderComponent={header}
        ListEmptyComponent={<Card><Text style={st.emptyTitle}>No exchange houses match</Text><Text style={st.tag}>Try a different search, or loosen the open-now, type or emirate filters.</Text></Card>}
        renderItem={({ item }) => (
          <ProviderCard row={item} s={s} best={best} showDistance={specific} origin={origin} onPress={() => navigation.navigate('Provider', { id: item.provider.id })} />
        )}
        onEndReachedThreshold={0.6} onEndReached={() => setShown((n) => (n < sorted.length ? n + PAGE : n))}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
        ListFooterComponent={<Text style={st.foot}>Estimates only. Not affiliated with any provider listed. Confirm the final rate and fees with the provider.</Text>}
      />
      <CurrencyPicker visible={picker === 'from'} title="Currency you have" codes={codes} selected={s.from} onSelect={choose('from', 'to')} onClose={() => setPicker(null)} />
      <CurrencyPicker visible={picker === 'to'} title="Currency you want" codes={codes} selected={s.to} onSelect={choose('to', 'from')} onClose={() => setPicker(null)} />
      <AreaPicker visible={picker === 'area'} areaId={s.areaId} onSelect={(areaId) => set({ areaId })} onClose={() => setPicker(null)} />
      <FiltersSheet visible={picker === 'filters'} s={s} set={set} onClose={() => setPicker(null)} />
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  brand: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontSize: 26, fontWeight: '900', color: C.ink, letterSpacing: 0.5 },
  tag: { fontSize: 13, color: C.muted },
  pairRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  swap: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: C.well },
  amount: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.well, borderRadius: R.md, paddingHorizontal: 12, marginTop: 4, minHeight: 52 },
  amountCode: { fontFamily: MONO, fontSize: 15, fontWeight: '700', color: C.muted },
  amountInput: { flex: 1, textAlign: 'right', fontFamily: MONO, fontSize: 22, fontWeight: '700', color: C.ink, minHeight: 52 },
  actions: { flexDirection: 'row', gap: 8 },
  bestCard: { backgroundColor: C.gold1, borderRadius: R.md, padding: 12, borderWidth: 1, borderColor: C.gold2 },
  bestLabel: { fontSize: 11, fontWeight: '900', letterSpacing: 1, color: '#5a3f08' },
  bestName: { fontSize: 20, fontWeight: '900', color: C.ink, marginTop: 2 },
  bestTotal: { fontSize: 15, fontWeight: '700', color: '#3d2c06', marginTop: 1 },
  board: { backgroundColor: C.board, borderRadius: R.md, padding: 12 },
  boardLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1.5, color: C.ledDim },
  boardRate: { ...mono, fontSize: 20, fontWeight: '700', color: C.led, marginTop: 2 },
  boardSub: { fontSize: 12, color: C.ledDim, marginTop: 2 },
  status: { fontSize: 12, lineHeight: 17, color: C.go },
  filterRow: { flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.card, borderRadius: R.md, paddingHorizontal: 12, borderWidth: 1, borderColor: C.line },
  searchInput: { flex: 1, minHeight: 46, fontSize: 16, color: C.ink },
  count: { fontSize: 13, color: C.muted },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: C.ink, marginBottom: 4 },
  foot: { fontSize: 12, color: C.faint, textAlign: 'center', paddingVertical: 12 },
});
