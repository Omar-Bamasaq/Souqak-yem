import { DEFAULT_PRERENDER_SNAPSHOT_PATH, loadPrerenderSnapshot } from "./validatePrerenderSnapshot.mjs";
import { resolveSiteBaseUrl } from "../src/lib/siteUrl.js";

function configuredMaxAge(env) {
  if (env.SEO_PRERENDER_MAX_AGE_MS == null || env.SEO_PRERENDER_MAX_AGE_MS === "") return null;
  const maxAgeMs = Number(env.SEO_PRERENDER_MAX_AGE_MS);
  if (!Number.isFinite(maxAgeMs) || maxAgeMs < 0) {
    throw new Error("SEO_PRERENDER_MAX_AGE_MS must be a non-negative number.");
  }
  return maxAgeMs;
}

export async function getPrerenderData({
  env = process.env,
  loadApiData,
  readSnapshot = loadPrerenderSnapshot
} = {}) {
  const source = env.SEO_PRERENDER_DATA_SOURCE || "api";
  if (source === "api") {
    if (typeof loadApiData !== "function") {
      throw new Error("API prerender data was selected, but no API data loader is configured.");
    }
    return loadApiData();
  }
  if (source !== "local") {
    throw new Error(`Unsupported SEO_PRERENDER_DATA_SOURCE "${source}". Use "api" or "local".`);
  }

  const snapshotPath = env.SEO_PRERENDER_SNAPSHOT_PATH || DEFAULT_PRERENDER_SNAPSHOT_PATH;
  const siteBaseUrl = resolveSiteBaseUrl(env.PUBLIC_SITE_URL || env.VITE_PUBLIC_SITE_URL);
  const snapshot = await readSnapshot(snapshotPath, {
    maxAgeMs: configuredMaxAge(env),
    expectedSiteBaseUrl: siteBaseUrl
  });
  const categorySsgDataBySlug = new Map(
    Object.entries(snapshot.categorySsgDataBySlug)
  );

  return {
    source: "local",
    metadata: snapshot.metadata,
    categories: snapshot.categories,
    ads: snapshot.ads,
    categorySsgDataBySlug,
    homeData: {
      categories: snapshot.categories,
      ads: snapshot.ads.slice(0, 20),
      total: snapshot.ads.length,
      pages: 1
    }
  };
}

export async function generateFromPrerenderData({ dataOptions, generate } = {}) {
  if (typeof generate !== "function") {
    throw new TypeError("A prerender page generator is required.");
  }
  const data = await getPrerenderData(dataOptions);
  return generate(data);
}
