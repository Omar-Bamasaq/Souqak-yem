import fs from "node:fs";
import path from "node:path";
import { privateMessageUploadsDirectory, uploadsDirectory } from "../config/uploadPaths.js";

const attachmentFilenamePattern = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const imageContentTypes = new Map([
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".png", "image/png"],
  [".webp", "image/webp"],
]);

export function isSafeMessageAttachmentFilename(filename) {
  return typeof filename === "string" && attachmentFilenamePattern.test(filename);
}

export function rejectClientSuppliedAttachmentRefs(req, res, next) {
  if (Object.hasOwn(req.body || {}, "images")) {
    return res.status(400).json({ error: "يجب رفع المرفقات كملفات، ولا تقبل أسماء الملفات المرسلة ضمن البيانات." });
  }
  return next();
}

export function getUploadedMessageAttachmentNames(files) {
  if (files === undefined || files === null) return [];
  if (!Array.isArray(files)) throw new TypeError("Uploaded message files must be an array.");
  return files.map((file) => {
    if (!isSafeMessageAttachmentFilename(file?.filename)) {
      throw new TypeError("Uploaded message file has an invalid server-generated filename.");
    }
    return file.filename;
  });
}

export function getMessageAttachmentLookupNames(filename) {
  if (!isSafeMessageAttachmentFilename(filename)) return [];
  const variant = filename.match(/^(.*)\.(?:thumb|med)\.webp$/i);
  if (!variant) return [filename];
  return [
    filename,
    `${variant[1]}.webp`,
    `${variant[1]}.jpg`,
    `${variant[1]}.jpeg`,
    `${variant[1]}.png`,
  ];
}

export function createPublicMessageAttachmentGuard(isPrivateMessageAttachment) {
  return async (req, res, next) => {
    const { filename } = req.params;
    if (!isSafeMessageAttachmentFilename(filename)) return next();

    try {
      if (await isPrivateMessageAttachment(filename)) {
        res.setHeader("Cache-Control", "private, no-store, max-age=0");
        return res.sendStatus(404);
      }
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

export function resolveMessageAttachmentPath(filename) {
  if (!isSafeMessageAttachmentFilename(filename)) return null;
  const candidates = [
    path.join(privateMessageUploadsDirectory, filename),
    path.join(uploadsDirectory, filename),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}

export function sendMessageAttachment(res, filePath) {
  const contentType = imageContentTypes.get(path.extname(filePath).toLowerCase());
  if (!contentType) return res.sendStatus(404);

  res.setHeader("Content-Type", contentType);
  res.setHeader("Content-Disposition", `inline; filename="${path.basename(filePath)}"`);
  res.setHeader("Cache-Control", "private, no-store, max-age=0");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Content-Security-Policy", "default-src 'none'; sandbox");
  return res.sendFile(filePath);
}
