import { Router } from "express";
import mongoose from "mongoose";
import StoreProfile from "../models/StoreProfile.js";
import StoreSubscription from "../models/StoreSubscription.js";
import { hasStoreFeature } from "../utils/storeFeatureUtils.js";
import { createStorePwaIcon } from "../utils/storePwaIcon.js";

const DEFAULT_STORE_PWA_ORIGIN = "https://apps.souqak-yem.com";
function normalizeOrigin(value, name) {
  const parsed = new URL(value);
  if (parsed.origin !== value.replace(/\/+$/, "") || parsed.username || parsed.password) {
    throw new Error(`${name} must be an origin without credentials or a path.`);
  }
  if (process.env.NODE_ENV === "production" && parsed.protocol !== "https:") {
    throw new Error(`${name} must use HTTPS in production.`);
  }
  return parsed.origin;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function serializeBootstrap(value) {
  return JSON.stringify(value).replace(/[<>&\u2028\u2029]/g, (character) => ({
    "<": "\\u003c",
    ">": "\\u003e",
    "&": "\\u0026",
    "\u2028": "\\u2028",
    "\u2029": "\\u2029"
  })[character]);
}

function getShortName(storeName) {
  return Array.from(String(storeName || "متجر").trim()).slice(0, 12).join("") || "متجر";
}

function getThemeColor(store) {
  const color = store.primaryColor || "#0b89ed";
  return /^#(?:[\da-f]{3}|[\da-f]{6})$/i.test(color) ? color : "#0b89ed";
}

function getStorePaths(storeId) {
  const basePath = `/store/${storeId}/`;
  return {
    basePath,
    manifestPath: `${basePath}manifest.webmanifest`,
    iconPath: (size) => `${basePath}icon/${size}.png`
  };
}

export function buildStorePwaManifest(store, { origin, shortName = getShortName(store.storeName) }) {
  const storeId = String(store._id);
  const paths = getStorePaths(storeId);
  const appOrigin = normalizeOrigin(origin, "STORE_PWA_ORIGIN");
  return {
    id: new URL(paths.basePath, appOrigin).href,
    start_url: new URL(paths.basePath, appOrigin).href,
    scope: new URL(paths.basePath, appOrigin).href,
    name: String(store.storeName || "متجر").trim() || "متجر",
    short_name: shortName,
    description: `${String(store.storeName || "متجر").trim() || "متجر"} - التطبيق الإلكتروني`,
    display: "standalone",
    background_color: "#ffffff",
    theme_color: getThemeColor(store),
    dir: "rtl",
    lang: "ar",
    orientation: "portrait",
    categories: ["shopping", "business"],
    icons: [192, 512].map((size) => ({
      src: new URL(paths.iconPath(size), appOrigin).href,
      sizes: `${size}x${size}`,
      type: "image/png",
      purpose: "any"
    }))
  };
}

export function renderStorePwaAppHtml(store, {
  origin,
  assetOrigin = origin
}) {
  const appOrigin = normalizeOrigin(origin, "STORE_PWA_ORIGIN");
  const assetsOrigin = normalizeOrigin(assetOrigin, "STORE_PWA_ASSET_ORIGIN");
  const storeId = String(store._id);
  const storeName = String(store.storeName || "متجر").trim() || "متجر";
  const shortName = getShortName(storeName);
  const themeColor = getThemeColor(store);
  const paths = getStorePaths(storeId);
  const bootstrap = {
    storeId,
    slug: store.slug,
    storeType: store.storeType || "store",
    basePath: paths.basePath.slice(0, -1)
  };
  const bootstrapJson = serializeBootstrap(bootstrap);
  const iconUrl = new URL(paths.iconPath(192), appOrigin).href;
  const manifestUrl = new URL(paths.manifestPath, appOrigin).href;
  const stylesheetUrl = new URL("/assets/store-pwa.css", assetsOrigin).href;
  const entryUrl = new URL("/assets/store-pwa-entry.js", assetsOrigin).href;

  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="theme-color" content="${escapeHtml(themeColor)}">
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-title" content="${escapeHtml(shortName)}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=Noto+Sans+Arabic:wght@400;500;600;700&family=Cairo:wght@400;500;600;700&family=Tajawal:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="manifest" href="${escapeHtml(manifestUrl)}">
  <link rel="apple-touch-icon" href="${escapeHtml(iconUrl)}">
  <link rel="stylesheet" href="${escapeHtml(stylesheetUrl)}">
  <title>${escapeHtml(storeName)}</title>
</head>
<body>
  <div id="root"></div>
  <script>window.__SOUQAK_STORE_PWA_APP__=${bootstrapJson};</script>
  <script>
    if ("serviceWorker" in navigator) {
      const storeScope = ${JSON.stringify(paths.basePath)};
      window.__SOUQAK_STORE_PWA_REGISTRATION__ = navigator.serviceWorker
        .getRegistration(window.location.href)
        .then((existing) => {
          const existingScope = existing ? new URL(existing.scope).pathname : "/";
          const scope = existingScope === "/" || existingScope.startsWith(storeScope)
            ? existingScope
            : "/";
          return navigator.serviceWorker.register("/sw.js", {
            scope,
            updateViaCache: "none"
          });
        });
      window.__SOUQAK_STORE_PWA_REGISTRATION__.catch((error) => {
        console.warn("[PWA] Store worker registration failed.", {
          name: error?.name || "RegistrationFailed"
        });
      });
    }
  </script>
  <script type="module" src="${escapeHtml(entryUrl)}"></script>
</body>
</html>`;
}

export async function findEligibleStorePwa(storeId, {
  StoreProfileModel = StoreProfile,
  StoreSubscriptionModel = StoreSubscription,
  hasFeature = hasStoreFeature
} = {}) {
  if (!mongoose.isValidObjectId(storeId)) return null;
  const store = await StoreProfileModel.findOne({ _id: storeId, status: "active" })
    .select("_id storeName slug storeType status logo primaryColor")
    .lean();
  if (!store || !["store", "family-production"].includes(store.storeType || "store")) return null;

  const subscription = await StoreSubscriptionModel.findOne({ storeId: store._id })
    .sort({ createdAt: -1, _id: -1 })
    .populate("planId", "name type features")
    .lean();
  return hasFeature({ status: store.status, subscription }, "pwa") ? store : null;
}

export function createStorePwaAppRouter({
  StoreProfileModel = StoreProfile,
  StoreSubscriptionModel = StoreSubscription,
  hasFeature = hasStoreFeature,
  origin,
  assetOrigin,
  iconGenerator = createStorePwaIcon
} = {}) {
  const getOrigins = () => {
    const appOrigin = normalizeOrigin(
      origin || process.env.STORE_PWA_ORIGIN || DEFAULT_STORE_PWA_ORIGIN,
      "STORE_PWA_ORIGIN"
    );
    const assetsOrigin = normalizeOrigin(
      assetOrigin || process.env.STORE_PWA_ASSET_ORIGIN || appOrigin,
      "STORE_PWA_ASSET_ORIGIN"
    );
    return { appOrigin, assetsOrigin };
  };
  const router = Router();

  const findEligibleStore = (storeId) => findEligibleStorePwa(storeId, {
    StoreProfileModel,
    StoreSubscriptionModel,
    hasFeature
  });

  router.get("/:storeId/manifest.webmanifest", async (req, res) => {
    try {
      const store = await findEligibleStore(req.params.storeId);
      if (!store) return res.status(404).json({ error: "Store PWA not found" });
      const { appOrigin } = getOrigins();
      res.set("Cache-Control", "no-cache");
      return res.type("application/manifest+json").send(JSON.stringify(buildStorePwaManifest(store, {
        origin: appOrigin
      })));
    } catch (error) {
      console.error("Store PWA manifest error:", error);
      return res.status(500).json({ error: "Unable to load store PWA manifest" });
    }
  });

  router.get("/:storeId/icon/:size.png", async (req, res) => {
    try {
      const size = Number(req.params.size);
      if (![192, 512].includes(size)) return res.status(404).json({ error: "Store icon not found" });
      const store = await findEligibleStore(req.params.storeId);
      if (!store) return res.status(404).json({ error: "Store icon not found" });
      const icon = await iconGenerator(store, size);
      res.set("Content-Type", "image/png");
      res.set("Cache-Control", "public, max-age=300");
      return res.send(icon);
    } catch (error) {
      console.error("Store PWA icon error:", error);
      return res.status(500).json({ error: "Unable to generate store icon" });
    }
  });

  const renderPage = async (req, res) => {
    try {
      const store = await findEligibleStore(req.params.storeId);
      if (!store) return res.status(404).type("text/plain").send("Store PWA not found");
      const { appOrigin, assetsOrigin } = getOrigins();
      res.set("Cache-Control", "no-store");
      return res.type("html").send(renderStorePwaAppHtml(store, {
        origin: appOrigin,
        assetOrigin: assetsOrigin
      }));
    } catch (error) {
      console.error("Store PWA page error:", error);
      return res.status(500).type("text/plain").send("Unable to load store PWA");
    }
  };

  router.get("/:storeId", renderPage);
  router.get("/:storeId/*", renderPage);
  return router;
}

const storePwaAppRouter = createStorePwaAppRouter();
export default storePwaAppRouter;
