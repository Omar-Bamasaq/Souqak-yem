import test from "node:test";
import assert from "node:assert/strict";
import {
  getAuthenticatedSocketUserId,
  getSocketAccessToken,
  isConversationParticipant
} from "../src/utils/socketAuthorization.js";

test("socket access token comes from the authenticated cookie", () => {
  assert.equal(getSocketAccessToken("other=value; accessToken=access%2Etoken"), "access.token");
  assert.equal(getSocketAccessToken("token=legacy.token"), "legacy.token");
  assert.equal(getSocketAccessToken("accessToken=%E0%A4%A"), null);
});

test("socket identity is derived from the verified token, not the client id", () => {
  const verify = (token) => {
    assert.equal(token, "signed.token");
    return { id: "verified-user" };
  };
  assert.equal(getAuthenticatedSocketUserId("signed.token", "verified-user", verify), "verified-user");
  assert.equal(getAuthenticatedSocketUserId("signed.token", "other-user", verify), null);
  assert.equal(getAuthenticatedSocketUserId(null, "verified-user", verify), null);
});

test("conversation room authorization requires a valid id and membership", async () => {
  let query;
  const Conversation = {
    async exists(filter) {
      query = filter;
      return filter.participants === "verified-user" ? { _id: filter._id } : null;
    }
  };
  const conversationId = "507f1f77bcf86cd799439011";

  assert.equal(
    await isConversationParticipant(Conversation, "verified-user", conversationId),
    true
  );
  assert.deepEqual(query, { _id: conversationId, participants: "verified-user" });
  assert.equal(
    await isConversationParticipant(Conversation, "other-user", conversationId),
    false
  );
  assert.equal(
    await isConversationParticipant(Conversation, "verified-user", "not-an-object-id"),
    false
  );
});
