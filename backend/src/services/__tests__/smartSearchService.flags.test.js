import assert from "assert";
import SmartSearchService from "../smartSearchService.js";

const ads = [
  { featured: true, userId: { isVerifiedSeller: true } },
  { featured: false, userId: { isVerifiedSeller: true } },
  { featured: true, userId: { isVerifiedSeller: false } },
  { featured: false, userId: { isVerifiedSeller: false } },
];

{
  const res = SmartSearchService.filterByFlags(ads, { featuredOnly: true, verifiedOnly: false });
  assert.ok(res.every(a => a.featured === true));
}
{
  const res = SmartSearchService.filterByFlags(ads, { featuredOnly: false, verifiedOnly: true });
  assert.ok(res.every(a => a.userId?.isVerifiedSeller === true));
}
{
  const res = SmartSearchService.filterByFlags(ads, { featuredOnly: true, verifiedOnly: true });
  assert.ok(res.every(a => a.featured === true && a.userId?.isVerifiedSeller === true));
}

console.log("smartSearchService.flags tests passed");

