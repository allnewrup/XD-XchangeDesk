// Builds src/data/currency-info.json: English currency names and flag emoji for every currency code the rate feeds carry.
// Hermes (React Native's JS engine) has no Intl.DisplayNames, so this is generated once with Node's full ICU.
import { writeFileSync } from 'node:fs';
const res = await fetch('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json');
const codes = Object.keys((await res.json()).usd).map((c) => c.toUpperCase()).filter((c) => /^[A-Z]{3}$/.test(c));
const names = new Intl.DisplayNames(['en'], { type: 'currency' });
const regions = new Intl.DisplayNames(['en'], { type: 'region' });
const flag = (code) => {
  if (code === 'EUR') return '\u{1F1EA}\u{1F1FA}';
  const cc = code.slice(0, 2);
  let ok = false;
  try { ok = regions.of(cc) !== cc && !code.startsWith('X'); } catch { ok = false; }
  return ok ? String.fromCodePoint(...[...cc].map((ch) => 127397 + ch.charCodeAt(0))) : '\u{1F310}';
};
const out = {};
for (const c of codes.sort()) { let n; try { n = names.of(c); } catch { n = c; } if (n && n !== c) out[c] = [n, flag(c)]; }
writeFileSync(new URL('../src/data/currency-info.json', import.meta.url), JSON.stringify(out));
console.log(Object.keys(out).length, 'currencies');
