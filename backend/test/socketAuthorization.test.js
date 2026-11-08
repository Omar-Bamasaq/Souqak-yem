import test from "node:test";
import assert from "node:assert/strict";
import {
  getAuthenticatedSocketUserId,
  getSocketAccessToken,
  isChatParticipant,
  isConversationParticipant
} from "../src/utils/socketAuthorization.js";

test("socket access token prefers the access cookie and safely decodes values", () => {
  assert.equal(
    getSocketAccessToken("other=value; token=legacy.token; accessToken=access%2Btoken"),
    "access+token"
  );
  assert.equal(getSocketAccessToken("token=legacy.token"), "legacy.token");
  assert.equal(getSocketAccessToken("accessToken=%E0%A4%A"), null);
});

test("socket identity is derived from the verified token and must match the requested id", () => {
  const verify = (token) => {
    assert.equal(token, "signed.token");
    return { id: "verified-user" };
  };
  assert.equal(
    getAuthenticatedSocketUserId("signed.token", "verified-user", verify),
    "verified-user"
  );
  assert.equal(getAuthenticatedSocketUserId("signed.token", "other-user", verify), null);
  assert.equal(getAuthenticatedSocketUserId(null, "verified-user", verify), null);
});

test("conversation room authorization requires a valid id and membership", async () => {
  const queries = [];
  const Conversation = {
    async exists(filter) {
      queries.push(filter);
      return filter.participants === "verified-user" ? { _id: filter._id } : null;
    }
  };
  const conversationId = "507f1f77bcf86cd799439011";

  assert.equal(
    await isConversationParticipant(Conversation, "verified-user", conversationId),
    true
  );
  assert.equal(
    await isConversationParticipant(Conversation, "other-user", conversationId),
    false
  );
  assert.equal(await isConversationParticipant(Conversation, null, conversationId), false);
  assert.equal(
    await isConversationParticipant(Conversation, "verified-user", "not-an-object-id"),
    false
  );
  assert.deepEqual(queries[0], {
    _id: conversationId,
    participants: "verified-user"
  });
  assert.equal(queries.length, 2);
});

test("product chat room authorization requires a valid buyer or seller participant", async () => {
  const queries = [];
  const Chat = {
    async exists(filter) {
      queries.push(filter);
      return filter.$or.some((participant) => Object.values(participant)[0] === "verified-user");
    }
  };
  const chatId = "507f1f77bcf86cd799439012";

  assert.equal(await isChatParticipant(Chat, "verified-user", chatId), true);
  assert.equal(await isChatParticipant(Chat, "other-user", chatId), false);
  assert.equal(await isChatParticipant(Chat, null, chatId), false);
  assert.equal(await isChatParticipant(Chat, "verified-user", "not-an-object-id"), false);
  assert.deepEqual(queries[0], {
    _id: chatId,
    $or: [{ buyer: "verified-user" }, { seller: "verified-user" }]
  });
  assert.equal(queries.length, 2);
});
