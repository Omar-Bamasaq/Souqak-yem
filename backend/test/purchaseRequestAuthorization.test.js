import test from "node:test";
import assert from "node:assert/strict";
import purchaseRequestsRouter from "../src/routes/purchaseRequests.js";

test("ad promotion requests accept regular users who are allowed to publish ads", () => {
  const route = purchaseRequestsRouter.stack.find((layer) =>
    layer.route?.path === "/" && layer.route.methods.post
  )?.route;
  assert.ok(route);

  const roleGuard = route.stack[1].handle;
  const responseFor = () => ({
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json() { return this; }
  });
  const userResponse = responseFor();
  let userAllowed = false;
  roleGuard({ user: { role: "user" } }, userResponse, () => { userAllowed = true; });
  assert.equal(userAllowed, true);

  const unsupportedRoleResponse = responseFor();
  let unsupportedRoleAllowed = false;
  roleGuard({ user: { role: "buyer" } }, unsupportedRoleResponse, () => { unsupportedRoleAllowed = true; });
  assert.equal(unsupportedRoleAllowed, false);
  assert.equal(unsupportedRoleResponse.statusCode, 403);
});
