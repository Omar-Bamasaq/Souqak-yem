import Conversation from "../models/Conversation.js";
import ConversationMessage from "../models/ConversationMessage.js";

function uniqueIds(values) {
  return [...new Set(values.map((value) => String(value?._id || value)))];
}

function conversationFilter(adId, participants) {
  return {
    adId,
    type: { $ne: "DISPUTE" },
    participants: { $all: participants },
    mergedInto: { $exists: false }
  };
}

function mostRecentlyUpdated(conversations) {
  return [...conversations].sort(
    (left, right) => new Date(right.updatedAt || right.createdAt || 0) - new Date(left.updatedAt || left.createdAt || 0)
  )[0];
}

async function findMatchingConversations({ adId, participants, conversationModel }) {
  return conversationModel
    .find(conversationFilter(adId, participants))
    .sort({ createdAt: 1 });
}

export async function resolveCanonicalConversation(conversation, conversationModel = Conversation) {
  let canonical = conversation;
  const visited = new Set();
  while (canonical?.mergedInto) {
    const id = String(canonical.mergedInto);
    if (visited.has(id)) throw new Error("Circular merged conversation reference.");
    visited.add(id);
    canonical = await conversationModel.findById(id);
    if (!canonical) return null;
  }
  return canonical;
}

export async function consolidateAdConversations({
  adId,
  participants,
  conversationModel = Conversation,
  messageModel = ConversationMessage
}) {
  const participantIds = uniqueIds(participants);
  if (!adId || participantIds.length !== 2) {
    throw new Error("An ad conversation requires an ad and exactly two participants.");
  }

  const conversations = await findMatchingConversations({
    adId,
    participants: participantIds,
    conversationModel
  });
  if (conversations.length === 0) return null;

  const canonical = conversations[0];
  if (conversations.length === 1) {
    if (canonical.adModel !== "Ad") {
      canonical.adModel = "Ad";
      await canonical.save();
    }
    return canonical;
  }

  const latest = mostRecentlyUpdated(conversations);
  const latestFavoriteNotice = conversations
    .map((conversation) => conversation.favoriteNotice)
    .filter((notice) => notice?.text)
    .sort((left, right) => new Date(right.createdAt || 0) - new Date(left.createdAt || 0))[0];

  for (const duplicate of conversations.slice(1)) {
    await messageModel.updateMany(
      { conversationId: duplicate._id },
      { $set: { conversationId: canonical._id } }
    );
    duplicate.mergedInto = canonical._id;
    await duplicate.save();
  }

  canonical.adModel = "Ad";
  canonical.lastMessage = latest.lastMessage || "";
  canonical.isClosed = Boolean(latest.isClosed);
  canonical.closedAt = latest.closedAt || null;
  canonical.updatedAt = latest.updatedAt || canonical.updatedAt;
  canonical.mutedFor = uniqueIds(conversations.flatMap((conversation) => conversation.mutedFor || []));
  canonical.pinnedBy = uniqueIds(conversations.flatMap((conversation) => conversation.pinnedBy || []));
  canonical.deletedBy = uniqueIds(latest.deletedBy || []);
  if (latestFavoriteNotice) canonical.favoriteNotice = latestFavoriteNotice;
  await canonical.save();

  return canonical;
}

export async function findOrCreateAdConversation({
  adId,
  participants,
  conversationModel = Conversation,
  messageModel = ConversationMessage
}) {
  const existing = await consolidateAdConversations({
    adId,
    participants,
    conversationModel,
    messageModel
  });
  if (existing) return { conversation: existing, created: false };

  const participantIds = uniqueIds(participants);
  if (!adId || participantIds.length !== 2) {
    throw new Error("An ad conversation requires an ad and exactly two participants.");
  }

  const conversation = await conversationModel.create({
    adId,
    adModel: "Ad",
    participants: participantIds,
    lastMessage: ""
  });
  return { conversation, created: true };
}

export function buildAdConversationFilter(adId, participants) {
  return conversationFilter(adId, uniqueIds(participants));
}
