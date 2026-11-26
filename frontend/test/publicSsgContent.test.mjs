import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { INDEXABLE_STATIC_ROUTES } from "../scripts/prerenderRoutes.mjs";
import { PUBLIC_PAGE_METADATA } from "../src/lib/publicPageMetadata.mjs";
import { PublicSsgContent } from "../src/ssg/PublicSsgContent.mjs";
import fs from "node:fs";
import path from "node:path";

function renderStaticPage(path) {
  const kind = path === "/"
    ? "home"
    : path === "/categories"
      ? "categories"
      : path === "/refund-escrow"
        ? "refund-escrow"
        : "static-page";
  const data = path === "/terms" || path === "/privacy"
    ? { path, lastUpdated: "١/١/٢٠٢٦" }
    : path === "/categories"
      ? { categories: [], subcategories: [] }
      : { path };
  return renderToStaticMarkup(React.createElement(PublicSsgContent, {
    kind,
    data,
    siteBaseUrl: "https://souqak-yem.com"
  }));
}

test("all indexable static routes render useful initial public content", () => {
  for (const { path } of INDEXABLE_STATIC_ROUTES) {
    const markup = renderStaticPage(path);
    const heading = markup.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || "";
    const text = markup.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    assert.ok(heading.trim(), `${path} should render an H1`);
    assert.ok(text.length >= 80, `${path} should render useful initial text`);
    assert.match(markup, /ssg-public-content/, `${path} should use the visible SSG content wrapper`);
    assert.ok(PUBLIC_PAGE_METADATA[path], `${path} should have shared public metadata`);
  }
});

test("homepage does not embed changing ad snapshot records in its initial content", () => {
  const markup = renderToStaticMarkup(React.createElement(PublicSsgContent, {
    kind: "home",
    data: {
      categories: [],
      ads: [{ _id: "synthetic-id", title: "Snapshot-only listing title" }]
    },
    siteBaseUrl: "https://souqak-yem.com"
  }));
  assert.doesNotMatch(markup, /Snapshot-only listing title|synthetic-id/);
  assert.match(markup, /التصنيفات العامة/);
});

test("category directory links only to paths supplied by the eligible route plan", () => {
  const markup = renderToStaticMarkup(React.createElement(PublicSsgContent, {
    kind: "categories",
    data: {
      categories: [{ name: "سيارات", path: "/category/%D8%B3%D9%8A%D8%A7%D8%B1%D8%A7%D8%AA" }],
      subcategories: [{
        name: "سيدان",
        parentName: "سيارات",
        path: "/category/cars/sedans"
      }]
    },
    siteBaseUrl: "https://souqak-yem.com"
  }));
  assert.match(markup, /https:\/\/souqak-yem\.com\/category\/%D8%B3%D9%8A%D8%A7%D8%B1%D8%A7%D8%AA/);
  assert.match(markup, /https:\/\/souqak-yem\.com\/category\/cars\/sedans/);
});

test("initial SSG content is not hidden when JavaScript is unavailable", () => {
  const css = fs.readFileSync(
    path.join(process.cwd(), "src", "index.css"),
    "utf8"
  );
  assert.doesNotMatch(css, /ssg-public-content[^}]*visibility\s*:\s*hidden/i);
});
