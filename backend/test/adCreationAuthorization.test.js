import test from "node:test";
import assert from "node:assert/strict";
import adsRouter from "../src/routes/ads.js";

test("POST /api/ads authorization preserves legacy roles and allows users", () => {
  const routeLayer = adsRouter.stack.find(
    (layer) => layer.route?.path === "/" && layer.route.methods.post
  );
  assert.ok(routeLayer, "POST /api/ads route must exist");

  const roleGuard = routeLayer.route.stack.find((layer) =>
    layer.handle.toString().includes("roles.includes(req.user.role)")
  );
  assert.ok(roleGuard, "POST /api/ads must have a role guard");

  for (const role of ["user", "seller", "admin"]) {
    let nextCalled = false;
    let statusCode = null;
    const req = { user: { role } };
    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json() {
        return this;
      }
    };

    roleGuard.handle(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, true, `${role} should pass POST /api/ads authorization`);
    assert.equal(statusCode, null, `${role} should not receive 403`);
  }

  let nextCalled = false;
  let statusCode = null;
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json() {
      return this;
    }
  };

  roleGuard.handle({ user: { role: "buyer" } }, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false, "buyer legacy role should remain restricted from ad creation");
  assert.equal(statusCode, 403);
});
