import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { C, R, shadow } from '../theme.js';
import { fmtNum, hoursLabel, isOpenNow, km, rateDigits } from '../lib/pricing.js';
import { Mark, Pill, mono } from './ui.js';

const distLabel = (d) => (d < 1 ? `${Math.round(d * 1000)} m` : `${d.toFixed(1)} km`);

export default function ProviderCard({ row, s, best, showDistance, origin, onPress }) {
  const { provider: p, branch: b, branches, q, total } = row;
  const rate = s.mode === 'sell' ? q.sellRate : q.buyRate;
  const d = rateDigits(Math.max(q.sellRate, q.buyRate));
  const open = isOpenNow(b);
  const isBest = best === row;
  const gap = best ? Math.max(0, s.mode === 'sell' ? best.total - total : total - best.total) : 0;
  const dist = showDistance ? km(origin, [b.lat, b.lng]) : null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${p.name}. Estimated ${s.mode === 'sell' ? 'you receive' : 'you pay'} ${fmtNum(total)} ${s.to}. Nearest branch ${b.area}. Open for details.`}
      onPress={onPress} style={({ pressed }) => [st.card, shadow, isBest && st.best, pressed && { opacity: 0.85 }]}
    >
      {isBest && <View style={st.bestTag}><Text style={st.bestText}>★ BEST RATE</Text></View>}
      <View style={st.top}>
        <Mark provider={p} />
        <View style={{ flex: 1 }}>
          <Text style={st.name} numberOfLines={2}>{p.name}</Text>
          <View style={st.meta}>
            <Pill tone={p.type === 'bank' ? 'sky' : 'off'}>{p.type === 'bank' ? 'Bank' : 'Exchange house'}</Pill>
            <Text style={st.sub}>{branches.length} branch{branches.length === 1 ? '' : 'es'}</Text>
          </View>
        </View>
      </View>

      <View style={st.branch}>
        <Text style={st.sub} numberOfLines={1}>📍 {b.area === b.emirate ? b.emirate : `${b.area}, ${b.emirate}`}{dist != null ? ` · ${distLabel(dist)}` : ''}</Text>
        <Pill tone={open ? 'go' : 'off'}>{open === null ? 'Hours not listed' : open ? 'Open now' : 'Closed'}</Pill>
      </View>
      {b.hours ? <Text style={st.hours}>{hoursLabel(b)}</Text> : null}

      <View style={st.board}>
        <View style={{ flex: 1 }}>
          <Text style={st.boardLabel}>EST. {s.mode === 'sell' ? 'SELL' : 'BUY'} · 1 {s.from} =</Text>
          <Text style={st.led} adjustsFontSizeToFit numberOfLines={1}>{rate.toFixed(d)} <Text style={st.ledUnit}>{s.to}</Text></Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={st.boardLabel}>{s.mode === 'sell' ? 'YOU RECEIVE' : 'YOU PAY'}</Text>
          <Text style={st.total}>{fmtNum(total)} <Text style={{ fontSize: 13 }}>{s.to}</Text></Text>
        </View>
      </View>
      <Text style={st.foot}>
        {s.channel === 'bank' ? `Transfer fee ${fmtNum(q.feeBase)} ${s.from}` : 'Cash · no fee'}
        {isBest ? '' : gap > 0 ? ` · ${fmtNum(gap)} ${s.to} less than best` : ''}
        {` · ${q.marginPct.toFixed(2)}% spread`}
      </Text>
    </Pressable>
  );
}

const st = StyleSheet.create({
  card: { backgroundColor: C.card, borderRadius: R.lg, padding: 14, gap: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line },
  best: { borderColor: C.gold2, borderWidth: 2 },
  bestTag: { alignSelf: 'flex-start', backgroundColor: C.gold1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  bestText: { fontSize: 11, fontWeight: '900', letterSpacing: 1, color: '#5a3f08' },
  top: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  name: { fontSize: 18, fontWeight: '800', color: C.ink },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  sub: { fontSize: 13, color: C.muted, flexShrink: 1 },
  branch: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  hours: { fontSize: 12, color: C.faint, marginTop: -4 },
  board: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, backgroundColor: C.board, borderRadius: R.md, padding: 12 },
  boardLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1, color: C.ledDim },
  led: { ...mono, fontSize: 26, fontWeight: '700', color: C.led, marginTop: 2 },
  ledUnit: { fontSize: 14, color: C.ledDim },
  total: { ...mono, fontSize: 18, fontWeight: '700', color: '#fff', marginTop: 2 },
  foot: { fontSize: 12, color: C.muted },
});
