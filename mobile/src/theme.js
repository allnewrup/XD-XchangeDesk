import { Platform } from 'react-native';

// Brand colours carried over from the website.
export const C = {
  ink: '#1b232b', text: '#2d3640', muted: '#58626e', faint: '#77828f', line: '#d6dbe1', bg: '#eef1f4', card: '#ffffff', well: '#e7eaee',
  sky: '#0b5fd8', skyDark: '#0847a6', go: '#12805c', goBg: '#dff3ea', warn: '#7c5a0e', warnBg: '#f4e2a4', bad: '#a3261b', badBg: '#fbe3e0',
  board: '#12161a', led: '#ffb81c', ledDim: '#9aa3ae', gold1: '#e6c767', gold2: '#cfa539', gold3: '#a9801c',
};
export const MONO = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });
export const R = { sm: 8, md: 12, lg: 16 };
export const shadow = Platform.select({
  ios: { shadowColor: '#14202c', shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
  android: { elevation: 3 },
  default: { boxShadow: '0 3px 8px rgba(20,32,44,.12)' },
});
