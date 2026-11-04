import path from "node:path";
import { fileURLToPath } from "node:url";

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export const uploadsDirectory = path.join(backendRoot, "uploads");
export const privateMessageUploadsDirectory = path.join(
  backendRoot,
  "private_uploads",
  "message-attachments"
);
