import test from "node:test";
import assert from "node:assert/strict";
import followsRouter from "../src/routes/followsUsers.js";

test("followers list is available to seller and user accounts only", () => {
  const route = followsRouter.stack.find((layer) =>
    layer.route?.path === "/followers/mine" && layer.route.methods.get
  )?.route;
  assert.ok(route);

  const roleGuard = route.stack[1].handle;
  const runGuard = (role) => {
    const response = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      json() { return this; }
    };
    let allowed = false;
    roleGuard({ user: role ? { role } : undefined }, response, () => { allowed = true; });
    return { allowed, statusCode: response.statusCode };
  };

  assert.deepEqual(runGuard("seller"), { allowed: true, statusCode: 200 });
  assert.deepEqual(runGuard("user"), { allowed: true, statusCode: 200 });
  assert.deepEqual(runGuard("buyer"), { allowed: false, statusCode: 403 });
});
