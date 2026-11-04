import test from "node:test";
import assert from "node:assert/strict";
import {
  fetchProtectedFileBlob,
  getProtectedFileUrl,
  normalizeProtectedFilePath
} from "../protectedFiles.js";

test("protected file paths accept only known private upload folders", () => {
  assert.equal(normalizeProtectedFilePath("uploads/receipts/payment 1.png"), "receipts/payment 1.png");
  assert.equal(normalizeProtectedFilePath("https://api.example.test/uploads/ids/front.jpg"), "ids/front.jpg");
  assert.equal(normalizeProtectedFilePath("ads/public.webp"), null);
  assert.equal(normalizeProtectedFilePath("receipts/../private.jpg"), null);
  assert.equal(normalizeProtectedFilePath("receipts/proof.jpg?token=secret"), null);
});

test("protected file URLs contain no query string or access token", () => {
  const api = { defaults: { baseURL: "https://api.example.test/api/" } };
  assert.equal(
    getProtectedFileUrl(api, "receipts/proof image.png"),
    "https://api.example.test/uploads/receipts/proof%20image.png"
  );
  assert.throws(() => getProtectedFileUrl(api, "ads/public.webp"), /valid protected file path/);
});

test("protected file requests use Blob responses and reject SVG error responses", async () => {
  const requested = [];
  const blob = new Blob(["image-data"], { type: "image/png" });
  const api = {
    defaults: { baseURL: "https://api.example.test/api/" },
    get: async (...args) => {
      requested.push(args);
      return { data: blob, headers: { "content-type": "image/png" } };
    }
  };
  assert.equal(await fetchProtectedFileBlob(api, "receipts/proof.png"), blob);
  assert.equal(requested[0][0], "https://api.example.test/uploads/receipts/proof.png");
  assert.equal(requested[0][1].responseType, "blob");

  api.get = async () => ({
    data: new Blob(["denied"], { type: "image/svg+xml" }),
    headers: { "content-type": "image/svg+xml" }
  });
  await assert.rejects(fetchProtectedFileBlob(api, "receipts/proof.png"), /SVG response/);
});
