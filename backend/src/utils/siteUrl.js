const normalizeBaseUrl = (value) => {
  if (!value || !value.trim()) return value;
  return value.trim().replace(/\/+$/, "");
};

export function getFrontendBaseUrl() {
  const configured = process.env.FRONTEND_URL || process.env.FRONTEND_ORIGIN?.split(",")[0]?.trim();
  return normalizeBaseUrl(configured || "https://souqak-yem.com");
}

export function getBackendBaseUrl() {
  return normalizeBaseUrl(process.env.BACKEND_URL || "https://souqak-yem.com");
}

export function getUploadsBaseUrl() {
  return `${getBackendBaseUrl()}/uploads`;
}
