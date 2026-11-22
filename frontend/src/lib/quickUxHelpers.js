export function isAuthorizedActiveStore(store) {
  return Boolean(store && store.status === "active" && store.subscriptionStatus === "active");
}

export function getAuthorizedActiveStoreChoices(storeResult, familyResult) {
  const choices = [];
  if (storeResult?.status === "fulfilled" && isAuthorizedActiveStore(storeResult.value?.data)) {
    choices.push({ storeType: "store", label: "منتج للمتجر" });
  }
  if (familyResult?.status === "fulfilled" && isAuthorizedActiveStore(familyResult.value?.data)) {
    choices.push({ storeType: "family-production", label: "منتج لمشروعي" });
  }
  return choices;
}

export function getRouteServiceStatus({ loading, referencesLoaded, dataLoadStatus, routeServiceId, services, selectedId }) {
  if (!routeServiceId) return "idle";
  if (loading || !referencesLoaded || dataLoadStatus === "loading") return "loading";
  if (dataLoadStatus === "error") return "error";
  if (!services.some((service) => service._id === routeServiceId)) return "unavailable";
  return selectedId === routeServiceId ? "success" : "loading";
}

export function getStoreSetupProgress(store, ads = [], storeId = store?._id) {
  const descriptionComplete = Boolean(typeof store?.description === "string" && store.description.trim());
  const locationComplete = Boolean(
    (typeof store?.location === "string" && store.location.trim())
    || (typeof store?.customCityName === "string" && store.customCityName.trim())
    || store?.governorateId
    || store?.cityId
  );
  const storeInfoComplete = Boolean(
    descriptionComplete
    && locationComplete
  );
  const contactComplete = Boolean(
    store?.phone
    || (typeof store?.email === "string" && store.email.trim())
    || (Array.isArray(store?.phones) && store.phones.some((item) => item?.value))
    || (Array.isArray(store?.whatsapp) && store.whatsapp.some((item) => item?.value))
  );
  const identityComplete = Boolean(store?.logo);
  const normalizedStoreId = storeId ? String(storeId) : "";
  const productsComplete = Boolean(normalizedStoreId)
    && Array.isArray(ads)
    && ads.some((ad) => String(ad?.storeProfileId?._id || ad?.storeProfileId || "") === normalizedStoreId);
  const items = [
    { id: "identity", label: "شعار المشروع", complete: identityComplete, tab: "customization" },
    { id: "storeInfo", label: "بيانات المشروع", complete: storeInfoComplete, tab: "customization" },
    { id: "contact", label: "بيانات التواصل", complete: contactComplete, tab: "customization" },
    { id: "products", label: "إضافة منتج واحد على الأقل", complete: productsComplete, tab: "products" }
  ];
  const completedCount = items.filter((item) => item.complete).length;
  return {
    items,
    completedCount,
    totalCount: items.length,
    complete: completedCount === items.length
  };
}
