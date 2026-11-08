import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import router, { DRAFT_TTL_MS } from "../src/routes/draftActions.js";
import storesRouter from "../src/routes/stores.js";
import purchaseRequestsRouter from "../src/routes/purchaseRequests.js";
import DraftAction from "../src/models/DraftAction.js";
import PurchaseRequest from "../src/models/PurchaseRequest.js";
import StoreProfile from "../src/models/StoreProfile.js";
import WalletServiceOrder from "../src/models/WalletServiceOrder.js";
import Plan from "../src/models/Plan.js";
import Ad from "../src/models/Ad.js";
import WalletService from "../src/models/WalletService.js";
import { getIncompleteDraftForSubmission, markDraftCompleted } from "../src/services/draftActions.js";
import { draftActionWritePauseMiddleware } from "../src/services/draftActionWritePause.js";
import { uploadReceipt } from "../src/middleware/upload.js";

const ownerId = new mongoose.Types.ObjectId().toString();
const otherUserId = new mongoose.Types.ObjectId().toString();
const planId = new mongoose.Types.ObjectId().toString();
const featuredPlan = { _id: planId, isActive: true, type: "featured" };
const adId = new mongoose.Types.ObjectId().toString();
const serviceId = new mongoose.Types.ObjectId().toString();
const sectionId = new mongoose.Types.ObjectId().toString();
const customer = { id: ownerId };
const validPlan = { _id: planId, isActive: true, type: "store" };
const validAd = { _id: adId, userId: ownerId };
const validService = {
  _id: serviceId,
  isActive: true,
  minimumQuantityEnabled: true,
  maximumQuantityEnabled: true,
  minimumQuantity: 1,
  maximumQuantity: 100,
  sections: Object.assign([{ _id: sectionId }], {
    id(value) { return this.find((section) => section._id === value) || null; }
  })
};

test("final action records have nullable unique draft idempotency keys", () => {
  for (const Model of [PurchaseRequest, StoreProfile, WalletServiceOrder]) {
    assert.equal(Model.schema.path("draftActionId").defaultValue, null);
    assert.ok(Model.schema.indexes().some(([fields, options]) =>
      fields.draftActionId === 1
      && options.unique === true
      && options.partialFilterExpression?.draftActionId?.$type === "objectId"
    ));
  }
});

function getHandler(method, routePath) {
  const route = router.stack.find((layer) =>
    layer.route?.path === routePath && layer.route.methods[method]
  );
  assert.ok(route, `Expected ${method.toUpperCase()} ${routePath}`);
  return route.route.stack.at(-1).handle;
}

async function invoke(handler, request) {
  const result = { statusCode: 200, body: null, ended: false };
  const response = {
    status(code) { result.statusCode = code; return this; },
    json(body) { result.body = body; return this; },
    end() { result.ended = true; return this; }
  };
  await handler(request, response);
  return result;
}

function installMocks() {
  const originals = {
    find: DraftAction.find,
    findOne: DraftAction.findOne,
    findOneAndUpdate: DraftAction.findOneAndUpdate,
    deleteOne: DraftAction.deleteOne,
    updateOne: DraftAction.updateOne,
    planExists: Plan.exists,
    planFindOne: Plan.findOne,
    adFindById: Ad.findById,
    serviceFindOne: WalletService.findOne
  };
  const drafts = new Map();
  const plans = new Map([[validPlan.type, validPlan], [featuredPlan.type, featuredPlan]]);
  let ad = validAd;
  let service = validService;
  const matches = (query, item) => Object.entries(query).every(([key, expected]) => {
    if (key === "expiresAt") return item.expiresAt > expected.$gt;
    return String(item[key]) === String(expected);
  });
  const findOneValue = (query) => [...drafts.values()].find((item) => matches(query, item)) || null;

  DraftAction.find = (query) => ({
    sort() {
      return {
        lean: async () => [...drafts.values()].filter((item) => matches(query, item))
      };
    }
  });
  DraftAction.findOne = (query) => {
    const result = Promise.resolve(findOneValue(query));
    result.lean = async () => findOneValue(query);
    return result;
  };
  DraftAction.findOneAndUpdate = async (query, update) => {
    let draft = [...drafts.values()].find((item) => matches(query, item));
    if (!draft) {
      draft = {
        _id: new mongoose.Types.ObjectId().toString(),
        userId: query.userId,
        type: query.type,
        status: "incomplete",
        createdAt: new Date(),
        ...update.$set,
        async save() { return this; }
      };
      drafts.set(draft._id, draft);
    } else {
      Object.assign(draft, update.$set, { updatedAt: new Date() });
    }
    return draft;
  };
  DraftAction.deleteOne = async (query) => {
    const draft = [...drafts.values()].find((item) => matches(query, item));
    if (!draft) return { deletedCount: 0 };
    drafts.delete(draft._id);
    return { deletedCount: 1 };
  };
  DraftAction.updateOne = async (query, update) => {
    const draft = [...drafts.values()].find((item) => matches(query, item));
    if (!draft) return { matchedCount: 0 };
    Object.assign(draft, update.$set, { updatedAt: new Date() });
    return { matchedCount: 1 };
  };
  Plan.exists = async (query) => {
    const currentPlan = plans.get(query.type);
    return currentPlan && currentPlan._id === query._id && currentPlan.isActive === query.isActive;
  };
  Plan.findOne = (query) => ({
    lean: async () => {
      const currentPlan = plans.get(query.type);
      return currentPlan && currentPlan._id === query._id && currentPlan.isActive
        ? currentPlan
      : null
    }
  });
  Ad.findById = () => ({
    select() { return this; },
    lean: async () => ad
  });
  WalletService.findOne = async () => service;

  return {
    drafts,
    setPlan(value) { if (value) plans.set(value.type, value); else plans.clear(); },
    setAd(value) { ad = value; },
    setService(value) { service = value; },
    restore() {
      Object.assign(DraftAction, {
        find: originals.find,
        findOne: originals.findOne,
        findOneAndUpdate: originals.findOneAndUpdate,
        deleteOne: originals.deleteOne,
        updateOne: originals.updateOne
      });
      Plan.exists = originals.planExists;
      Plan.findOne = originals.planFindOne;
      Ad.findById = originals.adFindById;
      WalletService.findOne = originals.serviceFindOne;
    }
  };
}

test("creates and updates a store action while discarding unapproved and sensitive fields", async () => {
  const mocks = installMocks();
  try {
    const created = await invoke(getHandler("post", "/"), {
      user: customer,
      body: {
        type: "store_creation",
        currentStep: 2,
        planId,
        data: {
          storeName: "متجر الأسرة",
          activityKey: "food",
          location: "شارع السوق",
          phone: "777123456",
          email: "owner@example.test",
          selectedCategories: ["category-id"],
          lat: "15.2",
          lng: "44.2",
          password: "must-not-save",
          paymentReceipt: "receipt.png",
          customerInfo: "credential",
          customerNotes: "free text"
        }
      }
    });
    assert.equal(created.statusCode, 200);
    assert.equal(created.body.data.storeName, "متجر الأسرة");
    assert.equal(created.body.data.location, "شارع السوق");
    for (const forbidden of ["lat", "lng", "password", "paymentReceipt", "customerInfo", "customerNotes"]) {
      assert.equal(Object.hasOwn(created.body.data, forbidden), false);
    }
    assert.equal(DRAFT_TTL_MS, 30 * 24 * 60 * 60 * 1000);
    assert.equal(created.body.expiresAt.getTime() - Date.now() <= DRAFT_TTL_MS, true);

    const updated = await invoke(getHandler("post", "/"), {
      user: customer,
      body: { id: created.body._id, type: "store_creation", currentStep: 3, planId, data: { storeName: "متجري" } }
    });
    assert.equal(updated.body._id, created.body._id);
    assert.equal(updated.body.currentStep, 3);
    assert.equal(updated.body.data.storeName, "متجري");
  } finally {
    mocks.restore();
  }
});

test("model validation also blocks sensitive fields outside the HTTP route", () => {
  const invalid = new DraftAction({
    userId: ownerId,
    type: "wallet_service_catalog",
    currentStep: 2,
    data: { quantity: 2, customerInfo: "account credential" },
    expiresAt: new Date(Date.now() + DRAFT_TTL_MS)
  });
  assert.equal(invalid.validateSync().errors.data.path, "data");
});

test("lists and deletes only the authenticated user's draft", async () => {
  const mocks = installMocks();
  try {
    const created = await invoke(getHandler("post", "/"), {
      user: customer,
      body: { type: "featured_ad_upgrade", currentStep: 1, adId, planId }
    });
    const ownerList = await invoke(getHandler("get", "/"), { user: customer });
    const otherList = await invoke(getHandler("get", "/"), { user: { id: otherUserId } });
    assert.equal(ownerList.body.length, 1);
    assert.equal(otherList.body.length, 0);
    const forbiddenResume = await invoke(getHandler("get", "/:id/resume"), {
      user: { id: otherUserId }, params: { id: created.body._id }
    });
    assert.equal(forbiddenResume.statusCode, 404);

    const forbiddenDelete = await invoke(getHandler("delete", "/:id"), {
      user: { id: otherUserId }, params: { id: created.body._id }
    });
    assert.equal(forbiddenDelete.statusCode, 404);
    assert.equal(mocks.drafts.size, 1);

    const deleted = await invoke(getHandler("delete", "/:id"), {
      user: customer, params: { id: created.body._id }
    });
    assert.equal(deleted.statusCode, 204);
    assert.equal(mocks.drafts.size, 0);
  } finally {
    mocks.restore();
  }
});

test("does not resume a draft with a deleted or another user's ad", async () => {
  const mocks = installMocks();
  try {
    const created = await invoke(getHandler("post", "/"), {
      user: customer,
      body: { type: "featured_ad_upgrade", currentStep: 2, adId, planId }
    });

    mocks.setAd(null);
    const missingAd = await invoke(getHandler("get", "/:id/resume"), {
      user: customer, params: { id: created.body._id }
    });
    assert.equal(missingAd.statusCode, 409);
    assert.equal(missingAd.body.code, "DRAFT_INVALID");

    mocks.setAd({ _id: adId, userId: otherUserId });
    const wrongOwnerAd = await invoke(getHandler("get", "/:id/resume"), {
      user: customer, params: { id: created.body._id }
    });
    assert.equal(wrongOwnerAd.statusCode, 409);
  } finally {
    mocks.restore();
  }
});

test("rejects unavailable plans and catalog services on resume", async () => {
  const mocks = installMocks();
  try {
    const featured = await invoke(getHandler("post", "/"), {
      user: customer,
      body: { type: "featured_ad_upgrade", currentStep: 2, adId, planId }
    });
    mocks.setPlan(null);
    const unavailablePlan = await invoke(getHandler("get", "/:id/resume"), {
      user: customer, params: { id: featured.body._id }
    });
    assert.equal(unavailablePlan.statusCode, 409);
    assert.equal(unavailablePlan.body.code, "DRAFT_INVALID");

    mocks.setPlan({ ...validPlan, type: "featured" });
    const catalog = await invoke(getHandler("post", "/"), {
      user: customer,
      body: {
        type: "wallet_service_catalog",
        currentStep: 2,
        serviceId,
        sectionId,
        data: { quantity: 3, whatsappNumber: "777123456", customerInfo: "not saved", customerNotes: "not saved" }
      }
    });
    assert.deepEqual(Object.keys(catalog.body.data).sort(), [
      "formSchemaVersion", "quantity", "serviceVersion", "whatsappNumber"
    ]);
    mocks.setService(null);
    const unavailableService = await invoke(getHandler("get", "/:id/resume"), {
      user: customer, params: { id: catalog.body._id }
    });
    assert.equal(unavailableService.statusCode, 409);
    assert.equal(unavailableService.body.code, "DRAFT_INVALID");
  } finally {
    mocks.restore();
  }
});

test("wallet service drafts preserve the selected version, package, and validated dynamic answers", async () => {
  const mocks = installMocks();
  const dynamicService = {
    ...validService,
    createdAt: new Date(Date.now() - 120_000),
    currency: "USD",
    serviceVersion: 3,
    formSchemaVersion: 2,
    versionHistory: [
      { version: 1, createdAt: new Date(Date.now() - 90_000), snapshot: { serviceVersion: 1 } },
      { version: 2, createdAt: new Date(Date.now() - 60_000), snapshot: { serviceVersion: 2 } }
    ],
    pricingType: "PACKAGE",
    sections: [],
    packages: [{ id: "monthly", currency: "USD", isActive: true }],
    formSchema: [{ id: "player", label: "معرف اللاعب", type: "TEXT", required: true }]
  };
  mocks.setService(dynamicService);
  try {
    const saved = await invoke(getHandler("post", "/"), {
      user: customer,
      body: {
        type: "wallet_service_catalog",
        currentStep: 2,
        serviceId,
        data: {
          quantity: 1,
          whatsappNumber: "777123456",
          packageId: "monthly",
          serviceVersion: 3,
          formSchemaVersion: 2,
          answers: { player: "player-1" },
          customerInfo: "must-not-be-saved",
          paymentReceipt: "must-not-be-saved"
        }
      }
    });
    assert.equal(saved.statusCode, 200);
    assert.equal(saved.body.data.serviceVersion, 3);
    assert.equal(saved.body.data.formSchemaVersion, 2);
    assert.equal(saved.body.data.packageId, "monthly");
    assert.deepEqual(saved.body.data.answers, { player: "player-1" });
    assert.equal(Object.hasOwn(saved.body.data, "customerInfo"), false);
    assert.equal(Object.hasOwn(saved.body.data, "paymentReceipt"), false);

    const changedVersion = await invoke(getHandler("post", "/"), {
      user: customer,
      body: {
        id: saved.body._id,
        type: "wallet_service_catalog",
        currentStep: 2,
        serviceId,
        data: {
          quantity: 1,
          whatsappNumber: "777123456",
          packageId: "monthly",
          serviceVersion: 2,
          formSchemaVersion: 2,
          answers: { player: "player-2" }
        }
      }
    });
    assert.equal(changedVersion.statusCode, 409);
  } finally {
    mocks.restore();
  }
});

test("wallet service drafts are unique per service, not per user", async () => {
  const mocks = installMocks();
  const secondServiceId = new mongoose.Types.ObjectId().toString();
  const bodyFor = (id) => ({
    type: "wallet_service_catalog",
    currentStep: 2,
    serviceId: id,
    data: { quantity: 2, whatsappNumber: "777123456" }
  });
  try {
    const first = await invoke(getHandler("post", "/"), {
      user: customer,
      body: bodyFor(serviceId)
    });
    assert.equal(first.statusCode, 200);

    mocks.setService({ ...validService, _id: secondServiceId });
    const second = await invoke(getHandler("post", "/"), {
      user: customer,
      body: bodyFor(secondServiceId)
    });
    assert.equal(second.statusCode, 200, JSON.stringify(second.body));
    assert.notEqual(second.body._id, first.body._id);
    assert.equal(mocks.drafts.size, 2);
  } finally {
    mocks.restore();
  }
});

test("draft writes and deletions return 503 while the maintenance pause is active", async () => {
  const mocks = installMocks();
  const previousPause = process.env.DRAFT_ACTIONS_WRITES_PAUSED;
  process.env.DRAFT_ACTIONS_WRITES_PAUSED = "YES";
  try {
    const saved = await invoke(getHandler("post", "/"), {
      user: customer,
      body: { type: "store_creation", currentStep: 1, data: {} }
    });
    const deleted = await invoke(getHandler("delete", "/:id"), {
      user: customer,
      params: { id: new mongoose.Types.ObjectId().toString() }
    });

    assert.equal(saved.statusCode, 503);
    assert.equal(deleted.statusCode, 503);
    assert.equal(mocks.drafts.size, 0);
  } finally {
    if (previousPause === undefined) delete process.env.DRAFT_ACTIONS_WRITES_PAUSED;
    else process.env.DRAFT_ACTIONS_WRITES_PAUSED = previousPause;
    mocks.restore();
  }
});

test("store and purchase submissions run the draft-write pause before upload handlers", () => {
  const previousPause = process.env.DRAFT_ACTIONS_WRITES_PAUSED;
  process.env.DRAFT_ACTIONS_WRITES_PAUSED = "YES";
  try {
    for (const [routeRouter, method] of [
      [storesRouter, "post"],
      [purchaseRequestsRouter, "post"]
    ]) {
      const route = routeRouter.stack.find((layer) =>
        layer.route?.path === "/" && layer.route.methods[method]
      );
      assert.ok(route, `expected ${method.toUpperCase()} / route`);
      const handlers = route.route.stack.map((layer) => layer.handle);
      const pauseIndex = handlers.indexOf(draftActionWritePauseMiddleware);
      const uploadIndex = handlers.indexOf(uploadReceipt);
      assert.notEqual(pauseIndex, -1);
      assert.notEqual(uploadIndex, -1);
      assert.ok(pauseIndex < uploadIndex, "pause must run before receipt uploads");

      let nextCalls = 0;
      const response = {
        statusCode: 200,
        status(code) {
          this.statusCode = code;
          return this;
        },
        json(body) {
          this.body = body;
          return this;
        }
      };
      handlers[pauseIndex]({}, response, () => { nextCalls += 1; });
      assert.equal(response.statusCode, 503);
      assert.equal(nextCalls, 0);
    }
  } finally {
    if (previousPause === undefined) delete process.env.DRAFT_ACTIONS_WRITES_PAUSED;
    else process.env.DRAFT_ACTIONS_WRITES_PAUSED = previousPause;
  }
});

test("expired drafts cannot be resumed or listed and completed drafts no longer show", async () => {
  const mocks = installMocks();
  try {
    const created = await invoke(getHandler("post", "/"), {
      user: customer,
      body: { type: "store_creation", currentStep: 1, planId, data: { storeName: "متجر" } }
    });
    created.body.expiresAt = new Date(Date.now() - 1000);
    const expiredResume = await invoke(getHandler("get", "/:id/resume"), {
      user: customer, params: { id: created.body._id }
    });
    assert.equal(expiredResume.statusCode, 404);
    const list = await invoke(getHandler("get", "/"), { user: customer });
    assert.equal(list.body.length, 0);

    created.body.expiresAt = new Date(Date.now() + DRAFT_TTL_MS);
    await markDraftCompleted(created.body._id, ownerId, "store_creation", planId, "purchase_request");
    const completedList = await invoke(getHandler("get", "/"), { user: customer });
    assert.equal(completedList.body.length, 0);
    const duplicateSubmit = await getIncompleteDraftForSubmission(created.body._id, ownerId, "store_creation");
    assert.equal(duplicateSubmit.status, 409);
    assert.match(duplicateSubmit.error, /مسبقًا/);
  } finally {
    mocks.restore();
  }
});
