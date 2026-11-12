import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, MONO, R, shadow } from '../theme.js';

export function Card({ children, style }) {
  return <View style={[st.card, shadow, style]}>{children}</View>;
}

export function Label({ children, style }) {
  return <Text style={[st.label, style]}>{children}</Text>;
}

export function Button({ title, onPress, kind = 'default', icon, disabled, small, style, accessibilityLabel }) {
  const primary = kind === 'primary';
  return (
    <Pressable
      accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? title} accessibilityState={{ disabled: !!disabled }}
      onPress={onPress} disabled={disabled}
      style={({ pressed }) => [st.btn, small && st.btnSm, primary && st.btnPrimary, kind === 'ghost' && st.btnGhost, pressed && { opacity: 0.7 }, disabled && { opacity: 0.45 }, style]}
    >
      {icon ? <Ionicons name={icon} size={small ? 16 : 18} color={primary ? '#fff' : C.sky} /> : null}
      {title ? <Text style={[st.btnText, small && { fontSize: 13 }, primary && { color: '#fff' }]}>{title}</Text> : null}
    </Pressable>
  );
}

/** Two-to-four way switch rendered as a segmented control. */
export function Segmented({ value, options, onChange, label }) {
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={st.seg}>
      {options.map(([v, text]) => {
        const on = value === v;
        return (
          <Pressable key={v} accessibilityRole="radio" accessibilityState={{ selected: on }} onPress={() => onChange(v)} style={[st.segItem, on && st.segOn]}>
            <Text numberOfLines={1} style={[st.segText, on && { color: '#fff' }]}>{text}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Pill({ tone = 'off', children }) {
  const t = { go: [C.goBg, C.go], off: [C.well, C.muted], sky: [C.sky, '#fff'], warn: [C.warnBg, C.warn] }[tone];
  return <View style={[st.pill, { backgroundColor: t[0] }]}><Text style={[st.pillText, { color: t[1] }]}>{children}</Text></View>;
}

/** Monogram plate standing in for a provider logo. */
export function Mark({ provider, size = 44 }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.28, backgroundColor: provider.hue, alignItems: 'center', justifyContent: 'center' }} accessible={false}>
      <Text style={{ color: '#fff', fontWeight: '800', fontSize: size * 0.38, letterSpacing: 1 }}>{provider.mark}</Text>
    </View>
  );
}

export function Banner({ tone = 'warn', children }) {
  const t = { warn: [C.warnBg, C.warn], bad: [C.badBg, C.bad], info: [C.well, C.muted], ok: [C.goBg, C.go] }[tone];
  return <View accessibilityRole="alert" style={[st.banner, { backgroundColor: t[0] }]}><Text style={{ color: t[1], fontSize: 13, lineHeight: 18 }}>{children}</Text></View>;
}

export function AedBadge({ size = 22 }) {
  return (
    <View style={{ backgroundColor: C.gold2, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: C.gold1 }} accessible={false}>
      <Text style={{ color: '#5a3f08', fontWeight: '900', fontSize: size, letterSpacing: 1 }}>AED</Text>
    </View>
  );
}

export const mono = { fontFamily: MONO };

const st = StyleSheet.create({
  card: { backgroundColor: C.card, borderRadius: R.lg, padding: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', color: C.muted },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 14, minHeight: 44, borderRadius: R.md, backgroundColor: C.card, borderWidth: 1, borderColor: C.line },
  btnSm: { minHeight: 36, paddingHorizontal: 10, borderRadius: R.sm },
  btnPrimary: { backgroundColor: C.sky, borderColor: C.skyDark },
  btnGhost: { backgroundColor: 'transparent', borderColor: 'transparent' },
  btnText: { fontSize: 15, fontWeight: '700', color: C.sky },
  seg: { flexDirection: 'row', backgroundColor: C.well, borderRadius: R.md, padding: 3 },
  segItem: { flex: 1, minHeight: 38, alignItems: 'center', justifyContent: 'center', borderRadius: R.sm, paddingHorizontal: 6 },
  segOn: { backgroundColor: C.sky },
  segText: { fontSize: 14, fontWeight: '700', color: C.text },
  pill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start' },
  pillText: { fontSize: 11, fontWeight: '700' },
  banner: { borderRadius: R.md, paddingHorizontal: 12, paddingVertical: 9 },
});
