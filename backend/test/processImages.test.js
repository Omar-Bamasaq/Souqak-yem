import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import processImages, { validateProcessedImages } from "../src/middleware/processImages.js";
import { processPublicImageVariants } from "../src/services/publicImagePipeline.js";

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

test("reprocesses upload-stage WebP variants with EXIF rotation within shared dimension limits", async () => {
  const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), "souqak-image-variants-"));
  const sourcePath = path.join(directory, "oriented-source.jpg");

  try {
    await sharp({
      create: {
        width: 11_999,
        height: 1_200,
        channels: 3,
        background: { r: 35, g: 110, b: 190 }
      }
    }).jpeg().withMetadata({ orientation: 6 }).toFile(sourcePath);

    const uploadVariants = await processPublicImageVariants({
      sourcePath,
      destination: directory,
      baseName: "upload-stage"
    });
    const uploadFullMetadata = await sharp(uploadVariants.paths.full).metadata();
    assert.ok(uploadFullMetadata.width <= 1_200);
    assert.ok(uploadFullMetadata.height <= 1_200);
    sharp.cache(false);

    const req = {
      files: [{
        filename: uploadVariants.names.full,
        path: uploadVariants.paths.full,
        destination: directory,
        mimetype: "image/webp",
        imageVariants: uploadVariants.names
      }]
    };
    await new Promise((resolve, reject) => {
      processImages()(req, {}, (error) => error ? reject(error) : resolve());
    });

    assert.deepEqual(req.imageProcessingErrors, []);
    const processedMetadata = await sharp(req.files[0].path).metadata();
    assert.ok(processedMetadata.width <= 1_200);
    assert.ok(processedMetadata.height <= 1_200);

    let validationPassed = false;
    validateProcessedImages(req, {}, () => {
      validationPassed = true;
    });
    assert.equal(validationPassed, true);
  } finally {
    sharp.cache(false);
    await fs.promises.rm(directory, { recursive: true, force: true });
  }
});
