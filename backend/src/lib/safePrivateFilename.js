import path from "path";

export function isSafePrivateFilename(filename) {
  return typeof filename === "string"
    && filename.length > 0
    && filename !== "."
    && filename !== ".."
    && !filename.includes("\\")
    && path.basename(filename) === filename;
}
