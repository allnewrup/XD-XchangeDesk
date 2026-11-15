import test from 'node:test';
import assert from 'node:assert/strict';
import { quote, convert, midRate, emiratesForArea, areaForEmirates } from './pricing.js';
import { deriveRows, sortRows, applyPatch } from './results.js';
import { computeDashboardMetrics, buildTrendSeries, computeMultiTransferComparison } from './analytics.js';
import { mergeSpotIntoSnapshot, buildCrossHistorySeries, evaluateTriggeredAlerts } from './liveRates.js';
import { SEED_MID_PER_AED, PROVIDERS, EMIRATES } from '../data/seed.js';

const mockData = {
  mid: { ...SEED_MID_PER_AED },
  providers: [
    ...PROVIDERS.slice(0, 2).map((p) => ({ ...p, type: 'exchange', spreadBasis: 'profile' })),
    {
      id: 'osm-enbd',
      name: 'Emirates NBD',
      mark: 'EN',
      hue: '#0b5fd8',
      type: 'bank',
      spreadBasis: 'category',
      margin: 1.8,
      fee: { bank: 25 },
      bias: {},
      rating: null,
      reviewCount: null,
      branches: [
        { id: 'enbd-1', area: 'Deira', emirate: 'Dubai', lat: 25.27, lng: 55.3, address: 'Deira', hours: ['08:00', '15:00'] },
      ],
      reviews: [],
    },
  ],
};

const baseSearch = {
  from: 'AED',
  to: 'INR',
  amount: 10000,
  amountText: '10000',
  mode: 'sell',
  channel: 'cash',
  areaId: 'all',
  minRating: 0,
  openNow: false,
  query: '',
  emirates: Object.fromEntries(EMIRATES.map((e) => [e, true])),
  type: 'all',
  sort: 'rate',
};

test('quote and convert reflect cash vs bank fee math accurately', () => {
  const p = mockData.providers[0];
  const cashQ = quote(p, mockData.mid, 'AED', 'INR', 'cash');
  const bankQ = quote(p, mockData.mid, 'AED', 'INR', 'bank');

  assert.equal(cashQ.feeBase, 0);
  assert.equal(bankQ.feeBase, p.fee.bank);
  assert.ok(bankQ.marginPct <= cashQ.marginPct);

  const cashOut = convert(cashQ, 10000, 'sell');
  const bankOut = convert(bankQ, 10000, 'sell');
  assert.ok(cashOut > 0 && bankOut > 0);
  assert.ok(cashQ.mid === midRate(mockData.mid, 'AED', 'INR'));
});

test('applyPatch keeps areaId and emirates synchronized', () => {
  const dubaiOnly = applyPatch(baseSearch, { areaId: 'dubai' });
  assert.equal(dubaiOnly.emirates.Dubai, true);
  assert.equal(dubaiOnly.emirates['Abu Dhabi'], false);

  const backToAll = applyPatch(dubaiOnly, { emirates: emiratesForArea('all') });
  assert.equal(areaForEmirates(backToAll.emirates, backToAll.areaId), 'all');
});

test('deriveRows and sortRows rank highest payout first in sell mode', () => {
  const rows = deriveRows(mockData, baseSearch, {}, [25.27, 55.3]);
  assert.equal(rows.length, 3);

  const sorted = sortRows(rows, baseSearch, false);
  assert.ok(sorted[0].total >= sorted[1].total);
  assert.ok(sorted[1].total >= sorted[2].total);
  assert.equal(sorted[sorted.length - 1].provider.type, 'bank');
});

test('computeDashboardMetrics calculates savings, spread tiers, and emirate coverage', () => {
  const rows = deriveRows(mockData, baseSearch, {}, [25.27, 55.3]);
  const metrics = computeDashboardMetrics(rows, baseSearch, mockData.providers);

  assert.ok(metrics.bestRow);
  assert.ok(metrics.avgBankSavings > 0);
  assert.ok(metrics.bestSpreadPct > 0);
  assert.equal(metrics.totalBranches, mockData.providers.reduce((a, p) => a + p.branches.length, 0));
  assert.ok(metrics.spreadTiers.length >= 3);
  assert.equal(metrics.spreadTiers[0].id, 'interbank');
});

test('buildTrendSeries anchors final point on live mid rate', () => {
  const liveMid = midRate(mockData.mid, 'AED', 'INR');
  const series = buildTrendSeries(liveMid, 'AED', 'INR', '7D');
  assert.equal(series.points.length, 14);
  assert.equal(series.points[series.points.length - 1], liveMid);
  assert.ok(series.min <= liveMid && series.max >= liveMid);
});

test('computeMultiTransferComparison shows bank fee penalty when splitting transfers', () => {
  const rows = deriveRows(mockData, { ...baseSearch, channel: 'bank' }, {}, [25.27, 55.3]);
  const res = computeMultiTransferComparison(rows[0], 10000, 4, 'bank', 'sell');
  assert.ok(res.totalFeesSplit === res.totalFeesSingle * 4);
  assert.ok(res.singleTotal > res.splitTotal);
  assert.ok(res.difference > 0);
});

test('mergeSpotIntoSnapshot updates AED-normalized mid rates and tracks ticks', () => {
  const t0 = new Date('2026-11-15T20:00:00Z');
  const prev = {
    perUsd: { USD: 1, AED: 3.6725, INR: 94.0 },
    mid: { AED: 1, USD: 1 / 3.6725, INR: 94.0 / 3.6725 },
    dailyCodes: ['INR', 'EUR'],
    quoteTimes: {},
    sourceInfo: {},
    sourceStatus: [{ id: 'yahoo', label: 'Yahoo Finance FX spot', kind: 'spot', ok: false, asOf: null }],
  };
  const spot = {
    perUsd: { USD: 1, AED: 3.6728, INR: 94.5 },
    prevClosePerUsd: { USD: 1, AED: 3.6725, INR: 94.0 },
    times: { USD: t0, AED: t0, INR: t0 },
  };
  const { data, changed } = mergeSpotIntoSnapshot(prev, spot, t0);
  assert.ok(Math.abs(data.mid.INR - 94.5 / 3.6728) < 1e-9);
  assert.equal(changed.INR, 'up');
  assert.equal(data.dailyCodes.includes('INR'), false);
  assert.equal(data.dailyCodes.includes('EUR'), true);
  assert.equal(data.sourceStatus[0].ok, true);
  assert.ok(Math.abs(data.prevMid.INR - 94.0 / 3.6725) < 1e-9);
});

test('buildCrossHistorySeries computes ratio series anchored on liveMid', () => {
  const s = buildCrossHistorySeries({
    fromCloses: [3.672, 3.6725, 3.6728],
    toCloses: [93.8, 94.0, 94.2],
    liveMid: 25.66,
    range: '24H',
    targetPoints: 10,
  });
  assert.ok(s);
  assert.equal(s.points[s.points.length - 1], 25.66);
  assert.equal(s.source, 'yahoo');
  assert.ok(s.min <= 25.66 && s.max >= 25.66);
});

test('evaluateTriggeredAlerts returns alerts whose live rate meets target', () => {
  const alerts = [
    { id: '1', from: 'AED', to: 'INR', target: 25.5, digits: 4 },
    { id: '2', from: 'AED', to: 'INR', target: 26.5, digits: 4 },
  ];
  const triggered = evaluateTriggeredAlerts(alerts, { AED: 1, INR: 25.68 });
  assert.equal(triggered.length, 1);
  assert.equal(triggered[0].id, '1');
});
