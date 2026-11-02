import { useEffect, useMemo, useState } from "react";

function getUploadsBaseUrl() {
  let envUrl = import.meta.env?.VITE_UPLOADS_URL;
  if (!envUrl) {
    const apiBase = import.meta.env?.VITE_API_URL || "http://localhost:5000/api";
    envUrl = apiBase.replace(/\/api$/, "").replace(/\/$/, "") + "/uploads";
  }
  if (envUrl.endsWith("/uploads")) return envUrl;
  return envUrl.endsWith("/") ? `${envUrl}uploads` : `${envUrl}/uploads`;
}

export function normalizeProtectedFilePath(filePath) {
  if (typeof filePath !== "string" || !filePath.trim()) return null;

  const uploadsBaseUrl = getUploadsBaseUrl().replace(/\/+$/, "");
  const source = filePath.trim().replace(/\\/g, "/");
  let relativePath = source;

  if (/^https?:\/\//i.test(source)) {
    try {
      const fileUrl = new URL(source);
      const uploadsBase = new URL(
        uploadsBaseUrl,
        typeof window === "undefined" ? "http://localhost" : window.location.origin
      );
      const uploadsPath = uploadsBase.pathname.replace(/\/+$/, "");

      if (fileUrl.origin === uploadsBase.origin) {
        relativePath = fileUrl.pathname.startsWith(`${uploadsPath}/`)
          ? fileUrl.pathname.slice(uploadsPath.length + 1)
          : fileUrl.pathname;
      } else {
        const uploadsIndex = fileUrl.pathname.toLowerCase().lastIndexOf("/uploads/");
        if (uploadsIndex === -1) return null;
        relativePath = fileUrl.pathname.slice(uploadsIndex + "/uploads/".length);
      }
    } catch {
      return null;
    }
  }

  relativePath = relativePath.split(/[?#]/, 1)[0].replace(/^\/+/, "");
  if (relativePath.startsWith("uploads/")) relativePath = relativePath.slice("uploads/".length);

  const segments = relativePath.split("/").filter(Boolean);
  if (!segments.length) return null;

  const safeSegments = [];
  for (const segment of segments) {
    let decoded;
    try {
      decoded = decodeURIComponent(segment);
    } catch {
      return null;
    }
    if (
      decoded === "." ||
      decoded === ".." ||
      decoded.includes("/") ||
      decoded.includes("\\") ||
      /[\u0000-\u001f\u007f]/.test(decoded)
    ) {
      return null;
    }
    safeSegments.push(encodeURIComponent(decoded));
  }

  return `${uploadsBaseUrl}/${safeSegments.join("/")}`;
}

export function useProtectedFiles(api, filePaths = []) {
  const requestKey = JSON.stringify([
    ...new Set(filePaths.map(normalizeProtectedFilePath).filter(Boolean)),
  ]);
  const requestPaths = useMemo(() => JSON.parse(requestKey), [requestKey]);
  const [result, setResult] = useState({
    requestKey: null,
    urls: {},
    errors: [],
    loading: false,
  });

  useEffect(() => {
    const controller = new AbortController();
    const createdUrls = new Set();
    let active = true;

    setResult({ requestKey, urls: {}, errors: [], loading: requestPaths.length > 0 });

    Promise.all(requestPaths.map(async (path) => {
      try {
        const response = await api.get(path, {
          responseType: "blob",
          signal: controller.signal,
        });
        if (!(response.data instanceof Blob)) {
          throw new Error("Protected file response was not a Blob");
        }
        if (response.data.type?.includes("svg")) {
          const text = await response.data.text();
          if (text.includes("تسجيل الدخول مطلوب") || text.includes("وصول مرفوض")) {
            throw new Error("Protected file request was denied");
          }
        }
        if (!active || controller.signal.aborted) return { path };
        const url = URL.createObjectURL(response.data);
        createdUrls.add(url);
        return { path, url };
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error("[ProtectedFiles] Failed to load a protected file.", {
            status: error?.response?.status,
            code: error?.code,
          });
        }
        return { path, error: true };
      }
    })).then((files) => {
      if (!active) return;
      const urls = {};
      const errors = [];
      for (const file of files) {
        if (file.url) urls[file.path] = file.url;
        if (file.error) errors.push(file.path);
      }
      setResult({ requestKey, urls, errors, loading: false });
    });

    return () => {
      active = false;
      controller.abort();
      for (const url of createdUrls) URL.revokeObjectURL(url);
    };
  }, [api, requestKey]);

  const isCurrent = result.requestKey === requestKey;

  return {
    urlFor(filePath) {
      const path = normalizeProtectedFilePath(filePath);
      return path && isCurrent ? result.urls[path] || null : null;
    },
    isLoading(filePath) {
      const path = normalizeProtectedFilePath(filePath);
      return Boolean(path && requestPaths.includes(path) && (!isCurrent || result.loading));
    },
    hasError(filePath) {
      const path = normalizeProtectedFilePath(filePath);
      return Boolean(path && isCurrent && result.errors.includes(path));
    },
  };
}
