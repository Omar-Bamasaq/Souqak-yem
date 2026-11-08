import test from "node:test";
import assert from "node:assert/strict";
import quoteRequestsRouter from "../src/routes/quoteRequests.js";
import QuoteRequest from "../src/models/QuoteRequest.js";
import optionalAuth, { getOptionalAuthTokens } from "../src/middleware/optionalAuth.js";

function routeHandler(method, routePath) {
  const route = quoteRequestsRouter.stack.find((layer) => layer.route?.path === routePath && layer.route.methods[method]);
  assert.ok(route, `Expected ${method.toUpperCase()} ${routePath} to exist`);
  return route.route.stack.at(-1).handle;
}

async function invoke(handler, request) {
  const result = { statusCode: 200, body: null };
  const response = {
    status(code) { result.statusCode = code; return this; },
    json(body) { result.body = body; return this; }
  };
  await handler(request, response);
  return result;
}

function resolvedQuery(value) {
  return {
    select() { return this; },
    lean: async () => value
  };
}

test("quote request schema stores required location, quantity, image, and offer details", () => {
  assert.ok(QuoteRequest.schema.path("ownerId"));
  assert.ok(QuoteRequest.schema.path("governorateId"));
  assert.ok(QuoteRequest.schema.path("cityId"));
  assert.ok(QuoteRequest.schema.path("quantity"));
  assert.ok(QuoteRequest.schema.path("image"));
  assert.ok(QuoteRequest.schema.path("offers"));
  assert.deepEqual(QuoteRequest.schema.path("status").enumValues, ["open", "closed", "cancelled", "awarded"]);
});

test("quote request details use optional auth to identify the owner", () => {
  const route = quoteRequestsRouter.stack.find((layer) => layer.route?.path === "/:id" && layer.route.methods.get);
  assert.ok(route);
  assert.equal(route.route.stack[0].handle, optionalAuth);
});

test("optional auth ignores query-string tokens on sensitive details routes", () => {
  const queryOnly = getOptionalAuthTokens({
    headers: {},
    cookies: {},
    query: { access_token: "query-token" }
  });
  assert.deepEqual(queryOnly, []);

  const acceptedTokens = getOptionalAuthTokens({
    headers: { authorization: "Bearer header-token" },
    cookies: { accessToken: "cookie-token", token: "legacy-token" },
    query: { access_token: "query-token" }
  });
  assert.deepEqual(acceptedTokens, [
    { source: "header", token: "header-token" },
    { source: "cookie", token: "cookie-token" },
    { source: "cookie-legacy", token: "legacy-token" }
  ]);
});

test("offer creation rejects missing and malformed prices before database access", async () => {
  const handler = routeHandler("post", "/:id/offers");
  const result = await invoke(handler, {
    params: { id: "507f1f77bcf86cd799439011" },
    user: { id: "507f1f77bcf86cd799439012" },
    body: { price: "not-a-price", availableQuantity: 2, currency: "YER_ADEN" }
  });
  assert.equal(result.statusCode, 400);
  assert.match(result.body.error, /صحيح/);
});

test("offer creation blocks the request owner", async () => {
  const originalFindOneAndUpdate = QuoteRequest.findOneAndUpdate;
  const originalFindById = QuoteRequest.findById;
  let updateFilter;
  QuoteRequest.findOneAndUpdate = (filter) => {
    updateFilter = filter;
    return resolvedQuery(null);
  };
  QuoteRequest.findById = () => resolvedQuery({ ownerId: "507f1f77bcf86cd799439012", status: "open" });
  try {
    const result = await invoke(routeHandler("post", "/:id/offers"), {
      params: { id: "507f1f77bcf86cd799439011" },
      user: { id: "507f1f77bcf86cd799439012" },
      body: { price: "100", availableQuantity: "2", currency: "YER_ADEN" },
      app: null
    });
    assert.equal(result.statusCode, 403);
    assert.equal(updateFilter.status, "open");
    assert.equal(updateFilter.ownerId.$ne, "507f1f77bcf86cd799439012");
  } finally {
    QuoteRequest.findOneAndUpdate = originalFindOneAndUpdate;
    QuoteRequest.findById = originalFindById;
  }
});

test("offer creation rejects requests that were closed before the offer update", async () => {
  const originalFindOneAndUpdate = QuoteRequest.findOneAndUpdate;
  const originalFindById = QuoteRequest.findById;
  QuoteRequest.findOneAndUpdate = () => resolvedQuery(null);
  QuoteRequest.findById = () => resolvedQuery({ ownerId: "507f1f77bcf86cd799439011", status: "closed" });
  try {
    const result = await invoke(routeHandler("post", "/:id/offers"), {
      params: { id: "507f1f77bcf86cd799439011" },
      user: { id: "507f1f77bcf86cd799439012" },
      body: { price: "100", availableQuantity: "2", currency: "YER_ADEN" },
      app: null
    });
    assert.equal(result.statusCode, 409);
    assert.match(result.body.error, /مغلق/);
  } finally {
    QuoteRequest.findOneAndUpdate = originalFindOneAndUpdate;
    QuoteRequest.findById = originalFindById;
  }
});

test("only the owner can close an open quote request", async () => {
  const originalFindOneAndUpdate = QuoteRequest.findOneAndUpdate;
  const originalFindById = QuoteRequest.findById;
  QuoteRequest.findOneAndUpdate = () => resolvedQuery(null);
  QuoteRequest.findById = () => resolvedQuery({ ownerId: "507f1f77bcf86cd799439013", status: "open" });
  try {
    const result = await invoke(routeHandler("patch", "/:id/status"), {
      params: { id: "507f1f77bcf86cd799439011" },
      user: { id: "507f1f77bcf86cd799439012" },
      body: { status: "closed" }
    });
    assert.equal(result.statusCode, 403);
  } finally {
    QuoteRequest.findOneAndUpdate = originalFindOneAndUpdate;
    QuoteRequest.findById = originalFindById;
  }
});
