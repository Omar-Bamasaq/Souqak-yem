import test from "node:test";
import assert from "node:assert/strict";
import {
  getActiveSponsoredCampaigns,
  getNextSponsoredCampaignIndex,
  getSponsoredRotationDelayMs
} from "../sponsoredAds.js";

test("active placement campaigns preserve order and exclude campaigns that ended", () => {
  const now = Date.parse("2026-10-14T10:00:00.000Z");
  const campaigns = [
    { _id: "newest", endsAt: "2026-10-14T11:00:00.000Z" },
    { _id: "expired", endsAt: "2026-10-14T09:59:59.000Z" },
    { _id: "older", endsAt: "2026-10-15T10:00:00.000Z" }
  ];

  assert.deepEqual(
    getActiveSponsoredCampaigns(campaigns, now).map(({ _id }) => _id),
    ["newest", "older"]
  );
});

test("placement carousel interval uses configured seconds and defaults to five", () => {
  assert.equal(getSponsoredRotationDelayMs({ rotationIntervalSeconds: 9 }), 9000);
  assert.equal(getSponsoredRotationDelayMs({ rotationIntervalSeconds: 61 }), 5000);
  assert.equal(getSponsoredRotationDelayMs({}), 5000);
});

test("placement carousel wraps in either direction and handles an empty list", () => {
  assert.equal(getNextSponsoredCampaignIndex(1 + 1, 3), 2);
  assert.equal(getNextSponsoredCampaignIndex(3, 3), 0);
  assert.equal(getNextSponsoredCampaignIndex(-1, 3), 2);
  assert.equal(getNextSponsoredCampaignIndex(0, 0), 0);
});
