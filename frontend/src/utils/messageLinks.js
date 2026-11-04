const URL_PATTERN = /https?:\/\/[^\s<>]+/gi;
const TRAILING_PUNCTUATION = /[.,!?;:،؛؟"'»]+$/u;

function trimUrlPunctuation(value) {
  let url = value;
  let trailing = "";

  while (url) {
    const punctuation = url.match(TRAILING_PUNCTUATION)?.[0];
    if (punctuation) {
      url = url.slice(0, -punctuation.length);
      trailing = punctuation + trailing;
      continue;
    }
    if (url.endsWith(")") && (url.match(/\(/g) || []).length < (url.match(/\)/g) || []).length) {
      url = url.slice(0, -1);
      trailing = `)${trailing}`;
      continue;
    }
    if (url.endsWith("]") && (url.match(/\[/g) || []).length < (url.match(/\]/g) || []).length) {
      url = url.slice(0, -1);
      trailing = `]${trailing}`;
      continue;
    }
    break;
  }

  return { url, trailing };
}

function isMapUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;

  const hostname = url.hostname.toLowerCase();
  const path = url.pathname.toLowerCase();
  const isHostOrSubdomain = (domain) => hostname === domain || hostname.endsWith(`.${domain}`);

  return (
    (isHostOrSubdomain("google.com") && path.startsWith("/maps")) ||
    (isHostOrSubdomain("google.co.uk") && path.startsWith("/maps")) ||
    hostname === "maps.app.goo.gl" ||
    (hostname === "goo.gl" && path.startsWith("/maps")) ||
    hostname === "maps.apple.com" ||
    isHostOrSubdomain("openstreetmap.org") ||
    isHostOrSubdomain("osm.org") ||
    (isHostOrSubdomain("waze.com") && (path.startsWith("/ul") || path.startsWith("/live-map"))) ||
    (isHostOrSubdomain("bing.com") && path.startsWith("/maps")) ||
    isHostOrSubdomain("wego.here.com") ||
    (isHostOrSubdomain("yandex.com") && path.startsWith("/maps"))
  );
}

export function splitMessageText(text) {
  if (!text) return [];

  const parts = [];
  const addText = (value) => {
    if (!value) return;
    const previous = parts.at(-1);
    if (previous && !previous.url) previous.text += value;
    else parts.push({ text: value });
  };
  let lastIndex = 0;
  for (const match of text.matchAll(URL_PATTERN)) {
    const start = match.index;
    const { url, trailing } = trimUrlPunctuation(match[0]);
    if (!url) continue;

    if (start > lastIndex) addText(text.slice(lastIndex, start));
    if (isMapUrl(url)) {
      parts.push({ text: url, url });
    } else {
      addText(url);
    }
    if (trailing) addText(trailing);
    lastIndex = start + match[0].length;
  }

  if (lastIndex < text.length) addText(text.slice(lastIndex));
  return parts;
}
