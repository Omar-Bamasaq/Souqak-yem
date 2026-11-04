import test from 'node:test';
import assert from 'node:assert/strict';
import { filterStoreAds } from '../src/utils/storeDiscovery.js';

const ads = [
  { _id: 'a1', title: 'مكيف', categoryId: { _id: 'c1' } },
  { _id: 'a2', title: 'ثلاجة', categoryId: { _id: 'c2' } },
  { _id: 'a3', title: 'أجهزة كهربائية', categoryId: { _id: 'c1' } },
  { _id: 'a4', title: 'خزان ماء', categoryId: { _id: 'c3' } }
];

test('returns all ads for the selected store when category is all', () => {
  const result = filterStoreAds(ads, 'all', '');
  assert.equal(result.length, 4);
});

test('filters ads by the selected store category only', () => {
  const result = filterStoreAds(ads, 'c1', '');
  assert.deepEqual(result.map((ad) => ad._id), ['a1', 'a3']);
});

test('ignores ads from other categories and supports title search', () => {
  const result = filterStoreAds(ads, 'c1', 'مكيف');
  assert.deepEqual(result.map((ad) => ad._id), ['a1']);
});

test('does not match unrelated titles', () => {
  const result = filterStoreAds(ads, 'all', 'خزان');
  assert.deepEqual(result.map((ad) => ad._id), ['a4']);
});
