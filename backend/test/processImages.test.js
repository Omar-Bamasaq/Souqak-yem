import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import processImages, { validateProcessedImages } from "../src/middleware/processImages.js";

test("keeps processed image variants when deleting previous variants fails", async () => {
  const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), "souqak-process-images-"));
  const originalUnlink = fs.promises.unlink;
  const sourcePath = path.join(directory, "old-full.webp");

  try {
    await sharp({
      create: {
        width: 64,
        height: 48,
        channels: 3,
        background: { r: 35, g: 110, b: 190 }
      }
    }).webp().toFile(sourcePath);
    await Promise.all([
      fs.promises.writeFile(path.join(directory, "old-med.webp"), ""),
      fs.promises.writeFile(path.join(directory, "old-thumb.webp"), "")
    ]);

    fs.promises.unlink = async (filePath) => {
      if (path.basename(filePath).startsWith("old-")) {
        throw Object.assign(new Error("The file is in use."), { code: "EBUSY" });
      }
      return originalUnlink.call(fs.promises, filePath);
    };

    const req = {
      files: [{
        filename: "old-full.webp",
        path: sourcePath,
        destination: directory,
        mimetype: "image/webp",
        imageVariants: {
          full: "old-full.webp",
          med: "old-med.webp",
          thumb: "old-thumb.webp"
        }
      }]
    };
    await new Promise((resolve, reject) => {
      processImages()(req, {}, (error) => error ? reject(error) : resolve());
    });

    let validationPassed = false;
    let validationResponse;
    validateProcessedImages(req, {
      status(statusCode) {
        validationResponse = { statusCode };
        return this;
      },
      json(body) {
        validationResponse.body = body;
      }
    }, () => {
      validationPassed = true;
    });

    assert.equal(validationPassed, true);
    assert.equal(validationResponse, undefined);
    for (const filename of Object.values(req.files[0].imageVariants)) {
      assert.equal(fs.existsSync(path.join(directory, filename)), true);
    }
  } finally {
    fs.promises.unlink = originalUnlink;
    sharp.cache(false);
    await fs.promises.rm(directory, { recursive: true, force: true });
  }
});
