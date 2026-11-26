import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PublicAdContent } from "../src/ssg/PublicSsgContent.mjs";
import {
  DEFAULT_SITE_BASE_URL,
  getPublicAdImageUrl,
  renderPublicAdContentHtml
} from "../../shared/seoRules.mjs";

test("dynamic ad HTML is identical to the React SSG component used for hydration", () => {
  const ad = {
    _id: "0123456789abcdef01234567",
    slug: "سيارة-مستعملة",
    title: `سيارة <img src=x onerror="alert(1)">`,
    description: "وصف آمن للإعلان مع تفاصيل مفيدة",
    images: ["ads/public-car.webp"],
    price: 2500,
    currency: "YER_ADEN",
    categoryId: {
      name: "سيارات",
      slug: "cars",
      parentId: { name: "مركبات", slug: "vehicles" }
    },
    parentCategory: { name: "مركبات", slug: "vehicles" },
    subcategory: { name: "سيارات", slug: "cars" },
    governorateId: { name: "صنعاء" },
    cityId: { name: "حدة" }
  };
  const breadcrumbs = [
    { name: "الرئيسية", url: "/" },
    { name: "سيارات", url: "/category/vehicles/cars" },
    { name: ad.title, url: `/ad/${ad._id}/%D8%B3%D9%8A%D8%A7%D8%B1%D8%A9-%D9%85%D8%B3%D8%AA%D8%B9%D9%85%D9%84%D8%A9` }
  ];
  const props = {
    ad,
    breadcrumbs,
    siteBaseUrl: DEFAULT_SITE_BASE_URL,
    apiOrigin: "https://api.souqak-yem.com"
  };
  const reactHtml = renderToStaticMarkup(React.createElement(PublicAdContent, props));
  const dynamicHtml = renderPublicAdContentHtml(ad, props);

  assert.equal(dynamicHtml, reactHtml);
  assert.match(dynamicHtml, /&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt;/);
  assert.doesNotMatch(dynamicHtml, /<img src=x/);
});

test("public ad image URLs reject unsafe schemes and private or traversal paths", () => {
  for (const image of [
    "javascript:alert(1)",
    "//attacker.example/image.png",
    "../private_uploads/identity.jpg",
    "uploads/receipts/payment.png",
    "%2e%2e/private_uploads/file.png"
  ]) {
    assert.equal(getPublicAdImageUrl(image, { apiOrigin: "https://api.souqak-yem.com" }), null);
  }
  assert.equal(
    getPublicAdImageUrl("ads/car 1.webp", { apiOrigin: "https://api.souqak-yem.com" }),
    "https://api.souqak-yem.com/uploads/ads/car%201.webp"
  );
});
