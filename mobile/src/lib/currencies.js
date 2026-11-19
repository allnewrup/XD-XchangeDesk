import { CURRENCIES } from '../data/seed.js';
import info from '../data/currency-info.json';

const POPULAR = [...CURRENCIES.map((c) => c.code), 'CAD', 'AUD', 'JPY', 'CNY', 'CHF', 'TRY', 'EGP', 'KWD', 'QAR', 'OMR', 'BHD', 'LKR', 'BDT', 'NPR', 'THB', 'MYR', 'SGD', 'RUB', 'ZAR', 'KRW', 'IDR', 'NGN', 'KES'];

export const flagFor = (code) => info[code]?.[1] ?? '\u{1F310}';
export const currencyName = (code) => info[code]?.[0] ?? code;

/** Sections for the currency picker: popular first, then everything else A to Z by name. */
export function currencySections(codes, q = '') {
  const have = new Set(codes);
  const mk = (code) => ({ code, name: currencyName(code), flag: flagFor(code) });
  const needle = q.trim().toLowerCase();
  const hit = (c) => !needle || c.code.toLowerCase().includes(needle) || c.name.toLowerCase().includes(needle);
  const popular = POPULAR.filter((c) => have.has(c)).map(mk).filter(hit);
  const seen = new Set(POPULAR);
  const rest = codes.filter((c) => !seen.has(c)).map(mk).filter(hit).sort((a, b) => a.name.localeCompare(b.name));
  return [popular.length && { title: 'Popular', data: popular }, rest.length && { title: `All currencies (${rest.length})`, data: rest }].filter(Boolean);
}
