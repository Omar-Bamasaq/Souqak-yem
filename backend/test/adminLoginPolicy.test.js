import test from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import authRouter from "../src/routes/auth.js";
import User from "../src/models/User.js";
import ReferralEngine from "../src/engines/ReferralEngine.js";
import { requireRole } from "../src/middleware/roles.js";

function getRouteHandler(path) {
  const route = authRouter.stack.find((layer) => layer.route?.path === path && layer.route.methods.post);
  assert.ok(route, `POST ${path} route exists`);
  return route.route.stack.at(-1).handle;
}

async function invoke(handler, body) {
  const result = { statusCode: 200, body: null, cookies: {} };
  const response = {
    cookie(name, value) {
      result.cookies[name] = value;
      return this;
    },
    status(statusCode) {
      result.statusCode = statusCode;
      return this;
    },
    json(bodyValue) {
      result.body = bodyValue;
      return this;
    }
  };
  await handler({
    body,
    ip: "127.0.0.1",
    method: "POST",
    originalUrl: "/api/auth/login",
    headers: {}
  }, response);
  return result;
}

test("admin login rejects non-admin roles without creating a session", async () => {
  const originalFindOne = User.findOne;
  const originalCompare = bcrypt.compare;
  const user = { _id: "ordinary-user", role: "user" };
  let passwordChecked = false;
  try {
    User.findOne = async () => user;
    bcrypt.compare = async () => {
      passwordChecked = true;
      return true;
    };

    const response = await invoke(getRouteHandler("/login"), {
      email: "user@example.com",
      password: "correct-password",
      adminLogin: true
    });

    assert.equal(response.statusCode, 403);
    assert.equal(passwordChecked, false);
    assert.deepEqual(response.cookies, {});
  } finally {
    User.findOne = originalFindOne;
    bcrypt.compare = originalCompare;
  }
});

test("admin login uses the existing token and cookie session for admins", async () => {
  const originals = {
    findOne: User.findOne,
    findByIdAndUpdate: User.findByIdAndUpdate,
    compare: bcrypt.compare,
    ensureProfile: ReferralEngine.ensureProfile
  };
  const user = {
    _id: { toString: () => "admin-user" },
    email: "admin@example.com",
    name: "Admin",
    role: "admin",
    password: "stored-hash",
    save: async () => {}
  };
  try {
    User.findOne = async () => user;
    User.findByIdAndUpdate = async () => user;
    bcrypt.compare = async () => true;
    ReferralEngine.ensureProfile = async () => {};

    const response = await invoke(getRouteHandler("/login"), {
      email: user.email,
      password: "correct-password",
      adminLogin: true
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.user.role, "admin");
    assert.ok(response.body.token);
    assert.ok(response.cookies.accessToken);
    assert.ok(response.cookies.refreshToken);
  } finally {
    User.findOne = originals.findOne;
    User.findByIdAndUpdate = originals.findByIdAndUpdate;
    bcrypt.compare = originals.compare;
    ReferralEngine.ensureProfile = originals.ensureProfile;
  }
});

test("ordinary users retain username login and the existing session cookies", async () => {
  const originals = {
    findOne: User.findOne,
    findByIdAndUpdate: User.findByIdAndUpdate,
    compare: bcrypt.compare
  };
  const user = {
    _id: { toString: () => "ordinary-user" },
    name: "ordinary-user",
    email: "ordinary@phone.local",
    phone: "712345678",
    role: "user",
    password: "stored-hash",
    save: async () => {}
  };
  try {
    User.findOne = async (query) => query?.name ? user : null;
    User.findByIdAndUpdate = async () => user;
    bcrypt.compare = async () => true;

    const response = await invoke(getRouteHandler("/phone-login"), {
      identifier: user.name,
      password: "correct-password"
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.user.name, user.name);
    assert.equal(response.body.user.role, "user");
    assert.ok(response.cookies.accessToken);
    assert.ok(response.cookies.refreshToken);
  } finally {
    User.findOne = originals.findOne;
    User.findByIdAndUpdate = originals.findByIdAndUpdate;
    bcrypt.compare = originals.compare;
  }
});

test("direct admin API authorization rejects users without admin privileges", async () => {
  const guard = requireRole(["admin"]);
  const result = { statusCode: null, continued: false };
  const response = {
    status(statusCode) {
      result.statusCode = statusCode;
      return this;
    },
    json() {
      return this;
    }
  };

  guard({ user: { role: "user" } }, response, () => {
    result.continued = true;
  });

  assert.equal(result.statusCode, 403);
  assert.equal(result.continued, false);
});
