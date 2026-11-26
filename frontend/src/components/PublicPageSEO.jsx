import React from "react";
import SEO from "./SEO.jsx";
import { PUBLIC_PAGE_METADATA } from "../lib/publicPageMetadata.mjs";
import {
  createPublicSiteStructuredData,
  createWebPageStructuredData
} from "../lib/structuredData.js";

export default function PublicPageSEO({ path, indexable = true, includeSearchAction = false }) {
  const metadata = PUBLIC_PAGE_METADATA[path];
  if (!metadata) {
    throw new Error(`Missing public page metadata for ${path}.`);
  }
  return (
    <SEO
      title={metadata.title}
      description={metadata.description}
      canonicalUrl={path}
      image="/logo-full.svg"
      indexable={indexable}
      includeSearchAction={includeSearchAction}
      jsonLd={path === "/"
        ? createPublicSiteStructuredData({ siteBaseUrl: "https://souqak-yem.com" })
        : createWebPageStructuredData({
          name: metadata.heading,
          description: metadata.description,
          url: path,
          image: "/logo-full.svg",
          siteBaseUrl: "https://souqak-yem.com"
        })}
    />
  );
}
