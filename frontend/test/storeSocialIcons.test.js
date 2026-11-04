import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const storefrontPath = path.join(process.cwd(), "frontend", "src", "pages", "Storefront.jsx");
const storefrontSource = fs.readFileSync(storefrontPath, "utf8");

test("store social links show accessible brand icons and preserve secure external links", () => {
  for (const platform of ["facebook", "instagram", "tiktok", "youtube", "whatsappchannel"]) {
    assert.match(storefrontSource, new RegExp(`case "${platform}"`));
  }

  assert.match(storefrontSource, /aria-label=\{getSocialLabel\(platform\)\}/);
  assert.match(storefrontSource, /title=\{getSocialLabel\(platform\)\}/);
  assert.match(storefrontSource, /href=\{url\} target="_blank" rel="noopener noreferrer"/);
  assert.match(storefrontSource, /<StoreSocialIcon platform=\{platform\} \/>/);
  assert.match(storefrontSource, /className="mt-2 flex flex-nowrap items-center justify-center gap-2 sm:mr-auto sm:mt-0"/);
  assert.match(storefrontSource, /canInstall && store\.pwaEnabled && <div className="mt-2 flex justify-center sm:basis-full">/);
  assert.match(storefrontSource, /قناة أو مجموعة واتساب/);
  assert.match(storefrontSource, /instagram: "إنستغرام"/);
  assert.match(storefrontSource, /youtube: "يوتيوب"/);
});
