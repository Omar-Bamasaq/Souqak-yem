export const CHROME_NOTICE_DISMISSED_KEY = "souqak_mobile_chrome_notice_dismissed";

const iOSPattern = /iPhone|iPad|iPod/i;
const androidPattern = /Android/i;
const inAppBrowserPattern = /FBAN|FBAV|FB_IAB|Instagram|WhatsApp|MicroMessenger|TikTok|SamsungBrowser|MiuiBrowser|UCBrowser|QQBrowser|DuckDuckGo|Brave|Vivaldi|Edg(?:A|iOS|)|OPR\/|OPiOS|FxiOS|Firefox|Puffin|YaBrowser|Klar|HeadlessChrome/i;

export const isStandalonePwa = (targetWindow = window) => {
  if (!targetWindow || typeof targetWindow.matchMedia !== "function") return false;
  return targetWindow.matchMedia("(display-mode: standalone)").matches || Boolean(targetWindow.navigator?.standalone);
};

const isAndroidWebView = (userAgent = "") => /(?:wv|WebView)/i.test(userAgent)
  || /Version\/\d+\.\d+\s+Chrome\//i.test(userAgent);

export const isGoogleChrome = (userAgent = navigator.userAgent || "") => {
  if (!userAgent) return false;

  const ua = String(userAgent);

  if (androidPattern.test(ua)) {
    return /Chrome\//i.test(ua)
      && !/Chrome\s*\/.*\s+Version\//i.test(ua)
      && !inAppBrowserPattern.test(ua)
      && !isAndroidWebView(ua);
  }

  if (iOSPattern.test(ua)) {
    return /CriOS\//i.test(ua) && !inAppBrowserPattern.test(ua);
  }

  return false;
};

export const shouldShowChromeBrowserNotice = (targetWindow = window) => {
  if (!targetWindow || typeof targetWindow.navigator === "undefined") return false;

  const userAgent = targetWindow.navigator.userAgent || "";
  const isMobileBrowser = androidPattern.test(userAgent) || iOSPattern.test(userAgent);
  if (!isMobileBrowser || isStandalonePwa(targetWindow) || isGoogleChrome(userAgent)) {
    return false;
  }

  try {
    return !targetWindow.sessionStorage?.getItem(CHROME_NOTICE_DISMISSED_KEY);
  } catch {
    return true;
  }
};
