import test from "node:test";
import assert from "node:assert/strict";
import {
  createPublicMessageAttachmentGuard,
  getUploadedMessageAttachmentNames,
  getMessageAttachmentLookupNames,
  isSafeMessageAttachmentFilename,
  rejectClientSuppliedAttachmentRefs
} from "../src/services/privateMessageAttachments.js";

test("message attachment filenames reject path traversal", () => {
  assert.equal(isSafeMessageAttachmentFilename("6f8f2f26.jpg"), true);
  assert.equal(isSafeMessageAttachmentFilename("../private.jpg"), false);
  assert.equal(isSafeMessageAttachmentFilename("folder/file.jpg"), false);
  assert.equal(isSafeMessageAttachmentFilename(""), false);
});

test("public attachment lookup protects generated image variants", () => {
  assert.deepEqual(getMessageAttachmentLookupNames("image.thumb.webp"), [
    "image.thumb.webp",
    "image.webp",
    "image.jpg",
    "image.jpeg",
    "image.png"
  ]);
});

test("public uploads reject files referenced by private message records", async () => {
  let nextCalled = false;
  let statusCode;
  const guard = createPublicMessageAttachmentGuard(async (filename) => filename === "private.jpg");
  await guard(
    { params: { filename: "private.jpg" } },
    {
      setHeader() {},
      sendStatus(status) {
        statusCode = status;
        return this;
      }
    },
    () => {
      nextCalled = true;
    }
  );

  assert.equal(statusCode, 404);
  assert.equal(nextCalled, false);
});

test("public upload guard passes unrelated image files through", async () => {
  let nextCalled = false;
  const guard = createPublicMessageAttachmentGuard(async () => false);
  await guard(
    { params: { filename: "public.jpg" } },
    { setHeader() {}, sendStatus() {} },
    () => {
      nextCalled = true;
    }
  );

  assert.equal(nextCalled, true);
});

test("message creation rejects client-supplied attachment names without a file upload", () => {
  let statusCode;
  let responseBody;
  let nextCalled = false;
  rejectClientSuppliedAttachmentRefs(
    { body: { images: ["known-private.jpg"] } },
    {
      status(status) {
        statusCode = status;
        return this;
      },
      json(body) {
        responseBody = body;
        return this;
      }
    },
    () => {
      nextCalled = true;
    }
  );

  assert.equal(statusCode, 400);
  assert.match(responseBody.error, /يجب رفع المرفقات/);
  assert.equal(nextCalled, false);
});

test("new message attachments are derived only from validated uploaded files", () => {
  assert.deepEqual(
    getUploadedMessageAttachmentNames([{ filename: "uploaded-image.jpg" }]),
    ["uploaded-image.jpg"]
  );
  assert.deepEqual(getUploadedMessageAttachmentNames(undefined), []);
  assert.throws(
    () => getUploadedMessageAttachmentNames([{ filename: "../known-private.jpg" }]),
    /invalid server-generated filename/i
  );
});
