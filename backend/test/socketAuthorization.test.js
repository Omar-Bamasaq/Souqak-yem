import test from "node:test";
import assert from "node:assert/strict";
import {
  getAuthenticatedSocketUserId,
  getSocketAccessToken,
  isChatParticipant,
  isConversationParticipant
} from "../src/utils/socketAuthorization.js";

test("Socket cookie parsing prefers access token and safely decodes values", () => {
  assert.equal(
    getSocketAccessToken("token=legacy; accessToken=access%2Btoken"),
    "access+token"
  );
  assert.equal(getSocketAccessToken("token=legacy"), "legacy");
  assert.equal(getSocketAccessToken("accessToken=%E0%A4%A"), null);
});

test("Socket identity must match the verified token identity", () => {
  const verify = (token) => ({ userId: token });
  assert.equal(getAuthenticatedSocketUserId("user-a", "user-a", verify), "user-a");
  assert.equal(getAuthenticatedSocketUserId("user-a", "user-b", verify), null);
  assert.equal(getAuthenticatedSocketUserId(null, "user-a", verify), null);
});

test("Conversation room access requires a valid participant id", async () => {
  const queries = [];
  const model = {
    async exists(filter) {
      queries.push(filter);
      return filter.participants === "user-a";
    }
  };

  assert.equal(await isConversationParticipant(model, "user-a", "64d3d93a1a2b3c4d5e6f7788"), true);
  assert.equal(await isConversationParticipant(model, "user-b", "64d3d93a1a2b3c4d5e6f7788"), false);
  assert.equal(await isConversationParticipant(model, "user-a", "bad-id"), false);
  assert.equal(await isConversationParticipant(model, null, "64d3d93a1a2b3c4d5e6f7788"), false);
  assert.equal(queries.length, 2);
  assert.deepEqual(queries[0], {
    _id: "64d3d93a1a2b3c4d5e6f7788",
    participants: "user-a"
  });
});

test("Product chat room access requires a valid buyer or seller participant", async () => {
  const queries = [];
  const model = {
    async exists(filter) {
      queries.push(filter);
      return filter.$or.some((participant) => Object.values(participant)[0] === "user-a");
    }
  };

  assert.equal(await isChatParticipant(model, "user-a", "64d3d93a1a2b3c4d5e6f7788"), true);
  assert.equal(await isChatParticipant(model, "user-b", "64d3d93a1a2b3c4d5e6f7788"), false);
  assert.equal(await isChatParticipant(model, "user-a", "bad-id"), false);
  assert.equal(await isChatParticipant(model, null, "64d3d93a1a2b3c4d5e6f7788"), false);
  assert.equal(queries.length, 2);
  assert.deepEqual(queries[0], {
    _id: "64d3d93a1a2b3c4d5e6f7788",
    $or: [{ buyer: "user-a" }, { seller: "user-a" }]
  });
});
