import AsyncStorage from '@react-native-async-storage/async-storage';

/** Small JSON helpers. Storage can fail (full disk, corrupt value), and the app must still work without it. */
export async function load(key, fallback = null) {
  try { const raw = await AsyncStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch { return fallback; }
}
export async function save(key, value) {
  try { await AsyncStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
}
