import test from "node:test";
import assert from "node:assert/strict";
import { shouldCompressAdImage } from "../src/lib/imageCompression.js";

test("small Android photos are compressed when dimensions exceed the backend input cap", async () => {
  const originalCreateImageBitmap = globalThis.createImageBitmap;
  let bitmapClosed = false;
  globalThis.createImageBitmap = async () => ({
    width: 12001,
    height: 2000,
    close() {
      bitmapClosed = true;
    }
  });

  try {
    assert.equal(await shouldCompressAdImage({ size: 400 * 1024 }), true);
    assert.equal(bitmapClosed, true);
  } finally {
    if (originalCreateImageBitmap) globalThis.createImageBitmap = originalCreateImageBitmap;
    else delete globalThis.createImageBitmap;
  }
});
