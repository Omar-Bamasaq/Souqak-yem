import test from "node:test";
import assert from "node:assert/strict";
import adminRouter from "../src/routes/admin.js";
import User from "../src/models/User.js";

const route = adminRouter.stack.find((entry) => entry.route?.path === "/users" && entry.route.methods.get);
assert.ok(route, "GET /users route exists");
const handler = route.route.stack.at(-1).handle;

test("admin user list shows phone registrations as phone contacts, not synthetic email", async () => {
  const originalFind = User.find;
  const users = [
    { _id: "phone-user", name: "Phone User", phone: "777888888", email: "777888888@phone.local" },
    { _id: "email-user", name: "Email User", phone: "711222333", email: "user@example.com" },
    { _id: "trial-user", name: "Trial User", phone: "700111222", email: "700111222@trial.local" }
  ];
  User.find = () => ({
    select() { return this; },
    sort() { return this; },
    lean: async () => users
  });

  const result = { statusCode: 200, body: null };
  const response = {
    status(statusCode) {
      result.statusCode = statusCode;
      return this;
    },
    json(body) {
      result.body = body;
      return this;
    }
  };

  try {
    await handler({ query: {} }, response);
    assert.equal(result.statusCode, 200);
    assert.deepEqual(
      result.body.map(({ phoneDisplay, emailDisplay }) => ({ phoneDisplay, emailDisplay })),
      [
        { phoneDisplay: "777888888", emailDisplay: "—" },
        { phoneDisplay: "—", emailDisplay: "user@example.com" },
        { phoneDisplay: "700111222", emailDisplay: "—" }
      ]
    );
  } finally {
    User.find = originalFind;
  }
});
