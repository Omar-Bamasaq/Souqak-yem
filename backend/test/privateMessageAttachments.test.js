import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import express from "express";
import publicUploads from "../src/middleware/publicUploads.js";
import {
  createLegacyMessageAttachmentGuard,
  createPrivateMessageAttachmentsRouter
} from "../src/routes/privateMessageAttachments.js";
import { privateMessageAttachmentPath } from "../../frontend/src/lib/privateMessageAttachments.js";
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

const conversationId = "aaaaaaaaaaaaaaaaaaaaaaaa";
const conversationMessageId = "bbbbbbbbbbbbbbbbbbbbbbbb";
const supportConversationId = "cccccccccccccccccccccccc";
const supportMessageId = "dddddddddddddddddddddddd";
const memberId = "member-user";
const otherUserId = "other-user";
const supportOwnerId = "support-owner";
const supervisorId = "support-supervisor";
const privateConversationFilename = "11111111-1111-4111-8111-111111111111.jpg";
const legacyConversationFilename = "a2222222-bbbb-4ccc-8ddd-eeeeeeeeeeee.png";
const privateSupportFilename = "33333333-3333-4333-8333-333333333333.jpg";
const publicFilename = "public-ad-image.jpg";

let temporaryRoot;
let publicDirectory;
let privateDirectory;
let baseUrl;
let server;
const conversationMessages = [];
const supportMessages = [];
const conversations = [];
const supportConversations = [];

function matches(record, filter) {
  if (filter._id && String(record._id) !== String(filter._id)) return false;
  if (filter.conversationId && String(record.conversationId) !== String(filter.conversationId)) return false;
  if (filter.images?.$in && !record.images?.some((image) => filter.images.$in.some((reference) => (
    reference instanceof RegExp ? reference.test(image) : reference === image
  )))) return false;
  return true;
}

function mockModel(records) {
  return {
    findOne(filter) {
      const record = records.find((item) => matches(item, filter)) || null;
      return { lean: async () => record };
    },
    async exists(filter) {
      return records.some((record) => matches(record, filter)) ? { _id: "matched" } : null;
    }
  };
}

function addFixtures() {
  conversationMessages.splice(0, conversationMessages.length,
    {
      _id: conversationMessageId,
      conversationId,
      images: [`private/${privateConversationFilename}`],
      deletedBy: []
    },
    {
      _id: "eeeeeeeeeeeeeeeeeeeeeeee",
      conversationId,
      images: [legacyConversationFilename],
      deletedBy: []
    }
  );
  supportMessages.splice(0, supportMessages.length, {
    _id: supportMessageId,
    conversationId: supportConversationId,
    images: [`private/${privateSupportFilename}`]
  });
  conversations.splice(0, conversations.length, {
    _id: conversationId,
    participants: [memberId, otherUserId]
  });
  supportConversations.splice(0, supportConversations.length, {
    _id: supportConversationId,
    userId: supportOwnerId
  });
}

const models = {
  Conversation: mockModel(conversations),
  ConversationMessage: mockModel(conversationMessages),
  SupportConversation: mockModel(supportConversations),
  SupportMessage: mockModel(supportMessages)
};

const testAuthentication = (req, res, next) => {
  const userId = req.get("x-test-user");
  if (!userId) return res.sendStatus(401);
  req.user = {
    id: userId,
    role: userId === "admin" ? "admin" : userId === supervisorId ? "supervisor" : "user",
    permissions: userId === supervisorId ? ["support_inbox"] : []
  };
  return next();
};

before(async () => {
  temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "souqak-private-attachments-"));
  publicDirectory = path.join(temporaryRoot, "public");
  privateDirectory = path.join(temporaryRoot, "private");
  await Promise.all([
    fs.mkdir(publicDirectory),
    fs.mkdir(privateDirectory)
  ]);
  addFixtures();
  await Promise.all([
    fs.writeFile(path.join(privateDirectory, privateConversationFilename), "private conversation fixture"),
    fs.writeFile(path.join(privateDirectory, privateSupportFilename), "private support fixture"),
    fs.writeFile(path.join(publicDirectory, privateConversationFilename), "public collision fixture"),
    fs.writeFile(path.join(publicDirectory, legacyConversationFilename), "legacy attachment fixture"),
    fs.writeFile(path.join(publicDirectory, publicFilename), "public image fixture")
  ]);

  const app = express();
  app.use("/api/message-attachments", createPrivateMessageAttachmentsRouter({
    authMiddleware: testAuthentication,
    models,
    directories: { private: privateDirectory, public: publicDirectory }
  }));
  app.use("/uploads", createLegacyMessageAttachmentGuard({ models }), publicUploads, express.static(publicDirectory));
  app.use((_error, _req, res, _next) => res.sendStatus(500));
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server?.listening) await new Promise((resolve) => server.close(resolve));
  if (temporaryRoot) await fs.rm(temporaryRoot, { recursive: true, force: true });
});

function attachmentUrl(kind, convId, messageId, filename) {
  return `${baseUrl}/api${privateMessageAttachmentPath(kind, convId, messageId, filename)}`;
}

function asUser(userId, options = {}) {
  return fetch(attachmentUrl(...options.route), {
    headers: userId ? { "x-test-user": userId } : {}
  });
}

test("a conversation participant can retrieve a referenced private attachment", async () => {
  const response = await asUser(memberId, {
    route: ["conversations", conversationId, conversationMessageId, `private/${privateConversationFilename}`]
  });
  assert.equal(response.status, 200);
  assert.match(response.headers.get("cache-control"), /no-store/);
  assert.equal(await response.text(), "private conversation fixture");
});

test("a nonparticipant cannot retrieve a conversation attachment", async () => {
  const response = await asUser("unrelated-user", {
    route: ["conversations", conversationId, conversationMessageId, privateConversationFilename]
  });
  assert.equal(response.status, 403);
});

test("a legacy conversation attachment remains available only through the authorized endpoint", async () => {
  const legacyMessageId = "eeeeeeeeeeeeeeeeeeeeeeee";
  const response = await asUser(memberId, {
    route: ["conversations", conversationId, legacyMessageId, legacyConversationFilename]
  });
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "legacy attachment fixture");
});

test("a support-ticket owner can retrieve a referenced private attachment", async () => {
  const response = await asUser(supportOwnerId, {
    route: ["support", supportConversationId, supportMessageId, privateSupportFilename]
  });
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "private support fixture");
});

test("a different user cannot retrieve a support-ticket attachment", async () => {
  const response = await asUser(otherUserId, {
    route: ["support", supportConversationId, supportMessageId, privateSupportFilename]
  });
  assert.equal(response.status, 403);
});

test("a supervisor with the existing support inbox permission can retrieve support attachments", async () => {
  const response = await asUser(supervisorId, {
    route: ["support", supportConversationId, supportMessageId, privateSupportFilename]
  });
  assert.equal(response.status, 200);
});

test("an administrator can retrieve attachments under the existing admin access", async () => {
  const response = await asUser("admin", {
    route: ["conversations", conversationId, conversationMessageId, privateConversationFilename]
  });
  assert.equal(response.status, 200);
});

test("an unauthenticated request is rejected", async () => {
  const response = await asUser(null, {
    route: ["conversations", conversationId, conversationMessageId, privateConversationFilename]
  });
  assert.equal(response.status, 401);
});

test("encoded path traversal does not resolve to an attachment", async () => {
  const response = await fetch(
    `${baseUrl}/api/message-attachments/conversations/${conversationId}/${conversationMessageId}/%2e%2e%2f${privateConversationFilename}`,
    { headers: { "x-test-user": memberId } }
  );
  assert.equal(response.status, 404);
});

test("private files and legacy message attachments are not served by public static", async () => {
  const legacyResponse = await fetch(`${baseUrl}/uploads/${legacyConversationFilename}`);
  const caseVariantResponse = await fetch(
    `${baseUrl}/uploads/${legacyConversationFilename.toUpperCase()}`
  );
  const privateResponse = await fetch(`${baseUrl}/uploads/${privateConversationFilename}`);
  assert.equal(legacyResponse.status, 404);
  assert.equal(caseVariantResponse.status, 404);
  assert.equal(privateResponse.status, 404);
  assert.equal(path.dirname(path.resolve(privateDirectory, privateConversationFilename)), privateDirectory);
  assert.equal(path.relative(publicDirectory, privateDirectory).startsWith(".."), true);
});

test("unrelated public images remain available through the public uploads path", async () => {
  const response = await fetch(`${baseUrl}/uploads/${publicFilename}`);
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "public image fixture");
});

test("private attachment API paths contain no bearer token query parameter", () => {
  const apiPath = privateMessageAttachmentPath(
    "support",
    supportConversationId,
    supportMessageId,
    `private/${privateSupportFilename}`
  );
  assert.equal(apiPath.includes("?"), false);
  assert.equal(apiPath.includes("access_token"), false);
  assert.match(apiPath, /\/message-attachments\/support\//);
});

test("new message upload handlers store files outside the public uploads directory", async () => {
  const [uploadSource, conversationsSource, supportSource, indexSource] = await Promise.all([
    fs.readFile(new URL("../src/middleware/upload.js", import.meta.url), "utf8"),
    fs.readFile(new URL("../src/routes/conversations.js", import.meta.url), "utf8"),
    fs.readFile(new URL("../src/routes/support.js", import.meta.url), "utf8"),
    fs.readFile(new URL("../src/index.js", import.meta.url), "utf8")
  ]);

  assert.match(uploadSource, /destinationForFile:\s*\(\)\s*=>\s*privateMessageUploadsDirectory/);
  assert.match(conversationsSource, /uploadMessageImages\.array\("images",\s*5\)/);
  assert.match(supportSource, /uploadMessageImages\.array\("images",\s*5\)/);
  assert.ok(indexSource.indexOf('app.use("/uploads", legacyMessageAttachmentGuard)')
    < indexSource.indexOf('app.use("/uploads", publicUploads, express.static'));
  assert.ok(indexSource.includes('app.use("/api/message-attachments", privateMessageAttachmentsRouter)'));
});
