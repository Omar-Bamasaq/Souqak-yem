import test from "node:test";
import assert from "node:assert/strict";
import adminPlansRouter from "../src/routes/adminPlans.js";
import publicPlansRouter from "../src/routes/plans.js";
import Plan from "../src/models/Plan.js";

function handlerFor(router, method, routePath) {
  const route = router.stack.find((layer) =>
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

test("admin promotion plan create, advertiser visibility, pause, and reactivation use server state", async () => {
  const originals = {
    create: Plan.create,
    find: Plan.find,
    findById: Plan.findById,
    findByIdAndUpdate: Plan.findByIdAndUpdate
  };
  const plans = new Map();
  let nextId = 1;
  Plan.create = async (data) => {
    const plan = { ...data, _id: `test-plan-${nextId++}`, isActive: true };
    plans.set(plan._id, plan);
    return plan;
  };
  Plan.find = (filter = {}) => ({
    sort() { return this; },
    lean: async () => [...plans.values()].filter((plan) =>
      Object.entries(filter).every(([key, value]) => plan[key] === value)
    )
  });
  Plan.findById = (id) => ({
    lean: async () => plans.get(id) || null
  });
  Plan.findByIdAndUpdate = (id, update) => ({
    lean: async () => {
      const plan = plans.get(id);
      if (!plan) return null;
      Object.assign(plan, update);
      return { ...plan };
    }
  });

  const createPlan = handlerFor(adminPlansRouter, "post", "/");
  const updatePlan = handlerFor(adminPlansRouter, "patch", "/:id");
  const listPublicPlans = handlerFor(publicPlansRouter, "get", "/");
  const servicePlans = [
    { adServiceType: "featured" },
    { adServiceType: "placement", adPositions: ["home"] },
    { adServiceType: "interstitial", frequencyCapHours: 36 }
  ];

  try {
    for (const settings of servicePlans) {
      const createResponse = makeResponse();
      await createPlan({
        body: {
          name: `تجربة ${settings.adServiceType}`,
          description: "اختبار إدارة باقة مؤقت في الذاكرة",
          type: "featured",
          durationInDays: 1,
          price: 2000,
          currency: "YER_ADEN",
          ...settings
        }
      }, createResponse);

      assert.equal(createResponse.statusCode, 201);
      const createdPlan = createResponse.body;
      const visibleResponse = makeResponse();
      await listPublicPlans({ query: { type: "featured" } }, visibleResponse);
      const publicPlan = visibleResponse.body.find(({ _id }) => _id === createdPlan._id);
      assert.equal(publicPlan.price, 2000);
      assert.equal(publicPlan.durationInDays, 1);
      assert.equal(publicPlan.currency, "YER_ADEN");
      if (settings.adServiceType === "placement") assert.deepEqual(publicPlan.adPositions, ["home"]);
      if (settings.adServiceType === "interstitial") assert.equal(publicPlan.frequencyCapHours, 36);

      const pauseResponse = makeResponse();
      await updatePlan({ params: { id: createdPlan._id }, body: { isActive: false } }, pauseResponse);
      assert.equal(pauseResponse.statusCode, 200);
      assert.equal(pauseResponse.body.isActive, false);
      const hiddenResponse = makeResponse();
      await listPublicPlans({ query: { type: "featured" } }, hiddenResponse);
      assert.equal(hiddenResponse.body.some(({ _id }) => _id === createdPlan._id), false);

      const reactivateResponse = makeResponse();
      await updatePlan({ params: { id: createdPlan._id }, body: { isActive: true } }, reactivateResponse);
      assert.equal(reactivateResponse.statusCode, 200);
      assert.equal(reactivateResponse.body.isActive, true);
    }
  } finally {
    Plan.create = originals.create;
    Plan.find = originals.find;
    Plan.findById = originals.findById;
    Plan.findByIdAndUpdate = originals.findByIdAndUpdate;
  }
});
