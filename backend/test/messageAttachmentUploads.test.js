import test from "node:test";
import assert from "node:assert/strict";
import { rejectClientSuppliedAttachmentRefs } from "../src/middleware/messageAttachments.js";

function response() {
  return {
    statusCode: null,
    body: null,
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    }
  };
}

test("message attachment middleware rejects client-supplied image references", () => {
  const res = response();
  let nextCalled = false;

  rejectClientSuppliedAttachmentRefs(
    { body: { images: ["private/another-users-file.jpg"] } },
    res,
    () => {
      nextCalled = true;
    }
  );

  assert.equal(res.statusCode, 400);
  assert.match(res.body.error, /المرفقات/);
  assert.equal(nextCalled, false);
});

test("message attachment middleware allows requests without image references", () => {
  let nextCalled = false;

  rejectClientSuppliedAttachmentRefs(
    { body: { text: "رسالة نصية" } },
    response(),
    () => {
      nextCalled = true;
    }
  );

  assert.equal(nextCalled, true);
});
