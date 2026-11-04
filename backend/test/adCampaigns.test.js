import test from "node:test";
import assert from "node:assert/strict";
import purchaseRequestsRouter from "../src/routes/purchaseRequests.js";
import PurchaseRequest from "../src/models/PurchaseRequest.js";
import AdCampaignImpression from "../src/models/AdCampaignImpression.js";
import Ad from "../src/models/Ad.js";
import User from "../src/models/User.js";
import ReferralEngine from "../src/engines/ReferralEngine.js";
import {
  getCampaignWindow,
  isCampaignAvailable,
  isImpressionEligible,
  isValidCampaignWindow
} from "../src/utils/adCampaigns.js";

const CAMPAIGN_ID = "666666666666666666666666";

function routeHandler(method, routePath) {
  const route = purchaseRequestsRouter.stack.find((layer) =>
    layer.route?.path === routePath && layer.route.methods[method]
  )?.route;
  assert.ok(route, `${method.toUpperCase()} ${routePath} route exists`);
  return route.stack.at(-1).handle;
}

function makeResponse() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    }
  };
}

test("campaign display requires an approved, active campaign inside its schedule", () => {
  const now = new Date("2026-01-10T00:00:00.000Z");
  const active = {
    status: "Approved",
    campaign: {
      isActive: true,
      serviceType: "placement",
      startsAt: "2026-01-09T00:00:00.000Z",
      endsAt: "2026-01-11T00:00:00.000Z"
    },
    plan: { type: "featured", adServiceType: "featured" }
  };
  assert.equal(isCampaignAvailable(active, now), true);
  assert.equal(isCampaignAvailable({ ...active, status: "Pending" }, now), false);
  assert.equal(isCampaignAvailable({ ...active, campaign: { ...active.campaign, isActive: false } }, now), false);
  assert.equal(isCampaignAvailable({
    ...active,
    campaign: { ...active.campaign, endsAt: "2026-01-10T00:00:00.000Z" }
  }, now), false);
  assert.equal(isCampaignAvailable({
    ...active,
    campaign: { ...active.campaign, startsAt: "2026-01-10T00:00:01.000Z" }
  }, now), false);
});

test("campaign activation dates are calculated once and constrained to the purchased duration", () => {
  const activatedAt = new Date("2026-03-01T12:00:00.000Z");
  const window = getCampaignWindow(activatedAt, 7);
  assert.equal(window.startsAt.toISOString(), activatedAt.toISOString());
  assert.equal(window.endsAt.toISOString(), "2026-03-08T12:00:00.000Z");
  assert.equal(isValidCampaignWindow(window.startsAt, window.endsAt, 7), true);
  assert.equal(isValidCampaignWindow(window.startsAt, new Date("2026-03-09T12:00:00.000Z"), 7), false);
  assert.equal(isValidCampaignWindow(window.endsAt, window.startsAt, 7), false);
});

test("interstitial frequency caps allow first display and suppress until the cap expires", () => {
  const now = new Date("2026-04-01T00:00:00.000Z");
  assert.equal(isImpressionEligible(null, now), true);
  assert.equal(isImpressionEligible("2026-04-01T00:00:01.000Z", now), false);
  assert.equal(isImpressionEligible(now, now), true);
});

test("placement campaigns return every eligible campaign in activation order with its carousel settings", async () => {
  const originalFind = PurchaseRequest.find;
  const now = Date.now();
  const campaign = (id, { position = "home", endOffset = 60_000, status = "Approved", image = "ad.webp" } = {}) => ({
    _id: id,
    status,
    campaign: {
      isActive: true,
      serviceType: "placement",
      positions: [position],
      startsAt: new Date(now - 60_000),
      endsAt: new Date(now + endOffset),
      rotationIntervalSeconds: 7
    },
    plan: { type: "featured", adServiceType: "placement", rotationIntervalSeconds: 5 },
    product: {
      _id: `product-${id}`,
      title: `Ad ${id}`,
      image,
      status: "approved",
      isDeleted: false,
      isVisible: true,
      sold: false,
      images: image ? [image] : []
    }
  });
  const records = [
    campaign("newest"),
    campaign("older"),
    campaign("wrong-position", { position: "category" }),
    campaign("ended", { endOffset: -1 }),
    campaign("pending", { status: "Pending" }),
    campaign("missing-image", { image: "" })
  ];
  let filter;
  let sort;
  let limit;
  const query = {
    populate() { return this; },
    sort(value) { sort = value; return this; },
    limit(value) { limit = value; return this; },
    lean: async () => records
  };
  PurchaseRequest.find = (value) => { filter = value; return query; };

  try {
    const response = makeResponse();
    await routeHandler("get", "/campaigns")({ query: { position: "home" } }, response);

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.body.map(({ _id }) => _id), ["newest", "older"]);
    assert.equal(response.body[0].rotationIntervalSeconds, 7);
    assert.equal(response.body[0].endsAt.getTime(), now + 60_000);
    assert.deepEqual(sort, { "campaign.activatedAt": -1 });
    assert.equal(limit, 10);
    assert.equal(filter["campaign.positions"], "home");
    assert.equal(filter.status, "Approved");
  } finally {
    PurchaseRequest.find = originalFind;
  }
});

test("interstitial campaign response remains a single campaign without placement carousel fields", async () => {
  const originalFind = PurchaseRequest.find;
  const campaign = {
    _id: "interstitial",
    status: "Approved",
    campaign: {
      isActive: true,
      serviceType: "interstitial",
      startsAt: new Date(Date.now() - 60_000),
      endsAt: new Date(Date.now() + 60_000),
      delaySeconds: 8,
      frequencyCapHours: 24
    },
    plan: { type: "featured", adServiceType: "interstitial", interstitialDelaySeconds: 8, frequencyCapHours: 24 },
    product: {
      _id: "interstitial-ad",
      title: "Interstitial ad",
      status: "approved",
      isDeleted: false,
      isVisible: true,
      sold: false,
      images: ["ad.webp"]
    }
  };
  let selectedPlanFields;
  let limit;
  const query = {
    populate(options) {
      if (options.path === "plan") selectedPlanFields = options.select;
      return this;
    },
    sort() { return this; },
    limit(value) { limit = value; return this; },
    lean: async () => [campaign]
  };
  PurchaseRequest.find = () => query;

  try {
    const response = makeResponse();
    await routeHandler("get", "/campaigns")({ query: { type: "interstitial" } }, response);

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.length, 1);
    assert.equal(response.body[0].delaySeconds, 8);
    assert.equal(response.body[0].frequencyCapHours, 24);
    assert.equal("endsAt" in response.body[0], false);
    assert.equal("rotationIntervalSeconds" in response.body[0], false);
    assert.equal(selectedPlanFields.includes("rotationIntervalSeconds"), false);
    assert.equal(limit, 30);
  } finally {
    PurchaseRequest.find = originalFind;
  }
});

test("interstitial impression endpoint enforces the cap for authenticated users", async () => {
  const originals = {
    findOne: PurchaseRequest.findOne,
    impressionFindOne: AdCampaignImpression.findOne,
    impressionCreate: AdCampaignImpression.create
  };
  const campaign = {
    _id: CAMPAIGN_ID,
    status: "Approved",
    campaign: {
      isActive: true,
      serviceType: "interstitial",
      startsAt: new Date(Date.now() - 60_000),
      endsAt: new Date(Date.now() + 60_000),
      frequencyCapHours: 24
    },
    plan: { type: "featured", adServiceType: "featured" },
    product: {
      status: "approved",
      isDeleted: false,
      isVisible: true,
      sold: false,
      images: ["ad.webp"]
    }
  };
  let impression = null;
  const findQuery = {
    populate() { return this; },
    lean: async () => campaign
  };
  PurchaseRequest.findOne = () => findQuery;
  AdCampaignImpression.findOne = () => ({
    select() { return this; },
    lean: async () => impression
  });
  AdCampaignImpression.create = async (record) => { impression = record; };
  try {
    const handler = routeHandler("post", "/campaigns/:id/impression");
    const first = makeResponse();
    await handler({
      params: { id: CAMPAIGN_ID },
      user: { id: "507f1f77bcf86cd799439012" }
    }, first);
    assert.equal(first.statusCode, 200);
    assert.ok(impression.nextEligibleAt.getTime() > Date.now());

    const second = makeResponse();
    await handler({
      params: { id: CAMPAIGN_ID },
      user: { id: "507f1f77bcf86cd799439012" }
    }, second);
    assert.equal(second.statusCode, 429);
  } finally {
    PurchaseRequest.findOne = originals.findOne;
    AdCampaignImpression.findOne = originals.impressionFindOne;
    AdCampaignImpression.create = originals.impressionCreate;
  }
});

test("campaign administration keeps the existing admin role guard", async () => {
  const route = purchaseRequestsRouter.stack.find((layer) =>
    layer.route?.path === "/campaigns/:id" && layer.route.methods.patch
  )?.route;
  assert.ok(route);
  const adminGuard = route.stack[1].handle;
  const forbiddenResponse = makeResponse();
  adminGuard({ user: { role: "seller" } }, forbiddenResponse, () => {});
  assert.equal(forbiddenResponse.statusCode, 403);

  const unauthorizedSupervisor = makeResponse();
  adminGuard({ user: { role: "supervisor", permissions: [] }, originalUrl: "/api/purchase-requests/campaigns/id" }, unauthorizedSupervisor, () => {});
  assert.equal(unauthorizedSupervisor.statusCode, 403);

  let nextCalled = false;
  adminGuard({ user: { role: "admin" } }, makeResponse(), () => { nextCalled = true; });
  assert.equal(nextCalled, true);
});

test("administrator can stop an approved campaign immediately", async () => {
  const originalFindById = PurchaseRequest.findById;
  const campaign = {
    status: "Approved",
    campaign: {
      serviceType: "placement",
      isActive: true,
      startsAt: new Date("2026-04-01T00:00:00.000Z"),
      endsAt: new Date("2026-04-08T00:00:00.000Z")
    },
    plan: { type: "featured", adServiceType: "placement" },
    product: {
      status: "approved",
      isDeleted: false,
      isVisible: true,
      sold: false,
      images: ["ad.webp"]
    },
    save: async () => {}
  };
  const query = {
    populate() { return this; },
    then(resolve, reject) {
      return Promise.resolve(campaign).then(resolve, reject);
    }
  };
  PurchaseRequest.findById = () => query;
  try {
    const response = makeResponse();
    await routeHandler("patch", "/campaigns/:id")({
      params: { id: CAMPAIGN_ID },
      body: { isActive: false }
    }, response);
    assert.equal(response.statusCode, 200);
    assert.equal(campaign.campaign.isActive, false);
  } finally {
    PurchaseRequest.findById = originalFindById;
  }
});

test("administrator can extend an approved campaign with a required reason and an audit record", async () => {
  const originalFindById = PurchaseRequest.findById;
  const startsAt = new Date(Date.now() - 60_000);
  const endsAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
  const campaign = {
    status: "Approved",
    campaign: {
      serviceType: "placement",
      isActive: true,
      startsAt,
      endsAt,
      durationInDays: 3,
      adminExtensions: []
    },
    plan: { type: "featured", adServiceType: "placement", durationInDays: 3 },
    product: {
      status: "approved",
      isDeleted: false,
      isVisible: true,
      sold: false,
      images: ["ad.webp"]
    },
    save: async () => {}
  };
  const query = {
    populate() { return this; },
    then(resolve, reject) {
      return Promise.resolve(campaign).then(resolve, reject);
    }
  };
  PurchaseRequest.findById = () => query;
  try {
    const result = makeResponse();
    await routeHandler("patch", "/campaigns/:id")({
      params: { id: CAMPAIGN_ID },
      user: { id: "507f1f77bcf86cd799439012" },
      body: { extensionDays: 2, extensionReason: "تعويض توقف الخدمة" }
    }, result);

    assert.equal(result.statusCode, 200);
    assert.equal(campaign.campaign.durationInDays, 5);
    assert.equal(campaign.campaign.endsAt.getTime(), endsAt.getTime() + 2 * 24 * 60 * 60 * 1000);
    assert.deepEqual(campaign.campaign.adminExtensions[0], {
      days: 2,
      reason: "تعويض توقف الخدمة",
      extendedBy: "507f1f77bcf86cd799439012",
      extendedAt: campaign.campaign.adminExtensions[0].extendedAt
    });
    assert.ok(campaign.campaign.adminExtensions[0].extendedAt instanceof Date);
  } finally {
    PurchaseRequest.findById = originalFindById;
  }
});

test("featured-ad extensions and stop actions update the original advertisement dates and visibility", async () => {
  const originals = {
    findById: PurchaseRequest.findById,
    updateAd: Ad.findByIdAndUpdate
  };
  const startsAt = new Date(Date.now() - 60_000);
  const endsAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const campaign = {
    status: "Approved",
    duration: 2,
    campaign: { serviceType: "featured", adminExtensions: [] },
    plan: { type: "featured", adServiceType: "featured", durationInDays: 2 },
    product: {
      _id: "ad-id",
      status: "approved",
      isDeleted: false,
      isVisible: true,
      sold: false,
      images: ["ad.webp"],
      featured: true,
      featuredAt: startsAt,
      featuredUntil: endsAt,
      featuredExpiresAt: endsAt
    },
    updatedAt: startsAt,
    save: async () => {}
  };
  const query = {
    populate() { return this; },
    then(resolve, reject) {
      return Promise.resolve(campaign).then(resolve, reject);
    }
  };
  const adUpdates = [];
  PurchaseRequest.findById = () => query;
  Ad.findByIdAndUpdate = async (_id, update) => { adUpdates.push(update); };
  try {
    const extendResult = makeResponse();
    await routeHandler("patch", "/campaigns/:id")({
      params: { id: CAMPAIGN_ID },
      user: { id: "507f1f77bcf86cd799439012" },
      body: { extensionDays: 1, extensionReason: "تمديد دعم الحملة" }
    }, extendResult);
    assert.equal(extendResult.statusCode, 200);
    assert.equal(campaign.campaign.endsAt.getTime(), endsAt.getTime() + 24 * 60 * 60 * 1000);
    assert.equal(adUpdates[0].$set.featuredExpiresAt.getTime(), campaign.campaign.endsAt.getTime());

    const stopResult = makeResponse();
    await routeHandler("patch", "/campaigns/:id")({
      params: { id: CAMPAIGN_ID },
      body: { isActive: false }
    }, stopResult);
    assert.equal(stopResult.statusCode, 200);
    assert.equal(adUpdates.at(-1).$set.featured, false);
  } finally {
    PurchaseRequest.findById = originals.findById;
    Ad.findByIdAndUpdate = originals.updateAd;
  }
});

test("campaign extension requires a bounded day count and a reason", async () => {
  const originalFindById = PurchaseRequest.findById;
  const campaign = {
    status: "Approved",
    campaign: {
      serviceType: "interstitial",
      isActive: true,
      startsAt: new Date(Date.now() - 60_000),
      endsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      durationInDays: 2,
      adminExtensions: []
    },
    plan: { type: "featured", adServiceType: "interstitial", durationInDays: 2 },
    product: { status: "approved", isDeleted: false, isVisible: true, sold: false, images: ["ad.webp"] },
    save: async () => {}
  };
  const query = {
    populate() { return this; },
    then(resolve, reject) {
      return Promise.resolve(campaign).then(resolve, reject);
    }
  };
  PurchaseRequest.findById = () => query;
  try {
    for (const body of [
      { extensionDays: 0, extensionReason: "سبب" },
      { extensionDays: 366, extensionReason: "سبب" },
      { extensionDays: 1, extensionReason: " " }
    ]) {
      const result = makeResponse();
      await routeHandler("patch", "/campaigns/:id")({ params: { id: CAMPAIGN_ID }, body }, result);
      assert.equal(result.statusCode, 400);
    }
    assert.equal(campaign.campaign.adminExtensions.length, 0);
  } finally {
    PurchaseRequest.findById = originalFindById;
  }
});

test("administrator can update the execution state of an approved manual social promotion", async () => {
  const originalFindById = PurchaseRequest.findById;
  const campaign = {
    status: "Approved",
    campaign: {
      serviceType: "featured",
      isActive: false,
      socialPromotionRequested: true,
      socialPromotionStatus: "pending"
    },
    plan: { type: "featured", adServiceType: "featured" },
    product: null,
    save: async () => {}
  };
  const query = {
    populate() { return this; },
    then(resolve, reject) {
      return Promise.resolve(campaign).then(resolve, reject);
    }
  };
  PurchaseRequest.findById = () => query;
  try {
    const result = makeResponse();
    await routeHandler("patch", "/campaigns/:id")({
      params: { id: CAMPAIGN_ID },
      body: { socialPromotionStatus: "in_progress" }
    }, result);
    assert.equal(result.statusCode, 200);
    assert.equal(result.body.campaign.socialPromotionStatus, "in_progress");
    assert.equal(campaign.campaign.isActive, false);
  } finally {
    PurchaseRequest.findById = originalFindById;
  }
});

test("admin approval activates a campaign only after a receipt and eligible ad are confirmed", async () => {
  const originals = {
    findById: PurchaseRequest.findById,
    findOneAndUpdate: PurchaseRequest.findOneAndUpdate,
    findAdById: Ad.findById,
    userFindById: User.findById,
    createCommission: ReferralEngine.createPromotionCommission
  };
  const userId = "507f1f77bcf86cd799439012";
  const pending = {
    _id: CAMPAIGN_ID,
    user: userId,
    product: "ad-id",
    status: "Pending",
    paymentReceipt: "receipts/payment.webp",
    duration: 1,
    planSnapshot: { type: "featured", adServiceType: "placement", durationInDays: 1, adPositions: ["home"] },
    plan: { type: "featured", adServiceType: "placement", durationInDays: 1 },
    campaign: { serviceType: "placement", positions: ["home"], durationInDays: 1 }
  };
  let updatedRequest;
  PurchaseRequest.findById = () => ({
    populate() { return this; },
    lean: async () => updatedRequest || pending
  });
  PurchaseRequest.findOneAndUpdate = (_filter, update) => ({
    lean: async () => {
      updatedRequest = {
        ...pending,
        status: update.$set.status,
        campaign: {
          ...pending.campaign,
          isActive: update.$set["campaign.isActive"],
          startsAt: update.$set["campaign.startsAt"],
          endsAt: update.$set["campaign.endsAt"],
          durationInDays: update.$set["campaign.durationInDays"],
          serviceType: update.$set["campaign.serviceType"],
          positions: update.$set["campaign.positions"]
        }
      };
      return updatedRequest;
    }
  });
  Ad.findById = () => ({
    lean: async () => ({
      userId,
      status: "approved",
      isDeleted: false,
      isVisible: true,
      sold: false,
      images: ["ad.webp"]
    })
  });
  User.findById = () => ({
    select() { return this; },
    lean: async () => null
  });
  ReferralEngine.createPromotionCommission = async () => {};
  try {
    const result = makeResponse();
    await routeHandler("patch", "/:id/approve")({
      params: { id: CAMPAIGN_ID },
      body: {},
      app: {}
    }, result);
    assert.equal(result.statusCode, 200);
    assert.equal(result.body.status, "Approved");
    assert.equal(result.body.campaign.isActive, true);
    assert.equal(result.body.campaign.positions[0], "home");
    assert.equal(result.body.campaign.endsAt.getTime() - result.body.campaign.startsAt.getTime(), 24 * 60 * 60 * 1000);
  } finally {
    PurchaseRequest.findById = originals.findById;
    PurchaseRequest.findOneAndUpdate = originals.findOneAndUpdate;
    Ad.findById = originals.findAdById;
    User.findById = originals.userFindById;
    ReferralEngine.createPromotionCommission = originals.createCommission;
  }
});

test("admin rejection requires and records a reason", async () => {
  const originals = {
    findById: PurchaseRequest.findById,
    findOneAndUpdate: PurchaseRequest.findOneAndUpdate,
    userFindById: User.findById
  };
  const pending = { _id: CAMPAIGN_ID, user: "507f1f77bcf86cd799439012", status: "Pending" };
  PurchaseRequest.findById = () => ({ lean: async () => pending });
  PurchaseRequest.findOneAndUpdate = (_filter, update) => ({
    lean: async () => ({ ...pending, ...update })
  });
  User.findById = () => ({
    select() { return this; },
    lean: async () => null
  });
  try {
    const noReason = makeResponse();
    await routeHandler("patch", "/:id/reject")({
      params: { id: CAMPAIGN_ID }, body: {}
    }, noReason);
    assert.equal(noReason.statusCode, 400);

    const rejected = makeResponse();
    await routeHandler("patch", "/:id/reject")({
      params: { id: CAMPAIGN_ID }, body: { rejectionReason: "إيصال غير واضح" }, app: {}
    }, rejected);
    assert.equal(rejected.statusCode, 200);
    assert.equal(rejected.body.status, "Rejected");
    assert.equal(rejected.body.rejectionReason, "إيصال غير واضح");
  } finally {
    PurchaseRequest.findById = originals.findById;
    PurchaseRequest.findOneAndUpdate = originals.findOneAndUpdate;
    User.findById = originals.userFindById;
  }
});

test("repeated approval returns the approved request without recalculating its campaign dates", async () => {
  const originalFindById = PurchaseRequest.findById;
  const approvedRequest = {
    _id: CAMPAIGN_ID,
    status: "Approved",
    campaign: {
      isActive: true,
      startsAt: new Date("2026-04-01T00:00:00.000Z"),
      endsAt: new Date("2026-04-08T00:00:00.000Z")
    },
    plan: { type: "featured", durationInDays: 7 }
  };
  PurchaseRequest.findById = () => ({
    populate() { return this; },
    lean: async () => approvedRequest
  });
  try {
    const result = makeResponse();
    await routeHandler("patch", "/:id/approve")(
      { params: { id: CAMPAIGN_ID }, body: {}, app: {} },
      result
    );
    assert.equal(result.statusCode, 200);
    assert.equal(result.body.campaign.endsAt.toISOString(), "2026-04-08T00:00:00.000Z");
  } finally {
    PurchaseRequest.findById = originalFindById;
  }
});
