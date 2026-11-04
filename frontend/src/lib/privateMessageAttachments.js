const ATTACHMENT_KINDS = new Set(["conversations", "support"]);

export function privateMessageAttachmentPath(kind, conversationId, messageId, imageReference) {
  if (!ATTACHMENT_KINDS.has(kind) || !conversationId || !messageId || !imageReference) {
    throw new Error("A valid private message attachment reference is required.");
  }

  const filename = String(imageReference).replace(/^private\//, "");
  return `/message-attachments/${kind}/${encodeURIComponent(conversationId)}/${encodeURIComponent(messageId)}/${encodeURIComponent(filename)}`;
}
