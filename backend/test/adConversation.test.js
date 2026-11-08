import test from "node:test";
import assert from "node:assert/strict";
import {
  buildAdConversationFilter,
  findOrCreateAdConversation
} from "../src/services/adConversation.js";
import Conversation from "../src/models/Conversation.js";

function createConversationModel(documents = []) {
  const calls = { filters: [], creates: [], saves: 0 };
  const model = {
    find(filter) {
      calls.filters.push(filter);
      return {
        sort() {
          return Promise.resolve(documents
            .filter((document) => !document.mergedInto)
            .sort((left, right) => new Date(left.createdAt) - new Date(right.createdAt)));
        }
      };
    },
    async create(document) {
      calls.creates.push(document);
      return { ...document, _id: "new-conversation" };
    }
  };
  return { model, calls };
}

function conversation(properties) {
  return {
    mutedFor: [],
    pinnedBy: [],
    deletedBy: [],
    async save() {
      this._saved = true;
    },
    ...properties
  };
}

test("uses one ad conversation lookup regardless of participant order or legacy adModel", () => {
  const filter = buildAdConversationFilter("ad-1", ["buyer-1", "seller-1"]);

  assert.deepEqual(filter, {
    adId: "ad-1",
    type: { $ne: "DISPUTE" },
    participants: { $all: ["buyer-1", "seller-1"] },
    mergedInto: { $exists: false }
  });
  assert.equal(Object.hasOwn(filter, "adModel"), false);
});

test("consolidates duplicate ad conversations and preserves their messages and favorite notice", async () => {
  const oldest = conversation({
    _id: "conversation-1",
    adId: "ad-1",
    participants: ["buyer-1", "seller-1"],
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    lastMessage: ""
  });
  const newest = conversation({
    _id: "conversation-2",
    adId: "ad-1",
    participants: ["seller-1", "buyer-1"],
    createdAt: new Date("2026-01-02T00:00:00Z"),
    updatedAt: new Date("2026-01-03T00:00:00Z"),
    lastMessage: "مرحبا",
    favoriteNotice: { text: "تمت الإضافة للمفضلة", createdAt: new Date("2026-01-02T12:00:00Z") },
    pinnedBy: ["buyer-1"]
  });
  const { model, calls } = createConversationModel([oldest, newest]);
  const movedMessages = [];
  const messageModel = {
    async updateMany(filter, update) {
      movedMessages.push({ filter, update });
    }
  };

  const result = await findOrCreateAdConversation({
    adId: "ad-1",
    participants: ["buyer-1", "seller-1"],
    conversationModel: model,
    messageModel
  });

  assert.equal(result.created, false);
  assert.equal(result.conversation, oldest);
  assert.equal(calls.creates.length, 0);
  assert.equal(oldest.adModel, "Ad");
  assert.equal(oldest.lastMessage, "مرحبا");
  assert.equal(oldest.favoriteNotice.text, "تمت الإضافة للمفضلة");
  assert.deepEqual(oldest.pinnedBy, ["buyer-1"]);
  assert.equal(newest.mergedInto, oldest._id);
  assert.equal(movedMessages.length, 1);
  assert.equal(movedMessages[0].filter.conversationId, newest._id);
  assert.equal(movedMessages[0].update.$set.conversationId, oldest._id);
  assert.equal(calls.filters[0].adModel, undefined);
});

test("stores the Ad model and creates only when no matching conversation exists", async () => {
  const { model, calls } = createConversationModel();

  const result = await findOrCreateAdConversation({
    adId: "ad-1",
    participants: ["buyer-1", "seller-1"],
    conversationModel: model,
    messageModel: {}
  });

  assert.equal(result.created, true);
  assert.equal(result.conversation.adModel, "Ad");
  assert.equal(calls.creates.length, 1);
  assert.equal(Conversation.schema.path("adModel").options.default, "Ad");
});
