export const DEFAULT_SITE_BASE_URL = "https://souqak-yem.com";

export function resolveSiteBaseUrl(configuredUrl) {
  const parsedUrl = new URL(configuredUrl || DEFAULT_SITE_BASE_URL);
  if (
    parsedUrl.protocol !== "https:" ||
    parsedUrl.username ||
    parsedUrl.password ||
    parsedUrl.search ||
    parsedUrl.hash
  ) {
    throw new Error("The public site URL must use HTTPS.");
  }
  return `${parsedUrl.origin}${parsedUrl.pathname.replace(/\/+$/, "")}`;
}

export function resolveSiteUrl(pathOrUrl, baseUrl = DEFAULT_SITE_BASE_URL) {
  const normalizedBaseUrl = resolveSiteBaseUrl(baseUrl);
  const base = new URL(`${normalizedBaseUrl}/`);
  const resolved = new URL(pathOrUrl || "/", base);
  if (resolved.origin !== base.origin) {
    throw new Error("Public SEO URLs must use the configured site origin.");
  }
  const basePath = base.pathname.replace(/\/+$/, "");
  const alreadyHasBasePath = !basePath ||
    resolved.pathname === basePath ||
    resolved.pathname.startsWith(`${basePath}/`);
  const pathname = alreadyHasBasePath
    ? resolved.pathname
    : `${basePath}${resolved.pathname.startsWith("/") ? resolved.pathname : `/${resolved.pathname}`}`;
  return `${base.origin}${pathname}${resolved.search}${resolved.hash}`;
}

export function resolveCanonicalUrl(canonicalUrl, baseUrl = DEFAULT_SITE_BASE_URL) {
  const resolved = new URL(resolveSiteUrl(canonicalUrl || "/", baseUrl));
  return `${resolved.origin}${resolved.pathname}`;
}
