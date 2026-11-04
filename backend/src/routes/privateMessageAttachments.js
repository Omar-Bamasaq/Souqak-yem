import { Router } from "express";
import fs from "node:fs/promises";
import path from "node:path";
import auth from "../middleware/auth.js";
import { hasAdminPermission } from "../config/adminPermissions.js";
import Conversation from "../models/Conversation.js";
import ConversationMessage from "../models/ConversationMessage.js";
import SupportConversation from "../models/SupportConversation.js";
import SupportMessage from "../models/SupportMessage.js";
import { privateMessageUploadsDirectory, uploadsDirectory } from "../config/uploadPaths.js";

const IMAGE_FILENAME = /^[a-zA-Z0-9_-]{1,100}\.(?:jpe?g|png|webp)$/i;

function legacyReferences(filename) {
  return [filename, `uploads/${filename}`, `/uploads/${filename}`];
}

function caseInsensitiveReferences(references) {
  return references.map((reference) => new RegExp(
    `^${reference.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
    "i"
  ));
}

function findLean(Model, filter) {
  const query = Model.findOne(filter);
  return query && typeof query.lean === "function" ? query.lean() : query;
}

async function resolveStoredFile(directory, filename) {
  const realDirectory = await fs.realpath(directory);
  const candidate = path.resolve(realDirectory, filename);
  if (path.dirname(candidate) !== realDirectory) return null;

  const realFile = await fs.realpath(candidate);
  if (path.dirname(realFile) !== realDirectory) return null;
  const stats = await fs.stat(realFile);
  return stats.isFile() ? realFile : null;
}

function imageReferenceFor(message, filename) {
  const refs = Array.isArray(message.images) ? message.images : [];
  const privateReference = `private/${filename}`;
  if (refs.includes(privateReference)) {
    return { isPrivate: true };
  }
  const legacyReference = legacyReferences(filename).find((reference) => refs.includes(reference));
  return legacyReference ? { isPrivate: false } : null;
}

export function createPrivateMessageAttachmentsRouter({
  authMiddleware = auth,
  models = {
    Conversation,
    ConversationMessage,
    SupportConversation,
    SupportMessage
  },
  directories = {
    private: privateMessageUploadsDirectory,
    public: uploadsDirectory
  }
} = {}) {
  const router = Router();

  router.use((req, _res, next) => {
    req.privateMessageAttachmentRequest = true;
    next();
  });

  router.get("/:kind/:conversationId/:messageId/:filename", authMiddleware, async (req, res) => {
    try {
      const { kind, conversationId, messageId, filename } = req.params;
      if (
        !["conversations", "support"].includes(kind) ||
        !/^[a-f\d]{24}$/i.test(conversationId) ||
        !/^[a-f\d]{24}$/i.test(messageId) ||
        !IMAGE_FILENAME.test(filename)
      ) {
        return res.sendStatus(404);
      }

      const isSupport = kind === "support";
      const messageModel = isSupport ? models.SupportMessage : models.ConversationMessage;
      const conversationModel = isSupport ? models.SupportConversation : models.Conversation;
      const references = [...legacyReferences(filename), `private/${filename}`];
      const message = await findLean(messageModel, {
        _id: messageId,
        conversationId,
        images: { $in: references }
      });
      if (!message || (!isSupport && (message.isDeleted || message.deletedBy?.some(
        (userId) => String(userId) === String(req.user.id)
      )))) {
        return res.sendStatus(404);
      }

      const conversation = await findLean(conversationModel, { _id: conversationId });
      if (!conversation) return res.sendStatus(404);

      const isAdmin = isSupport
        ? hasAdminPermission(req.user, "support_inbox")
        : req.user.role === "admin";
      const isOwner = isSupport
        ? String(conversation.userId) === String(req.user.id)
        : conversation.participants?.some((participant) => String(participant) === String(req.user.id));
      if (!isAdmin && !isOwner) return res.sendStatus(403);
      if (isSupport && conversation.isPermanentlyDeleted && !isAdmin) return res.sendStatus(404);

      const storedFile = imageReferenceFor(message, filename);
      if (!storedFile) return res.sendStatus(404);
      const filePath = await resolveStoredFile(
        storedFile.isPrivate ? directories.private : directories.public,
        filename
      );
      if (!filePath) return res.sendStatus(404);

      res.set({
        "Cache-Control": "private, no-store, max-age=0",
        "Content-Disposition": `inline; filename="${filename}"`,
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "SAMEORIGIN"
      });
      return res.sendFile(filePath, (error) => {
        if (error && !res.headersSent) {
          res.status(error.statusCode || 500).json({ error: "Unable to retrieve attachment." });
        }
      });
    } catch (error) {
      if (error.code === "ENOENT" || error.code === "ENOTDIR") return res.sendStatus(404);
      return res.status(500).json({ error: "Unable to retrieve attachment." });
    }
  });

  return router;
}

function legacyReferenceCandidates(requestPath) {
  let decodedPath;
  try {
    decodedPath = decodeURIComponent(requestPath);
  } catch {
    return [];
  }

  if (decodedPath.includes("\\") || path.posix.dirname(decodedPath) !== "/") return [];
  const requestedName = path.posix.basename(decodedPath);
  const variant = requestedName.match(/^(.*)\.(?:thumb|med)\.webp$/i);
  const base = (variant ? variant[1] : requestedName).replace(/\.(?:jpe?g|png|webp)$/i, "");
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(base)) return [];

  const filenames = new Set([requestedName]);
  for (const extension of [".jpg", ".jpeg", ".png", ".webp"]) {
    filenames.add(`${base}${extension}`);
    filenames.add(`${base}.thumb.webp`);
    filenames.add(`${base}.med.webp`);
  }

  return [...filenames].flatMap(legacyReferences);
}

export function createLegacyMessageAttachmentGuard({
  models = { ConversationMessage, SupportMessage }
} = {}) {
  return async (req, res, next) => {
    const references = legacyReferenceCandidates(req.path);
    if (!references.length) return next();
    req.privateMessageAttachmentRequest = true;

    try {
      const queryReferences = [...references, ...caseInsensitiveReferences(references)];
      const [conversationMessage, supportMessage] = await Promise.all([
        models.ConversationMessage.exists({ images: { $in: queryReferences } }),
        models.SupportMessage.exists({ images: { $in: queryReferences } })
      ]);
      if (conversationMessage || supportMessage) return res.sendStatus(404);
      return next();
    } catch {
      return res.status(500).json({ error: "Unable to check attachment access." });
    }
  };
}

export const privateMessageAttachmentsRouter = createPrivateMessageAttachmentsRouter();
export const legacyMessageAttachmentGuard = createLegacyMessageAttachmentGuard();

export default privateMessageAttachmentsRouter;
