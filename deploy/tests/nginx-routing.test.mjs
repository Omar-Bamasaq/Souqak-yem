import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const template = fs.readFileSync(
  path.join(repositoryRoot, "deploy", "nginx", "souqak-seo.conf.template"),
  "utf8"
);

function getNginxRegexLocations() {
  return [...template.matchAll(/^\s*location\s+(~\*?)\s+(.+?)\s*\{/gm)]
    .map(([, modifier, pattern]) => ({
      caseInsensitive: modifier === "~*",
      regex: new RegExp(pattern, modifier === "~*" ? "i" : "")
    }));
}

function matchesNginxRegexLocation(pathname) {
  return getNginxRegexLocations().some(({ regex }) => regex.test(pathname));
}

test("SEO Nginx locations route auction IDs but leave auction creation to React", () => {
  assert.equal(matchesNginxRegexLocation("/auctions/507f1f77bcf86cd799439011"), true);
  assert.equal(matchesNginxRegexLocation("/auctions/new"), false);
  assert.equal(matchesNginxRegexLocation("/auctions/new/"), false);
  assert.equal(matchesNginxRegexLocation("/auctions/NEW"), false);
});

test("SEO Nginx locations route the sitemap index and all generated shard types", () => {
  assert.match(template, /^\s*location\s+=\s+\/sitemap\.xml\s+\{/m);
  const shardLocation = getNginxRegexLocations().find(({ regex }) =>
    regex.test("/sitemap-pages-1.xml")
  );
  assert.ok(shardLocation);
  for (const dataset of ["pages", "categories", "ads", "stores", "auctions"]) {
    assert.equal(shardLocation.regex.test(`/sitemap-${dataset}-1.xml`), true);
    assert.equal(shardLocation.regex.test(`/sitemap-${dataset}-12.xml`), true);
  }
  assert.equal(shardLocation.regex.test("/sitemap-unknown-1.xml"), false);
});

test("SEO routing snippet leaves static files, API and PWA/app hosts to existing Nginx rules", () => {
  assert.doesNotMatch(template, /^\s*location\s+\/\s*\{/m);
  assert.doesNotMatch(template, /^\s*(?:server_name|listen|root)\b/m);
  assert.doesNotMatch(template, /apps\.souqak-yem\.com/i);
  for (const pathname of [
    "/sw.js",
    "/index.html",
    "/assets/index-abc123.js",
    "/api/health/readiness",
    "/uploads/image.jpg",
    "/socket.io/",
    "/store/507f1f77bcf86cd799439011/manifest.webmanifest",
    "/store/507f1f77bcf86cd799439011/icon/192.png"
  ]) {
    assert.equal(matchesNginxRegexLocation(pathname), false, pathname);
  }
});
