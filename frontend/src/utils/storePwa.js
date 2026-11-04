export function buildStorePwaIconUrl(slug, size, apiBase) {
  const base = String(apiBase || "/api").replace(/\/+$/, "");
  const normalizedBase = base.endsWith("/api") ? base : `${base}/api`;
  return `${normalizedBase}/stores/${encodeURIComponent(slug)}/pwa-icon/${size}.png`;
}

export function buildStoreManifest({ storeName, slug, iconUrls, shortName, origin }) {
  const displayName = String(storeName || "متجر").trim() || "متجر";
  const appShortName = String(shortName || Array.from(displayName).slice(0, 12).join("")).trim() || displayName;
  const encodedSlug = encodeURIComponent(String(slug || ""));
  const storePath = `/store/${encodedSlug}/`;
  const scopedStartUrl = origin ? new URL(storePath, origin).href : storePath;
  return {
    name: displayName,
    short_name: appShortName,
    description: `${displayName} - المتجر الإلكتروني`,
    id: scopedStartUrl,
    start_url: scopedStartUrl,
    scope: scopedStartUrl,
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0b89ed",
    dir: "rtl",
    lang: "ar",
    orientation: "portrait",
    categories: ["shopping", "business"],
    icons: [192, 512].map((size) => ({
      src: iconUrls[size],
      sizes: `${size}x${size}`,
      type: "image/png",
      purpose: "any"
    }))
  };
}

export function applyStoreManifest(store, apiBase) {
  if (!store || typeof document === "undefined") return;
  if (store.pwaEnabled !== true || !store.slug) return restoreGlobalManifest();

  const manifest = buildStoreManifest({
    storeName: store.storeName,
    slug: store.slug,
    shortName: Array.from(String(store.storeName || "").trim()).slice(0, 12).join(""),
    origin: window.location.origin,
    iconUrls: {
      192: buildStorePwaIconUrl(store.slug, 192, apiBase),
      512: buildStorePwaIconUrl(store.slug, 512, apiBase)
    }
  });

  const manifestUrl = `data:application/manifest+json;charset=utf-8,${encodeURIComponent(JSON.stringify(manifest))}`;

  let link = document.querySelector('link[rel="manifest"]');
  if (!link) {
    link = document.createElement("link");
    link.rel = "manifest";
    document.head.appendChild(link);
  }
  link.href = manifestUrl;

  let themeMeta = document.querySelector('meta[name="theme-color"]');
  if (!themeMeta) {
    themeMeta = document.createElement("meta");
    themeMeta.name = "theme-color";
    document.head.appendChild(themeMeta);
  }
  themeMeta.setAttribute("content", manifest.theme_color);

  let appleMeta = document.querySelector('meta[name="apple-mobile-web-app-title"]');
  if (!appleMeta) {
    appleMeta = document.createElement("meta");
    appleMeta.setAttribute("name", "apple-mobile-web-app-title");
    document.head.appendChild(appleMeta);
  }
  appleMeta.setAttribute("content", manifest.short_name);
}

export function restoreGlobalManifest() {
  if (typeof document === "undefined") return;
  const manifestLink = document.querySelector('link[rel="manifest"]');
  if (manifestLink) manifestLink.href = "/manifest.json";

  const themeMeta = document.querySelector('meta[name="theme-color"]');
  if (themeMeta) themeMeta.setAttribute("content", "#0b89ed");

  const appleMeta = document.querySelector('meta[name="apple-mobile-web-app-title"]');
  if (appleMeta) appleMeta.setAttribute("content", "سوقك");
}
