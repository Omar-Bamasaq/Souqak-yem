export const STORE_PWA_FALLBACK_QUERY = "souqakInstallFallback";

const isIosDevice = ({ userAgent = "", platform = "", maxTouchPoints = 0 }) =>
  /iPhone|iPad|iPod/i.test(userAgent)
  || (platform === "MacIntel" && maxTouchPoints > 1);

export function getStorePwaInstallFallback({ userAgent = "", platform = "", maxTouchPoints = 0, pageUrl }) {
  const page = new URL(pageUrl);
  page.searchParams.delete(STORE_PWA_FALLBACK_QUERY);

  if (/Android/i.test(userAgent)) {
    const fallbackUrl = new URL(page.href);
    fallbackUrl.searchParams.set(STORE_PWA_FALLBACK_QUERY, "chrome-unavailable");
    const intentUrl = `intent://${page.host}${page.pathname}${page.search}#Intent;scheme=${page.protocol.slice(0, -1)};package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(fallbackUrl.href)};end`;

    return { platform: "android", url: intentUrl, pageUrl: page.href };
  }

  if (isIosDevice({ userAgent, platform, maxTouchPoints })) {
    return { platform: "ios", url: page.href, pageUrl: page.href };
  }

  return { platform: "other", url: page.href, pageUrl: page.href };
}
