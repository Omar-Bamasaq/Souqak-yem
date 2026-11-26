import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_SITE_BASE_URL,
  encodeSeoPathSegment,
  hasMeaningfulQueryParameters,
  resolveSiteBaseUrl,
  serializeJsonLd
} from "../../../shared/seoRules.mjs";
import {
  BoundedLruCache,
  BoundedSeoWorkLimiter,
  SeoWorkLimitError,
  resolveSeoCacheOptions,
  seoWorkLimiter as sharedSeoWorkLimiter
} from "./seoCache.js";

const FRONTEND_TEMPLATE = fileURLToPath(new URL("../../frontend/index.html", import.meta.url));
const MAX_TEMPLATE_BYTES = 2 * 1024 * 1024;
const RETRY_AFTER_SECONDS = 30;

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

export function validateFrontendTemplate(template) {
  if (
    typeof template !== "string" ||
    Buffer.byteLength(template, "utf8") > MAX_TEMPLATE_BYTES ||
    !/<html(?:\s|>)/i.test(template) ||
    !/<head(?:\s|>)[\s\S]*<\/head>/i.test(template) ||
    !/<body(?:\s|>)[\s\S]*<\/body>/i.test(template) ||
    !/<div\b(?=[^>]*\bid=["']root["'])[^>]*>\s*<\/div>/i.test(template) ||
    !/<meta\b(?=[^>]*\bname=["']robots["'])[^>]*\bcontent=["']noindex,nofollow["']/i.test(template)
  ) {
    throw new Error("The release frontend template is missing, indexable, or invalid.");
  }

  const moduleScripts = [...template.matchAll(/<script\b(?=[^>]*\btype=["']module["'])[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)];
  const stylesheets = [...template.matchAll(/<link\b(?=[^>]*\brel=["']stylesheet["'])[^>]*\bhref=["']([^"']+)["'][^>]*>/gi)];
  const modulePreloads = [...template.matchAll(/<link\b(?=[^>]*\brel=["']modulepreload["'])[^>]*\bhref=["']([^"']+)["'][^>]*>/gi)];
  const localStylesheets = stylesheets.filter(([, asset]) => asset.startsWith("/assets/"));
  const validFontStylesheet = ([, asset]) => {
    try {
      const url = new URL(asset);
      return url.origin === "https://fonts.googleapis.com"
        && url.pathname === "/css2"
        && url.search.length > 1
        && !url.hash;
    } catch {
      return false;
    }
  };
  const assets = [...moduleScripts, ...localStylesheets, ...modulePreloads];
  if (
    moduleScripts.length === 0 ||
    assets.some(([, asset]) => !/^\/assets\/[a-z\d._-]+\.(?:js|css)$/i.test(asset)) ||
    stylesheets.some((stylesheet) => (
      !localStylesheets.includes(stylesheet) && !validFontStylesheet(stylesheet)
    )) ||
    localStylesheets.some(([, asset]) => !/\.css$/i.test(asset)) ||
    [...moduleScripts, ...modulePreloads].some(([, asset]) => !/\.js$/i.test(asset))
  ) {
    throw new Error("The release frontend template contains invalid or unversioned app assets.");
  }
  return template;
}

function createSeoHead({
  title,
  description,
  canonical,
  image,
  robots,
  structuredData,
  type = "website"
}) {
  const safeTitle = escapeHtml(title);
  const safeDescription = escapeHtml(description);
  const safeCanonical = canonical ? escapeHtml(canonical) : "";
  const safeImage = escapeHtml(image || `${DEFAULT_SITE_BASE_URL}/logo.png`);
  const tags = [
    `<title data-rh="true">${safeTitle}</title>`,
    `<meta data-rh="true" name="description" content="${safeDescription}"/>`,
    `<meta data-rh="true" name="robots" content="${escapeHtml(robots)}"/>`
  ];
  if (canonical) tags.push(`<link data-rh="true" rel="canonical" href="${safeCanonical}"/>`);
  if (canonical) {
    tags.push(
      `<meta data-rh="true" property="og:type" content="${escapeHtml(type)}"/>`,
      `<meta data-rh="true" property="og:url" content="${safeCanonical}"/>`,
      `<meta data-rh="true" property="og:title" content="${safeTitle}"/>`,
      `<meta data-rh="true" property="og:description" content="${safeDescription}"/>`,
      `<meta data-rh="true" property="og:image" content="${safeImage}"/>`,
      `<meta data-rh="true" property="og:image:alt" content="${safeTitle}"/>`,
      `<meta data-rh="true" name="twitter:card" content="summary_large_image"/>`,
      `<meta data-rh="true" name="twitter:title" content="${safeTitle}"/>`,
      `<meta data-rh="true" name="twitter:description" content="${safeDescription}"/>`,
      `<meta data-rh="true" name="twitter:image" content="${safeImage}"/>`,
      `<meta data-rh="true" name="twitter:url" content="${safeCanonical}"/>`
    );
  }
  if (structuredData) {
    tags.push(`<script data-rh="true" type="application/ld+json">${serializeJsonLd(structuredData)}</script>`);
  }
  return tags.join("\n    ");
}

export function renderDynamicSeoHtml(template, {
  title,
  description,
  canonical = null,
  image = null,
  robots = "noindex,nofollow",
  structuredData = null,
  type = "website",
  prerenderedPath = "",
  body = "",
  hydrationData,
  dynamicAd = false
}) {
  const seoHead = createSeoHead({
    title,
    description,
    canonical,
    image,
    robots,
    structuredData,
    type
  });
  const cleaned = template
    .replace(/<title\b[^>]*>[\s\S]*?<\/title>/gi, "")
    .replace(/<meta\b(?=[^>]*(?:name|property)=["'](?:description|robots|canonical|og:[^"']+|twitter:[^"']+|souqak-prerendered-path)["'])[^>]*>/gi, "")
    .replace(/<link\b(?=[^>]*\brel=["']canonical["'])[^>]*>/gi, "")
    .replace(/<script\b(?=[^>]*\btype=["']application\/ld\+json["'])[^>]*>[\s\S]*?<\/script>/gi, "");
  const withSeo = cleaned.replace(
    /<\/head>/i,
    `    <meta name="souqak-prerendered-path" content="${escapeHtml(prerenderedPath)}"/>\n    ${seoHead}\n  </head>`
  );
  if (withSeo === cleaned) throw new Error("The release frontend template has no closing head tag.");

  const root = `<div id="root" data-ssg="true">${body}</div>`;
  let html = withSeo.replace(/<div\b(?=[^>]*\bid=["']root["'])[^>]*>\s*<\/div>/i, root);
  if (hydrationData !== undefined || dynamicAd) {
    const script = [
      hydrationData !== undefined ? `window.__SOUQAK_SSG_DATA__=${serializeJsonLd(hydrationData)};` : "",
      dynamicAd ? "window.__SOUQAK_DYNAMIC_AD__=true;" : ""
    ].join("");
    html = html.replace(/<\/body>/i, `<script>${script}</script>\n  </body>`);
  }
  return html;
}

export function sendDynamicSeoPage(res, template, {
  status = 200,
  routePath = "",
  ...page
}) {
  if (status !== 200 || String(page.robots || "").startsWith("noindex")) {
    res.setHeader("X-Robots-Tag", "noindex, nofollow");
  }
  return res.status(status).send(renderDynamicSeoHtml(template, {
    ...page,
    prerenderedPath: routePath
  }));
}

export function parseDynamicSeoRouteTarget(requestTarget, prefix, segmentCount) {
  if (typeof requestTarget !== "string") return null;
  if (requestTarget.length > 4096) {
    return new RegExp(`^/${prefix}(?:/|$)`, "i").test(requestTarget)
      ? { valid: false, rawPath: "", pathSegmentCount: -1 }
      : null;
  }
  const queryIndex = requestTarget.indexOf("?");
  const rawPath = queryIndex === -1 ? requestTarget : requestTarget.slice(0, queryIndex);
  const queryString = queryIndex === -1 ? "" : requestTarget.slice(queryIndex + 1);
  if (!new RegExp(`^/${prefix}(?:/|$)`, "i").test(rawPath)) return null;

  const pathSegments = rawPath.slice(prefix.length + 2).split("/");
  if (pathSegments[pathSegments.length - 1] === "") pathSegments.pop();
  const allowedSegmentCounts = Array.isArray(segmentCount) ? segmentCount : [segmentCount];
  if (!allowedSegmentCounts.includes(pathSegments.length) || pathSegments.some((segment) => !segment)) {
    return {
      valid: false,
      rawPath,
      queryString,
      pathSegmentCount: pathSegments.length,
      pathSegments: []
    };
  }

  const decodedSegments = [];
  try {
    for (const segment of pathSegments) {
      const decoded = decodeURIComponent(segment);
      if (/%[a-f\d]{2}/i.test(decoded)) throw new Error("Double-encoded route segment.");
      encodeSeoPathSegment(decoded);
      decodedSegments.push(decoded);
    }
  } catch {
    return {
      valid: false,
      rawPath,
      queryString,
      pathSegmentCount: pathSegments.length,
      pathSegments: []
    };
  }
  return {
    valid: true,
    rawPath,
    queryString,
    pathSegmentCount: decodedSegments.length,
    pathSegments: decodedSegments
  };
}

export function createDynamicSeoRenderer({
  resources,
  template,
  readTemplate = () => fs.readFile(FRONTEND_TEMPLATE, "utf8"),
  siteBaseUrl = DEFAULT_SITE_BASE_URL,
  apiOrigin = "",
  cache,
  workLimiter = sharedSeoWorkLimiter
} = {}) {
  if (!Array.isArray(resources) || resources.some((resource) => (
    typeof resource?.match !== "function" || typeof resource?.render !== "function"
  ))) {
    throw new TypeError("Dynamic SEO resources must define match and render functions.");
  }
  const normalizedSiteBaseUrl = resolveSiteBaseUrl(siteBaseUrl);
  const renderCache = cache || new BoundedLruCache(resolveSeoCacheOptions());
  const rendererWorkLimiter = workLimiter || new BoundedSeoWorkLimiter(
    renderCache.options.maxInFlight
  );
  let templatePromise = typeof template === "string" ? Promise.resolve(template) : null;
  const getTemplate = async () => {
    if (!templatePromise) {
      templatePromise = Promise.resolve()
        .then(readTemplate)
        .catch((error) => {
          templatePromise = null;
          throw error;
        });
    }
    return validateFrontendTemplate(await templatePromise);
  };

  return async function dynamicSeoRenderer(req, res, next) {
    if (!["GET", "HEAD"].includes(req.method)) return next();
    const accept = String(req.headers.accept || "").toLowerCase();
    if (!accept.includes("text/html")) return next();
    const matchedResource = resources
      .map((resource) => ({ resource, target: resource.match(req) }))
      .find(({ target }) => target !== null && target !== undefined);
    if (!matchedResource) return next();

    res.setHeader("Cache-Control", "no-store, max-age=0");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Vary", "Accept");
    res.type("html");
    let shell;
    try {
      shell = await getTemplate();
    } catch (error) {
      const label = matchedResource.resource.resourceLabel || "الصفحة";
      console.error("[dynamic-seo-renderer] release frontend template unavailable", {
        code: error?.code || error?.name || "unknown"
      });
      res.setHeader("Retry-After", String(RETRY_AFTER_SECONDS));
      res.setHeader("X-Robots-Tag", "noindex, nofollow");
      return res.status(503).send(
        `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"/><meta name="robots" content="noindex,nofollow"/><title>تعذر تحميل ${label} | سوقك</title></head><body><main><h1>تعذر تحميل ${label} حالياً</h1><p>يرجى المحاولة مرة أخرى بعد قليل.</p></main></body></html>`
      );
    }

    try {
      const target = matchedResource.target;
      const label = String(matchedResource.resource.resourceLabel || "");
      const cacheType = label === "الإعلان" ? "ad"
        : label === "الفئة" ? "category"
          : label === "المتجر" ? "store"
            : label === "المزاد" ? "auction"
              : null;
      const stableSegments = target.valid
        ? (
          cacheType === "ad"
            ? [target.id, target.slug].filter(Boolean).map((segment) => encodeSeoPathSegment(segment)).join("/")
            : Array.isArray(target.pathSegments)
              ? target.pathSegments.map((segment) => encodeSeoPathSegment(segment)).join("/")
              : ""
        )
        : "";
      const cacheKey = cacheType && stableSegments
        ? `seo-render:${cacheType}:${stableSegments}`
        : null;
      const routePrefix = cacheType === "ad" ? "/ad"
        : cacheType === "category" ? "/category"
          : cacheType === "store" ? "/store"
            : cacheType === "auction" ? "/auctions"
              : "";
      const exactCanonicalPath = routePrefix
        ? `${routePrefix}/${stableSegments}`
        : "";
      const ttl = cacheType === "ad" ? renderCache.options.adTtlMs
        : cacheType === "category" ? renderCache.options.categoryTtlMs
          : cacheType === "store" ? renderCache.options.storeTtlMs
            : cacheType === "auction" ? renderCache.options.auctionTtlMs
              : 0;

      const hasUnknownContentFilters = hasMeaningfulQueryParameters(target.queryString);
      if (
        !cacheKey ||
        !cacheType ||
        cacheType === "auction" ||
        target.rawPath !== exactCanonicalPath ||
        hasUnknownContentFilters
      ) {
        const release = rendererWorkLimiter.tryAcquire();
        if (!release) throw new SeoWorkLimitError();
        try {
          return await matchedResource.resource.render({
            req,
            res,
            next,
            target,
            template: shell,
            siteBaseUrl: normalizedSiteBaseUrl,
            apiOrigin
          });
        } finally {
          release();
        }
      }

      const captured = await renderCache.getOrGenerate(cacheKey, ttl, async () => {
        const capture = Object.create(res);
        let captureStatus = 200;
        let captureBody = "";
        const captureHeaders = new Map();
        capture.setHeader = (name, value) => {
          captureHeaders.set(String(name).toLowerCase(), value);
          return capture;
        };
        capture.getHeader = (name) => captureHeaders.get(String(name).toLowerCase());
        capture.status = (statusCode) => {
          captureStatus = statusCode;
          return capture;
        };
        capture.send = (body) => {
          captureBody = typeof body === "string" ? body : String(body ?? "");
          return captureBody;
        };
        capture.end = () => capture;
        await matchedResource.resource.render({
          req,
          res: capture,
          next,
          target,
          template: shell,
          siteBaseUrl: normalizedSiteBaseUrl,
          apiOrigin
        });
        const robots = capture.getHeader?.("X-Robots-Tag");
        return {
          status: captureStatus,
          body: captureBody,
          headers: Object.fromEntries(captureHeaders),
          cacheable: captureStatus === 200 &&
            !String(robots || "").toLowerCase().includes("noindex")
        };
      }, typeof matchedResource.resource.revalidate === "function"
        ? () => matchedResource.resource.revalidate(target)
        : null, rendererWorkLimiter);
      if (!captured) return next();
      for (const [name, value] of Object.entries(captured.headers || {})) {
        res.setHeader(name, value);
      }
      if (captured.status === 200) {
        res.status(200);
        return res.send(captured.body);
      }
      if (captured.status >= 300 && captured.status < 400) {
        return res.status(captured.status).end();
      } else {
        res.status(captured.status);
        return res.send(captured.body);
      }
    } catch (error) {
      if (res.headersSent) return next(error);
      const label = matchedResource.resource.resourceLabel || "الصفحة";
      console.error("[dynamic-seo-renderer] public resource render failed", {
        path: matchedResource.target?.rawPath || "",
        code: error?.code || error?.name || "unknown"
      });
      res.setHeader("Retry-After", String(RETRY_AFTER_SECONDS));
      res.setHeader("X-Robots-Tag", "noindex, nofollow");
      return sendDynamicSeoPage(res, shell, {
        status: 503,
        routePath: matchedResource.target?.rawPath || "",
        title: `تعذر تحميل ${label} | سوقك`,
        description: "تعذر تحميل المحتوى المطلوب حاليًا. يرجى المحاولة مرة أخرى.",
        body: `<main class="ssg-public-content" dir="rtl"><h1>تعذر تحميل ${label} حالياً</h1><p>يرجى المحاولة مرة أخرى بعد قليل.</p></main>`
      });
    }
  };
}

export const dynamicSeoRendererInternals = Object.freeze({
  escapeHtml,
  safeJson: serializeJsonLd,
  createSeoHead,
  parseDynamicSeoRouteTarget
});
