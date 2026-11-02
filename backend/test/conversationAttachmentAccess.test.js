import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import cookieParser from "cookie-parser";
import { once } from "node:events";

const originalAccessSecret = process.env.JWT_ACCESS_SECRET;
const originalRefreshSecret = process.env.JWT_REFRESH_SECRET;
process.env.JWT_ACCESS_SECRET = "conversation-attachment-test-access-secret";
process.env.JWT_REFRESH_SECRET = "conversation-attachment-test-refresh-secret";

const [{ default: router }, { default: User }, { default: Conversation }, { default: ConversationMessage }, jwtConfig] =
  await Promise.all([
    import("../src/routes/conversations.js"),
    import("../src/models/User.js"),
    import("../src/models/Conversation.js"),
    import("../src/models/ConversationMessage.js"),
    import("../src/config/jwt.js")
  ]);

let server;
let baseUrl;
const originalUserFindById = User.findById;
const originalConversationFindOne = Conversation.findOne;
const originalMessageFindOne = ConversationMessage.findOne;

before(async () => {
  const app = express();
  app.use(cookieParser());
  app.use("/api/conversations", router);
  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
  User.findById = originalUserFindById;
  Conversation.findOne = originalConversationFindOne;
  ConversationMessage.findOne = originalMessageFindOne;
  if (originalAccessSecret === undefined) delete process.env.JWT_ACCESS_SECRET;
  else process.env.JWT_ACCESS_SECRET = originalAccessSecret;
  if (originalRefreshSecret === undefined) delete process.env.JWT_REFRESH_SECRET;
  else process.env.JWT_REFRESH_SECRET = originalRefreshSecret;
});

test("conversation attachment requests reject nonparticipants before checking files", async () => {
  const userId = "user-without-membership";
  let messageLookups = 0;
  User.findById = () => ({
    lean: async () => ({
      _id: { toString: () => userId },
      role: "user",
      isDisabled: false,
      isDeleted: false
    })
  });
  Conversation.findOne = () => ({
    select() {
      return this;
    },
    lean: async () => null
  });
  ConversationMessage.findOne = () => {
    messageLookups += 1;
    return { select() { return this; }, lean: async () => ({ _id: "message" }) };
  };

  const token = jwtConfig.signAccessToken({ id: userId });
  const response = await fetch(`${baseUrl}/api/conversations/conversation-id/attachments/private.jpg`, {
    headers: { Cookie: `accessToken=${token}` }
  });

  assert.equal(response.status, 404);
  assert.equal(messageLookups, 0);
});
