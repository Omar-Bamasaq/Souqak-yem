import assert from "assert";
import SmartSearchService from "../smartSearchService.js";

const ads = [
  { price: 100, viewCount: 5, createdAt: new Date("2026-02-20"), relevanceScore: 0.2, qualityScore: 50, userId: { resellerRating: 3.0 } },
  { price: 50, viewCount: 10, createdAt: new Date("2026-03-01"), relevanceScore: 0.5, qualityScore: 100, userId: { resellerRating: 4.5 } },
  { price: 10, viewCount: 30, createdAt: new Date("2026-03-05"), relevanceScore: 0.9, qualityScore: 150, userId: { resellerRating: 5.0 } },
];

const by = (arr, key) => arr.map(a => a[key]);

// pricelow
{
  const sorted = SmartSearchService.sortAds(ads, "pricelow");
  assert.deepStrictEqual(by(sorted, "price"), [10, 50, 100]);
}

// pricehigh
{
  const sorted = SmartSearchService.sortAds(ads, "pricehigh");
  assert.deepStrictEqual(by(sorted, "price"), [100, 50, 10]);
}

// rating
{
  const sorted = SmartSearchService.sortAds(ads, "rating");
  assert.strictEqual(sorted[0].userId.resellerRating, 5.0);
}

// best (default)
{
  const sorted = SmartSearchService.sortAds(ads, "best");
  assert.strictEqual(sorted[0].qualityScore, 150);
}

// price_asc
{
  const sorted = SmartSearchService.sortAds(ads, "price_asc");
  assert.deepStrictEqual(by(sorted, "price"), [10, 50, 100]);
}

// price_desc
{
  const sorted = SmartSearchService.sortAds(ads, "price_desc");
  assert.deepStrictEqual(by(sorted, "price"), [100, 50, 10]);
}

// new
{
  const sorted = SmartSearchService.sortAds(ads, "new");
  assert.strictEqual(sorted[0].createdAt.getTime(), new Date("2026-03-05").getTime());
}

// old
{
  const sorted = SmartSearchService.sortAds(ads, "old");
  assert.strictEqual(sorted[0].createdAt.getTime(), new Date("2026-02-20").getTime());
}

// views
{
  const sorted = SmartSearchService.sortAds(ads, "views");
  assert.strictEqual(sorted[0].viewCount, 30);
}

// relevance (default)
{
  const sorted = SmartSearchService.sortAds(ads, "relevance");
  assert.strictEqual(sorted[0].relevanceScore, 0.9);
}

console.log("smartSearchService.sort tests passed");

