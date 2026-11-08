import { useEffect, useState } from "react";

const SENSITIVE_FOLDERS = new Set(["receipts", "ids", "kyc", "documents"]);

export function normalizeProtectedFilePath(filename) {
  if (typeof filename !== "string" || !filename.trim()) return null;

  let pathname = filename.trim().replace(/\\/g, "/");
  if (/^https?:\/\//i.test(pathname)) {
    try {
      pathname = new URL(pathname).pathname;
    } catch {
      return null;
    }
  }

  pathname = pathname.replace(/^\/+/, "");
  if (pathname.startsWith("uploads/")) pathname = pathname.slice("uploads/".length);
  if (pathname.includes("?") || pathname.includes("#")) return null;
  const segments = pathname.split("/");
  if (
    segments.length !== 2
    || !SENSITIVE_FOLDERS.has(segments[0].toLowerCase())
    || !segments[1]
    || segments.some((segment) => segment === "." || segment === "..")
  ) {
    return null;
  }
  return `${segments[0].toLowerCase()}/${segments[1]}`;
}

export function getProtectedFileUrl(api, filename) {
  const normalizedPath = normalizeProtectedFilePath(filename);
  const apiBase = api?.defaults?.baseURL;
  if (!normalizedPath || typeof apiBase !== "string") {
    throw new TypeError("A valid protected file path and API client are required.");
  }

  const baseUrl = new URL(apiBase);
  const apiPath = baseUrl.pathname.replace(/\/api\/?$/, "").replace(/\/+$/, "");
  const encodedPath = normalizedPath.split("/").map(encodeURIComponent).join("/");
  baseUrl.pathname = `${apiPath}/uploads/${encodedPath}`;
  baseUrl.search = "";
  baseUrl.hash = "";
  return baseUrl.href;
}

export async function fetchProtectedFileBlob(api, filename, signal) {
  const response = await api.get(getProtectedFileUrl(api, filename), {
    responseType: "blob",
    signal,
    headers: { Accept: "image/jpeg, image/png, image/webp, application/pdf" }
  });

  const blob = response.data;
  if (!(blob instanceof Blob) || blob.size === 0) {
    throw new Error("Protected file response is empty or invalid.");
  }

  const contentType = (response.headers?.["content-type"] || blob.type || "").toLowerCase();
  if (contentType.includes("svg")) {
    throw new Error("Protected file endpoint returned an SVG response.");
  }
  return blob;
}

export function useProtectedFiles(api, filenames) {
  const paths = [...new Set((Array.isArray(filenames) ? filenames : [filenames])
    .map(normalizeProtectedFilePath)
    .filter(Boolean))];
  const pathsKey = JSON.stringify(paths);
  const [result, setResult] = useState({ pathsKey: "", urls: {}, contentTypes: {}, errors: {}, loading: false });

  useEffect(() => {
    const requestedPaths = JSON.parse(pathsKey);
    const controller = new AbortController();
    const objectUrls = new Set();
    let active = true;

    setResult({ pathsKey, urls: {}, contentTypes: {}, errors: {}, loading: requestedPaths.length > 0 });

    if (requestedPaths.length > 0) {
      Promise.all(requestedPaths.map(async (path) => {
        try {
          const blob = await fetchProtectedFileBlob(api, path, controller.signal);
          if (!active) return [path, null, "", null];
          const url = URL.createObjectURL(blob);
          objectUrls.add(url);
          return [path, url, blob.type, null];
        } catch {
          return [path, null, "", "تعذر تحميل الملف الخاص."];
        }
      })).then((entries) => {
        if (!active) return;
        const urls = {};
        const contentTypes = {};
        const errors = {};
        for (const [path, url, contentType, error] of entries) {
          if (url) urls[path] = url;
          if (contentType) contentTypes[path] = contentType;
          if (error) errors[path] = error;
        }
        setResult({ pathsKey, urls, contentTypes, errors, loading: false });
      });
    }

    return () => {
      active = false;
      controller.abort();
      for (const url of objectUrls) URL.revokeObjectURL(url);
    };
  }, [api, pathsKey]);

  if (result.pathsKey !== pathsKey) {
    return { urls: {}, contentTypes: {}, errors: {}, loading: paths.length > 0 };
  }
  return result;
}
