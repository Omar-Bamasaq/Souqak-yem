import test from "node:test";
import assert from "node:assert/strict";
import adsRouter from "../src/routes/ads.js";
import Ad from "../src/models/Ad.js";
import City from "../src/models/City.js";
import SystemSettings from "../src/models/SystemSettings.js";
import ListingService from "../src/services/listingService.js";

const patchRoutes = adsRouter.stack.filter(
  (layer) => layer.route?.path === "/:id" && layer.route.methods.patch
);
assert.equal(patchRoutes.length, 1, "PATCH /ads/:id must be registered exactly once");

const patchRoute = patchRoutes[0].route;
const roleGuard = patchRoute.stack.find((layer) =>
  layer.handle.toString().includes("roles.includes(req.user.role)")
).handle;
const protectFields = patchRoute.stack.find((layer) =>
  layer.handle.toString().includes("sensitiveFields")
).handle;
const validateBody = patchRoute.stack.find((layer) =>
  layer.handle.toString().includes("schema.validate(req.body")
).handle;
const patchHandler = patchRoute.stack.at(-1).handle;

function response() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(value) {
      this.body = value;
      return this;
    }
  };
}

function query(value) {
  return {
    populate() {
      return this;
    },
    lean() {
      return Promise.resolve(value);
    },
    then(resolve, reject) {
      return Promise.resolve(value).then(resolve, reject);
    }
  };
}

function makeAd(overrides = {}) {
  const ad = {
    _id: "507f1f77bcf86cd799439011",
    userId: "507f1f77bcf86cd799439012",
    title: "Old title",
    description: "Old description",
    price: 100,
    currency: "YER_ADEN",
    governorateId: "507f1f77bcf86cd799439013",
    cityId: "507f1f77bcf86cd799439014",
    categoryId: "507f1f77bcf86cd799439015",
    condition: "used",
    tags: [],
    tagNames: [],
    images: ["old.webp"],
    status: "approved",
    viewCount: 7,
    contactsCount: 2,
    commissionValue: 1,
    isWelcomePromoted: false,
    contactInfo: {
      showPhone: false,
      phone: "",
      showWhatsApp: false,
      whatsapp: ""
    },
    save: async () => {},
    ...overrides
  };
  return ad;
}

async function invoke({ role, owner, body = {}, files = [], adOverrides = {} }) {
  const ad = makeAd({ userId: owner, ...adOverrides });
  const originalFindById = Ad.findById;
  const originalCityFindById = City.findById;
  const originalSettings = SystemSettings.getSettings;
  const originalSaveAttributes = ListingService.saveAttributeValues;
  let attributesSaved = null;
  let saveCount = 0;
  ad.save = async () => {
    saveCount += 1;
  };
  Ad.findById = () => query(ad);
  City.findById = () => ({ lean: async () => ({ governorateId: ad.governorateId }) });
  SystemSettings.getSettings = async () => ({
    prohibitedKeywords: [],
    adReviewMode: "manual",
    adReviewDelayMinutes: 10
  });
  ListingService.saveAttributeValues = async (_id, attributes) => {
    attributesSaved = attributes;
  };

  try {
    const req = {
      params: { id: ad._id },
      user: { id: owner, role },
      body,
      files
    };
    const res = response();
    protectFields(req, res, () => {});
    validateBody(req, res, () => {});
    await patchHandler(req, res);
    return { ad, res, saveCount, attributesSaved };
  } finally {
    Ad.findById = originalFindById;
    City.findById = originalCityFindById;
    SystemSettings.getSettings = originalSettings;
    ListingService.saveAttributeValues = originalSaveAttributes;
  }
}

test("user and seller owners can update an ad", async () => {
  for (const role of ["user", "seller"]) {
    let nextCalled = false;
    const res = response();
    roleGuard({ user: { role } }, res, () => {
      nextCalled = true;
    });
    assert.equal(nextCalled, true);
    assert.equal(res.statusCode, 200);

    const result = await invoke({ role, owner: "507f1f77bcf86cd799439012", body: { title: "Updated" } });
    assert.equal(result.res.statusCode, 200);
    assert.equal(result.ad.title, "Updated");
  }
});

test("buyer is rejected by the PATCH role guard", () => {
  let nextCalled = false;
  const res = response();
  roleGuard({ user: { role: "buyer" } }, res, () => {
    nextCalled = true;
  });
  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 403);
});

test("a user cannot update another user's ad", async () => {
  const result = await invoke({
    role: "user",
    owner: "507f1f77bcf86cd799439099",
    body: { title: "Attacker update" },
    adOverrides: { userId: "507f1f77bcf86cd799439012" }
  });
  assert.equal(result.res.statusCode, 403);
  assert.equal(result.ad.title, "Old title");
  assert.equal(result.saveCount, 0);
});

test("sensitive, ownership, financial, and counter fields are ignored", async () => {
  const result = await invoke({
    role: "user",
    owner: "507f1f77bcf86cd799439012",
    body: {
      title: "Allowed title",
      userId: "507f1f77bcf86cd799439099",
      status: "approved",
      isApproved: true,
      approvedBy: "507f1f77bcf86cd799439099",
      commissionValue: 999999,
      viewCount: 999999,
      contactsCount: 999999,
      promotionStats: { views: 999999 }
    }
  });
  assert.equal(result.res.statusCode, 200);
  assert.equal(result.ad.title, "Allowed title");
  assert.equal(String(result.ad.userId), "507f1f77bcf86cd799439012");
  assert.equal(result.ad.status, "approved");
  assert.equal(result.ad.commissionValue, 1);
  assert.equal(result.ad.viewCount, 7);
  assert.equal(result.ad.contactsCount, 2);
  assert.equal(result.saveCount, 1);
});

test("data, images, and dynamic attributes update through the protected route", async () => {
  const result = await invoke({
    role: "seller",
    owner: "507f1f77bcf86cd799439012",
    body: {
      title: "Updated title",
      governorateId: "507f1f77bcf86cd799439013",
      cityId: "507f1f77bcf86cd799439014",
      attributes: [{ attributeId: "507f1f77bcf86cd799439016", value: "blue" }]
    },
    files: [{ optimizedFilename: "new.webp" }]
  });
  assert.equal(result.res.statusCode, 200);
  assert.equal(result.ad.title, "Updated title");
  assert.deepEqual(result.ad.images, ["old.webp", "new.webp"]);
  assert.deepEqual(result.attributesSaved, [{ attributeId: "507f1f77bcf86cd799439016", value: "blue" }]);
});

test("rejected ads return to the existing review workflow", async () => {
  const result = await invoke({
    role: "user",
    owner: "507f1f77bcf86cd799439012",
    body: { title: "Edited rejected ad" },
    adOverrides: { status: "rejected", publishedAt: new Date(), expiresAt: new Date() }
  });
  assert.equal(result.res.statusCode, 200);
  assert.equal(result.ad.status, "pending");
  assert.equal(result.ad.publishedAt, undefined);
  assert.equal(result.ad.expiresAt, undefined);
});
