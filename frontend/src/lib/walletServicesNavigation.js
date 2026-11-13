export function getWalletServicesPath(pathname, search = "") {
  const query = search instanceof URLSearchParams
    ? search.toString()
    : String(search || "").replace(/^\?/, "");
  return query ? `${pathname}?${query}` : pathname;
}

export function getWalletServiceCategoryPath(categorySlug, search = "") {
  return getWalletServicesPath(
    categorySlug
      ? `/wallet-services/category/${encodeURIComponent(categorySlug)}`
      : "/wallet-services",
    search
  );
}

export function getWalletServicesBackTarget(pathname, search = "") {
  if (/^\/wallet-services\/category\/[^/]+\/?$/.test(pathname)) {
    return getWalletServicesPath("/wallet-services", search);
  }
  return null;
}
