import fs from "fs";
import os from "os";
import path from "path";

export async function createRequestUploadStagingDirectory(root = os.tmpdir(), prefix = "souqak-upload-") {
  const resolvedRoot = path.resolve(root);
  await fs.promises.mkdir(resolvedRoot, { recursive: true });
  return fs.promises.mkdtemp(path.join(resolvedRoot, prefix));
}

export async function cleanupRequestUploadStagingDirectory(directory, root = os.tmpdir(), prefix = "souqak-upload-") {
  if (!directory) return;
  const resolvedRoot = path.resolve(root);
  const resolvedDirectory = path.resolve(directory);
  const relative = path.relative(resolvedRoot, resolvedDirectory);
  if (
    !relative ||
    relative.startsWith(`..${path.sep}`) ||
    relative === ".." ||
    path.isAbsolute(relative) ||
    !path.basename(resolvedDirectory).startsWith(prefix)
  ) {
    throw new Error("Refusing to clean a directory outside this request's upload staging scope.");
  }
  await fs.promises.rm(resolvedDirectory, { recursive: true, force: true });
}

export function registerRequestUploadStagingCleanup(req, res, directory, root, prefix) {
  let cleanupStarted = false;
  let cleanupRequested = false;
  const cleanup = () => {
    cleanupRequested = true;
    if (cleanupStarted || req.uploadStagingActive === true) return;
    cleanupStarted = true;
    void cleanupRequestUploadStagingDirectory(directory, root, prefix).catch((error) => {
      console.error("Request upload staging cleanup failed.", {
        message: error.message
      });
    });
  };
  req.cleanupRequestUploadStaging = cleanup;
  res.once("finish", cleanup);
  res.once("close", () => {
    if (!res.writableFinished) cleanup();
  });
  req.finishUploadStagingOperation = () => {
    req.uploadStagingActive = false;
    if (cleanupRequested) cleanup();
  };
  req.requestUploadStagingDirectory = directory;
}
