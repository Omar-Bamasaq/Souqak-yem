import test from "node:test";
import assert from "node:assert/strict";
import followsRouter from "../src/routes/followsUsers.js";
import StoreFollow from "../src/models/StoreFollow.js";
import StoreProfile from "../src/models/StoreProfile.js";

const STORE_ID = "333333333333333333333333";
const FOLLOWER_ID = "222222222222222222222222";

function query(value) {
  return {
    select() { return this; },
    lean() { return Promise.resolve(value); }
  };
}

function getRoute(method, path) {
  const route = followsRouter.stack.find((layer) => layer.route?.path === path && layer.route.methods[method]);
  assert.ok(route, `${method.toUpperCase()} ${path} route exists`);
  return route.route;
}

async function invoke(handler, req) {
  const result = { statusCode: 200, body: null };
  const res = {
    status(code) { result.statusCode = code; return this; },
    json(body) { result.body = body; return this; }
  };
  await handler(req, res);
  return result;
}

test("store follow records are unique per follower and store", () => {
  assert.deepEqual(
    StoreFollow.schema.indexes().find(([fields, options]) => options.unique && fields.storeProfileId)?.[0],
    { followerId: 1, storeProfileId: 1 }
  );
});

test("store follower count is public and only counts active stores", async () => {
  const originalFindOne = StoreProfile.findOne;
  const originalCountDocuments = StoreFollow.countDocuments;
  let storeFilter;
  let followFilter;
  StoreProfile.findOne = (filter) => {
    storeFilter = filter;
    return query({ _id: STORE_ID });
  };
  StoreFollow.countDocuments = async (filter) => {
    followFilter = filter;
    return 4;
  };

  try {
    const route = getRoute("get", "/store/:storeId/count");
    const result = await invoke(route.stack.at(-1).handle, { params: { storeId: STORE_ID } });
    assert.equal(result.statusCode, 200);
    assert.deepEqual(result.body, { count: 4 });
    assert.deepEqual(storeFilter, { _id: STORE_ID, status: "active" });
    assert.deepEqual(followFilter, { storeProfileId: STORE_ID });
  } finally {
    StoreProfile.findOne = originalFindOne;
    StoreFollow.countDocuments = originalCountDocuments;
  }
});

test("following a store toggles only the current user's store-specific relationship", async () => {
  const originals = {
    profileFindOne: StoreProfile.findOne,
    followFindOne: StoreFollow.findOne,
    followCreate: StoreFollow.create,
    followCountDocuments: StoreFollow.countDocuments
  };
  let createdFollow;
  StoreProfile.findOne = () => query({ _id: STORE_ID, userId: "111111111111111111111111" });
  StoreFollow.findOne = () => query(null);
  StoreFollow.create = async (follow) => { createdFollow = follow; };
  StoreFollow.countDocuments = async () => 1;

  try {
    const route = getRoute("post", "/store/:storeId");
    assert.ok(route.stack.length > 1, "store follow endpoint requires authentication");
    const result = await invoke(route.stack.at(-1).handle, {
      params: { storeId: STORE_ID },
      user: { id: FOLLOWER_ID }
    });
    assert.equal(result.statusCode, 200);
    assert.deepEqual(result.body, { following: true, count: 1 });
    assert.deepEqual(createdFollow, { followerId: FOLLOWER_ID, storeProfileId: STORE_ID });
  } finally {
    StoreProfile.findOne = originals.profileFindOne;
    StoreFollow.findOne = originals.followFindOne;
    StoreFollow.create = originals.followCreate;
    StoreFollow.countDocuments = originals.followCountDocuments;
  }
});
