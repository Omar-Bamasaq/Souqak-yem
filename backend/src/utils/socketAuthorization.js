export function getSocketAccessToken(cookieHeader = "") {
  const cookies = new Map();
  for (const entry of String(cookieHeader).split(";")) {
    const separator = entry.indexOf("=");
    if (separator < 0) continue;
    const name = entry.slice(0, separator).trim();
    if (name !== "accessToken" && name !== "token") continue;
    try {
      cookies.set(name, decodeURIComponent(entry.slice(separator + 1).trim()));
    } catch {
      return null;
    }
  }
  return cookies.get("accessToken") || cookies.get("token") || null;
}

export function getAuthenticatedSocketUserId(accessToken, requestedUserId, verifyAccessToken) {
  if (!accessToken) return null;
  const payload = verifyAccessToken(accessToken);
  const authenticatedUserId = String(payload.userId || payload.id || "");
  if (!authenticatedUserId || (requestedUserId && String(requestedUserId) !== authenticatedUserId)) {
    return null;
  }
  return authenticatedUserId;
}

export async function isConversationParticipant(Conversation, userId, conversationId) {
  if (!userId || !/^[a-f\d]{24}$/i.test(String(conversationId || ""))) return false;
  return Boolean(await Conversation.exists({
    _id: conversationId,
    participants: userId
  }));
}

export async function isChatParticipant(Chat, userId, chatId) {
  if (!userId || !/^[a-f\d]{24}$/i.test(String(chatId || ""))) return false;
  return Boolean(await Chat.exists({
    _id: chatId,
    $or: [{ buyer: userId }, { seller: userId }]
  }));
}
