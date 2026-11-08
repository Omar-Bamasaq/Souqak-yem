import React, { useEffect, useState } from "react";
import { privateMessageAttachmentPath } from "../lib/privateMessageAttachments.js";

export default function PrivateMessageImage({
  api,
  kind,
  conversationId,
  messageId,
  imageReference,
  alt = "",
  className = "",
  onOpen
}) {
  const [imageUrl, setImageUrl] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    let objectUrl = "";
    setImageUrl("");

    api.get(
      privateMessageAttachmentPath(kind, conversationId, messageId, imageReference),
      { responseType: "blob", signal: controller.signal }
    ).then(({ data }) => {
      objectUrl = URL.createObjectURL(data);
      setImageUrl(objectUrl);
    }).catch(() => {
      if (!controller.signal.aborted) setImageUrl("");
    });

    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [api, conversationId, imageReference, kind, messageId]);

  if (!imageUrl) {
    return <span className={`block bg-gray-200/60 ${className}`} aria-label="تعذر تحميل المرفق" />;
  }

  return (
    <img
      src={imageUrl}
      alt={alt}
      className={className}
      role={onOpen ? "button" : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onClick={onOpen ? () => onOpen(imageUrl) : undefined}
      onKeyDown={onOpen ? (event) => {
        if (event.key === "Enter" || event.key === " ") onOpen(imageUrl);
      } : undefined}
    />
  );
}
