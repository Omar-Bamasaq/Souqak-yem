import test from "node:test";
import assert from "node:assert/strict";
import authRouter from "../src/routes/auth.js";
import User from "../src/models/User.js";
import OtpCode from "../src/models/OtpCode.js";

function getFirstHandler(path) {
  const route = authRouter.stack.find((layer) => layer.route?.path === path && layer.route.methods.post);
  assert.ok(route, `POST ${path} route exists`);
  return route.route.stack[0].handle;
}

function getLastHandler(path) {
  const route = authRouter.stack.find((layer) => layer.route?.path === path && layer.route.methods.post);
  assert.ok(route, `POST ${path} route exists`);
  return route.route.stack.at(-1).handle;
}

async function invoke(handler, request = {}) {
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
  await handler(request, response);
  return result;
}

test("legacy email signup and email OTP registration routes are disabled", async () => {
  for (const path of ["/register-email", "/verify-email", "/resend-otp", "/register"]) {
    const response = await invoke(getFirstHandler(path));
    assert.equal(response.statusCode, 410, `${path} rejects new registration`);
  }
});

test("ordinary accounts cannot start or complete email password recovery", async () => {
  const originalFindOne = User.findOne;
  const originalOtpFindOne = OtpCode.findOne;
  let otpLookupCount = 0;
  try {
    User.findOne = async () => ({ role: "user" });
    OtpCode.findOne = () => {
      otpLookupCount += 1;
      throw new Error("Ordinary account recovery should stop before OTP lookup.");
    };

    const forgot = await invoke(getLastHandler("/forgot-password"), {
      body: { email: "ordinary@example.com" }
    });
    const verify = await invoke(getLastHandler("/verify-reset-otp"), {
      body: { email: "ordinary@example.com", code: "123456" }
    });
    const reset = await invoke(getLastHandler("/reset-password"), {
      body: { email: "ordinary@example.com", code: "123456", newPassword: "ValidPassword1" }
    });

    assert.equal(forgot.statusCode, 403);
    assert.equal(verify.statusCode, 403);
    assert.equal(reset.statusCode, 403);
    assert.equal(otpLookupCount, 0);
  } finally {
    User.findOne = originalFindOne;
    OtpCode.findOne = originalOtpFindOne;
  }
});
