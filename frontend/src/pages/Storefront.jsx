import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useApi } from "../api/axios.js";
import { useAuth } from "../store/AuthContext.jsx";
import { uploadsUrl } from "../lib/uploads.js";
import StoreTemplateRenderer from "../components/StoreTemplateRenderer.jsx";
import PWAInstallPrompt from "../components/PWAInstallPrompt.jsx";
import SEO from "../components/SEO.jsx";
import { canInstallPWA, installPWA, isPWAStandalone, setPWAInstallTarget } from "../utils/pwaInstall.js";
import { applyStoreManifest, restoreGlobalManifest } from "../utils/storePwa.js";
import { GENERAL_STORE_TEMPLATE } from "../utils/storeTemplates.js";
import { claimStoreAnalyticsView } from "../utils/storeAnalyticsTracking.js";
import { getStorePwaInstallationId } from "../utils/storePwaInstallTracking.js";
import { subscribeToPush } from "../utils/pushNotifications.js";
import { StoreLoadingCards } from "../components/StoreUi.jsx";

function normalizeWhatsAppPhone(phone) {
  if (!phone) return null;
  const digits = String(phone).replace(/[^\d+]/g, "").replace(/^\+/, "");
  if (!digits) return null;
  const normalized = digits.startsWith("00") ? digits.replace(/^00/, "") : digits;
  if (!normalized || normalized.length < 8) return null;
  return `https://wa.me/${normalized.replace(/\+/g, "")}`;
}

function getReadableTextColor(hexColor) {
  const color = /^#(?:[\da-f]{3}|[\da-f]{6})$/i.test(String(hexColor || "")) ? hexColor : "#0b89ed";
  const expanded = color.length === 4 ? `#${[...color.slice(1)].map((digit) => digit + digit).join("")}` : color;
  const channels = [1, 3, 5].map((index) => parseInt(expanded.slice(index, index + 2), 16) / 255);
  const luminance = channels.map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return 0.2126 * luminance[0] + 0.7152 * luminance[1] + 0.0722 * luminance[2] > 0.42 ? "#111827" : "#ffffff";
}

function StoreSocialIcon({ platform }) {
  switch (platform.toLowerCase()) {
    case "facebook":
      return <svg aria-hidden="true" className="h-5 w-5 text-[#1877F2]" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073c0 6.02 4.388 11.02 10.125 11.927v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.97h-1.514c-1.491 0-1.955.93-1.955 1.884v2.27h3.328l-.532 3.49h-2.796V24C19.612 23.093 24 18.093 24 12.073Z" /></svg>;
    case "instagram":
      return <svg aria-hidden="true" className="h-5 w-5 text-[#C13584]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" /></svg>;
    case "tiktok":
      return <svg aria-hidden="true" className="h-5 w-5 text-slate-900" fill="currentColor" viewBox="0 0 24 24"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.4v13.67a2.9 2.9 0 0 1-2.9 2.9 2.9 2.9 0 1 1 2.9-2.9c0-.27-.04-.53-.1-.78v-3.47a6.3 6.3 0 1 0 3.5 5.65V9.9a8.16 8.16 0 0 0 4.77 1.54V8.05a4.85 4.85 0 0 1-1-.1Z" /></svg>;
    case "youtube":
      return <svg aria-hidden="true" className="h-5 w-5 text-[#FF0000]" fill="currentColor" viewBox="0 0 24 24"><path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8ZM9.6 15.6V8.4l6.2 3.6-6.2 3.6Z" /></svg>;
    case "whatsappchannel":
      return <svg aria-hidden="true" className="h-5 w-5 text-[#25D366]" fill="currentColor" viewBox="0 0 24 24"><path d="M12.04 2C6.51 2 2 6.51 2 12.04c0 1.77.46 3.43 1.27 4.87L2 22l5.24-1.24a10 10 0 0 0 4.8 1.22h.01C17.57 21.98 22 17.47 22 11.96 22 6.46 17.55 2 12.04 2Zm0 18.3c-1.54 0-3.05-.42-4.37-1.21l-.31-.18-3.11.74.75-3.03-.2-.32a8.28 8.28 0 0 1-1.27-4.4c0-4.57 3.73-8.3 8.32-8.3 2.21 0 4.29.86 5.86 2.43a8.24 8.24 0 0 1 2.43 5.88c-.02 4.58-3.75 8.39-8.1 8.39Zm4.55-6.23c-.25-.13-1.46-.72-1.69-.8-.23-.09-.4-.13-.57.13-.17.25-.65.8-.8.97-.15.17-.3.19-.55.06-1.5-.75-2.49-1.34-3.49-3.04-.26-.45.26-.42.74-1.39.08-.17.04-.31-.02-.44-.06-.13-.57-1.37-.78-1.88-.21-.5-.42-.43-.57-.44h-.49c-.17 0-.44.06-.67.31-.23.25-.88.86-.88 2.1 0 1.24.9 2.43 1.02 2.6.13.17 1.77 2.71 4.3 3.8 1.6.69 2.23.75 3.03.63.49-.07 1.46-.6 1.67-1.18.21-.58.21-1.08.15-1.18-.06-.1-.23-.16-.48-.29Z" /></svg>;
    default:
      return <svg aria-hidden="true" className="h-5 w-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M10 13a5 5 0 0 0 7.07 0l3-3A5 5 0 0 0 13 2.93l-1.72 1.72M14 11a5 5 0 0 0-7.07 0l-3 3A5 5 0 0 0 11 21.07l1.72-1.72" /></svg>;
  }
}

function getSocialLabel(platform) {
  return {
    facebook: "فيسبوك",
    instagram: "إنستغرام",
    tiktok: "تيك توك",
    youtube: "يوتيوب",
    whatsappchannel: "قناة أو مجموعة واتساب"
  }[platform.toLowerCase()] || "رابط تواصل";
}

export default function Storefront() {
  const { slug } = useParams();
  const { hash } = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const api = useApi();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [storeSearch, setStoreSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [canInstall, setCanInstall] = useState(false);
  const [showBrowserInstallGuidance, setShowBrowserInstallGuidance] = useState(false);
  const [phonesOpen, setPhonesOpen] = useState(false);
  const [whatsappOpen, setWhatsappOpen] = useState(false);
  const [cartMessage, setCartMessage] = useState("");
  const [cartItemCount, setCartItemCount] = useState(null);
  const [followerCount, setFollowerCount] = useState(0);
  const [following, setFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [followError, setFollowError] = useState("");
  const [storeNotificationSubscription, setStoreNotificationSubscription] = useState(null);
  const [storeNotificationLoading, setStoreNotificationLoading] = useState(false);
  const [storeNotificationSaving, setStoreNotificationSaving] = useState(false);
  const [storeNotificationError, setStoreNotificationError] = useState("");
  const page = Math.max(parseInt(searchParams.get("page") || "1", 10), 1);
  const productView = searchParams.get("view") === "discounts" ? "discounts" : "products";

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    api.get(`/stores/${encodeURIComponent(slug)}`, {
      params: {
        page,
        limit: 12,
        ...(productView === "discounts" ? { view: productView } : {}),
        ...(debouncedSearch ? { q: debouncedSearch } : {}),
        ...(selectedCategory !== "all" ? { categoryId: selectedCategory } : {})
      }
    })
      .then((response) => {
        if (!cancelled) setData(response.data);
      })
      .catch(() => {
        if (!cancelled) {
          setData(null);
          setError(true);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [api, slug, page, productView, debouncedSearch, selectedCategory, retryCount]);

  useEffect(() => {
    if (loading || hash !== "#products") return;
    const productsSection = document.getElementById("products");
    if (!productsSection) return;
    const frameId = requestAnimationFrame(() => {
      productsSection.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => cancelAnimationFrame(frameId);
  }, [loading, hash, data]);

  useEffect(() => {
    const storeId = data?.store?._id;
    if (!storeId) return;
    let cancelled = false;

    api.get(`/follows/store/${storeId}/count`)
      .then((response) => {
        if (!cancelled) setFollowerCount(Number(response.data?.count || 0));
      })
      .catch((error) => {
        if (!cancelled) {
          setFollowError("تعذر تحميل عدد المتابعين.");
          console.error("Store follower count error:", error);
        }
      });

    if (!user) {
      setFollowing(false);
      return () => { cancelled = true; };
    }

    api.get(`/follows/store/${storeId}/status`)
      .then((response) => {
        if (!cancelled) setFollowing(response.data?.following === true);
      })
      .catch((error) => {
        if (!cancelled) console.error("Store follow status error:", error);
      });

    return () => { cancelled = true; };
  }, [api, data?.store?._id, user]);

  useEffect(() => {
    let cancelled = false;
    const storeId = data?.store?._id;
    if (!storeId || !data?.store?.notificationsEnabled || !user) {
      setStoreNotificationSubscription(null);
      return () => { cancelled = true; };
    }
    setStoreNotificationLoading(true);
    api.get(`/stores/${storeId}/notifications/subscription`)
      .then((response) => {
        if (!cancelled) setStoreNotificationSubscription(response.data);
      })
      .catch((error) => {
        if (!cancelled) {
          setStoreNotificationError(error?.response?.data?.error || "تعذر تحميل تفضيلات إشعارات المتجر.");
        }
      })
      .finally(() => {
        if (!cancelled) setStoreNotificationLoading(false);
      });
    return () => { cancelled = true; };
  }, [api, data?.store?._id, data?.store?.notificationsEnabled, user]);

  useEffect(() => {
    const storeId = data?.store?._id;
    if (!storeId || data.store.analyticsEnabled !== true) return;
    if (!claimStoreAnalyticsView({ storeId })) return;
    api.post(`/stores/${storeId}/analytics/views`).catch((error) => {
      console.error("Store analytics tracking error:", error);
    });
  }, [api, data?.store?._id, data?.store?.analyticsEnabled]);

  useEffect(() => {
    setSelectedCategory("all");
  }, [slug]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(storeSearch.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [storeSearch]);

  const installTarget = data?.store?.pwaEnabled && data.store.slug ? `store:${data.store.slug}` : null;

  useEffect(() => {
    const updateInstallAvailability = (event) => {
      if (event.detail?.target === installTarget) setCanInstall(canInstallPWA(installTarget));
    };
    const handleInstalled = (event) => {
      if (event.detail?.target !== installTarget) return;
      setCanInstall(false);
      if (data.store.analyticsEnabled !== true) return;
      try {
        const installationId = getStorePwaInstallationId({ storeSlug: data.store.slug });
        api.post(`/stores/${data.store._id}/pwa-installs`, { installationId }).catch((error) => {
          console.error("Store PWA install tracking error:", error);
        });
      } catch (error) {
        console.error("Store PWA install tracking error:", error);
      }
    };

    setCanInstall(installTarget ? canInstallPWA(installTarget) : false);
    window.addEventListener("pwa:can-install", updateInstallAvailability);
    window.addEventListener("pwa:installed", handleInstalled);

    return () => {
      window.removeEventListener("pwa:can-install", updateInstallAvailability);
      window.removeEventListener("pwa:installed", handleInstalled);
    };
  }, [api, data?.store?._id, data?.store?.slug, installTarget]);

  useEffect(() => {
    setShowBrowserInstallGuidance(false);
    if (!data?.store || data.store.slug !== slug) return undefined;
    if (!installTarget) {
      setPWAInstallTarget("souqak");
      restoreGlobalManifest();
    } else {
      setPWAInstallTarget(installTarget);
      applyStoreManifest(data.store, api.defaults.baseURL);
      setCanInstall(canInstallPWA(installTarget));
    }

    return () => {
      setPWAInstallTarget("souqak");
      restoreGlobalManifest();
    };
  }, [data?.store, api, installTarget, slug]);

  const { store, ads = [], pages = 1 } = data || {};
  const image = store?.cover || store?.logo;
  const contact = store?.contact || {};
  const advancedCustomization = store?.advancedCustomizationEnabled ? store.advancedCustomization : null;
  const storefrontColor = advancedCustomization?.primaryColor || store?.primaryColor || "#0b89ed";
  const storefrontTextColor = getReadableTextColor(storefrontColor);
  const pageBackgroundColor = advancedCustomization?.pageBackgroundColor || "#f1f5f9";
  const storeInfoBackgroundColor = advancedCustomization?.storeInfoBackgroundColor || "#ffffff";
  const templateKey = store?.activity?.templateKey || GENERAL_STORE_TEMPLATE;
  const storeCategories = store?.selectedCategories || [];
  const categoryOptions = useMemo(() => storeCategories.map((category) => ({
    id: category?._id || category?.id,
    name: category?.name || "تصنيف",
    slug: category?.slug
  })).filter((category) => category.id), [storeCategories]);

  const resetStorePage = () => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.delete("page");
      return next;
    }, { replace: true });
  };

  const selectStoreCategory = (categoryId) => {
    setSelectedCategory((current) => categoryId !== "all" && current === categoryId ? "all" : categoryId);
    resetStorePage();
  };

  const updateStoreSearch = (value) => {
    setStoreSearch(value);
    resetStorePage();
  };

  const changeStorePage = (nextPage) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.set("page", String(nextPage));
      return next;
    });
  };

  const changeProductView = (nextView) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.delete("page");
      if (nextView === "discounts") next.set("view", nextView);
      else next.delete("view");
      return next;
    });
  };

  const listedContactPhones = contact.phones?.filter((item) => item?.value) || [];
  const contactPhones = listedContactPhones.length ? listedContactPhones : (contact.phone ? [{ value: contact.phone }] : []);
  const whatsappEntries = contact.whatsapp?.filter((item) => item?.value) || [];
  const whatsappContacts = whatsappEntries.length
    ? whatsappEntries
    : contact.primaryWhatsApp ? [{ value: contact.primaryWhatsApp }] : [];
  const whatsappLink = normalizeWhatsAppPhone(whatsappContacts[0]?.value);
  const statusLabel = store?.storeType === "family-production"
    ? (store?.status === "active" ? "مشروع نشط" : "حالة المشروع")
    : (store?.status === "active" ? "متجر نشط" : "حالة المتجر");
  const addToCart = async (product) => {
    setCartMessage("");
    try {
      const response = await api.post("/store-commerce/cart/items", { productId: product._id, quantity: 1 });
      if (Number.isSafeInteger(response.data?.itemCount)) setCartItemCount(response.data.itemCount);
      setCartMessage("تمت إضافة المنتج إلى السلة.");
    } catch (requestError) {
      setCartMessage(requestError.response?.data?.error || "تعذرت إضافة المنتج إلى السلة.");
    }
  };
  const toggleStoreFollow = async () => {
    if (!user) {
      navigate("/login", { state: { from: window.location.pathname } });
      return;
    }
    if (!store?._id || followLoading) return;
    setFollowLoading(true);
    setFollowError("");
    try {
      const response = await api.post(`/follows/store/${store._id}`);
      setFollowing(response.data?.following === true);
      setFollowerCount(Number(response.data?.count || 0));
    } catch (requestError) {
      setFollowError(requestError.response?.data?.error || "تعذرت متابعة هذا الحساب.");
    } finally {
      setFollowLoading(false);
    }
  };

  const toggleStoreNotifications = async () => {
    if (!store?._id || storeNotificationSaving) return;
    setStoreNotificationError("");
    if (!user) {
      navigate("/login");
      return;
    }
    setStoreNotificationSaving(true);
    try {
      if (storeNotificationSubscription?.enabled) {
        await api.delete(`/stores/${store._id}/notifications/subscription`);
        setStoreNotificationSubscription((current) => ({ ...current, enabled: false }));
      } else {
        let subscription = null;
        let pushUnavailableMessage = "";
        try {
          subscription = await subscribeToPush(api, { storeScoped: true });
        } catch (error) {
          console.error("Store Push subscription setup failed:", error);
          pushUnavailableMessage = "تعذر تفعيل إشعارات المتصفح؛ تمت متابعة المتجر داخل مركز الإشعارات فقط.";
        }
        if (!subscription) {
          pushUnavailableMessage = typeof Notification !== "undefined" && Notification.permission === "denied"
            ? "إذن المتصفح مرفوض؛ تمت متابعة المتجر داخل مركز الإشعارات فقط."
            : "إشعارات المتصفح غير متاحة؛ تمت متابعة المتجر داخل مركز الإشعارات فقط.";
        }
        const response = await api.put(`/stores/${store._id}/notifications/subscription`, {
          ...(subscription ? { subscription } : {}),
          orderNotifications: true,
          messageNotifications: true,
          marketingNotifications: true
        });
        setStoreNotificationSubscription({
          ...response.data,
          enabled: true
        });
        setStoreNotificationError(pushUnavailableMessage);
      }
    } catch (error) {
      setStoreNotificationError(error?.response?.data?.error || "تعذر تحديث اشتراك إشعارات المتجر.");
    } finally {
      setStoreNotificationSaving(false);
    }
  };

  if (loading) return (
    <main className="mx-auto max-w-7xl space-y-5 px-4 py-5 sm:px-6 sm:py-8" dir="rtl" aria-busy="true">
      <div className="ds-skeleton h-52 rounded-3xl sm:h-64" />
      <div className="ds-skeleton h-24 rounded-2xl" />
      <StoreLoadingCards count={4} />
    </main>
  );
  if (error || !data?.store) return (
    <main className="mx-auto max-w-xl px-4 py-12" dir="rtl">
      <section className="rounded-3xl border border-slate-200 bg-white p-7 text-center shadow-sm">
        <span aria-hidden="true" className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-xl text-slate-600">!</span>
        <h1 className="mt-4 text-xl font-black text-slate-950">تعذر فتح المتجر</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">قد يكون الرابط غير صحيح أو تعذر الاتصال مؤقتًا.</p>
        <button type="button" onClick={() => setRetryCount((count) => count + 1)} className="mt-5 min-h-11 rounded-xl bg-slate-950 px-5 text-sm font-extrabold text-white transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">إعادة المحاولة</button>
      </section>
    </main>
  );

  const handleInstallClick = async () => {
    if (!installTarget) return;
    if (canInstallPWA(installTarget)) {
      setShowBrowserInstallGuidance(false);
      await installPWA(installTarget);
      return;
    }
    if (isPWAStandalone()) setShowBrowserInstallGuidance(true);
  };

  return (
    <div
      className="mx-auto max-w-7xl space-y-6 px-3 py-4 sm:space-y-8 sm:px-6 sm:py-8"
      dir="rtl"
      style={advancedCustomization ? {
        backgroundColor: pageBackgroundColor,
        backgroundImage: `linear-gradient(${pageBackgroundColor}, ${pageBackgroundColor})`,
        backgroundSize: "100vw 100%",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat"
      } : undefined}
    >
      <PWAInstallPrompt store={store} apiBase={api.defaults.baseURL} />
      <SEO
        title={store.storeName}
        description={store.description || `${store.storeName}، ${store.businessActivity}`}
        image={image ? uploadsUrl(image) : undefined}
        url={`/store/${store.slug}`}
        canonicalUrl={`/store/${store.slug}`}
        type="collection"
      />

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className={`relative bg-slate-100 ${templateKey === "vehicle-dealer" ? "h-56 sm:h-72 lg:h-80" : templateKey === "furniture-store" ? "h-52 sm:h-64 lg:h-72" : "h-44 sm:h-60 lg:h-64"}`} style={!store.cover ? { backgroundColor: `${storefrontColor}22` } : undefined}>
          {store.cover && <img src={uploadsUrl(store.cover)} alt={`${store.storeName} - الغلاف`} className="h-full w-full object-cover" />}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-4 sm:p-7">
            <div className="flex items-end gap-3 text-white sm:gap-5">
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl border-2 border-white bg-white shadow-lg sm:h-20 sm:w-20">
                {store.logo ? <img src={uploadsUrl(store.logo)} alt={`شعار ${store.storeName}`} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-2xl font-black" style={{ color: storefrontColor }}>{store.storeName.charAt(0)}</div>}
              </div>
              <div className="min-w-0 flex-1 pb-0.5">
                <div className="mb-1 flex flex-wrap items-center gap-2 sm:gap-3">
                  <h1
                    className="text-xl font-black leading-tight sm:text-3xl"
                    style={{
                      ...(advancedCustomization ? { color: advancedCustomization.secondaryColor } : {}),
                      WebkitTextStroke: "1px #fff",
                      paintOrder: "stroke fill"
                    }}
                  >
                    {store.storeName}
                  </h1>
                  <span className="rounded-full border px-2.5 py-1 text-[10px] font-bold backdrop-blur-sm sm:text-xs" style={{ backgroundColor: storefrontColor + "33", borderColor: storefrontColor + "99" }}>{statusLabel}</span>
                </div>
                <p className="line-clamp-2 text-xs font-semibold text-white/90 sm:text-sm">{store.activity?.name || store.businessActivity}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4 border-t border-slate-100 p-4 sm:p-6" style={advancedCustomization ? { backgroundColor: storeInfoBackgroundColor, borderColor: `${storefrontColor}33` } : undefined}>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-600">
            {store.location && <div className="flex items-center gap-2 font-semibold">
              <svg className="h-4 w-4 shrink-0" style={{ color: storefrontColor }} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657 13.414 20.9a2 2 0 0 1-2.828 0l-4.243-4.243a8 8 0 1 1 11.314 0Z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></svg>
              <span>{store.location}</span>
            </div>}
            {store.description && <p className="w-full text-sm leading-6 text-slate-600 sm:text-base">{store.description}</p>}
          </div>
            <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4" style={advancedCustomization ? { borderColor: `${storefrontColor}33` } : undefined}>
              <div className="rounded-xl bg-slate-50 px-4 py-2 text-sm font-bold text-slate-700" style={advancedCustomization ? { backgroundColor: `${storefrontColor}12` } : undefined}>
                <span className="font-black text-emerald-700">{followerCount.toLocaleString("ar-EG")}</span>
                <span className="mr-1">متابع</span>
              </div>
              <button
                type="button"
                onClick={toggleStoreFollow}
                disabled={followLoading}
                aria-pressed={following}
                className={`min-h-11 rounded-xl px-5 py-2.5 text-sm font-black text-white transition-colors disabled:cursor-wait disabled:opacity-60 ${
                  following ? "bg-slate-600 hover:bg-slate-700" : advancedCustomization ? "" : "bg-emerald-700 hover:bg-emerald-800"
                }`}
                style={!following && advancedCustomization ? { backgroundColor: storefrontColor, color: storefrontTextColor } : undefined}
              >
                {followLoading ? "جارٍ التحديث..." : following ? "إلغاء المتابعة" : store.storeType === "family-production" ? "متابعة الأسرة المنتجة" : "متابعة المتجر"}
              </button>
              {followError && <p role="alert" className="w-full text-xs font-bold text-rose-700">{followError}</p>}
            </div>
            {store.notificationsEnabled && (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 sm:p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="flex items-center gap-2 text-sm font-black text-slate-800">
                      <svg aria-hidden="true" className="h-5 w-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17H9.143m10.286-2.25c-1.026-1.03-1.929-2.25-1.929-5.25a5.5 5.5 0 0 0-11 0c0 3-.903 4.22-1.929 5.25A1.5 1.5 0 0 0 5.634 17h12.732a1.5 1.5 0 0 0 1.063-2.25ZM9 17v.75a3 3 0 0 0 6 0V17" />
                      </svg>
                      إشعارات المتجر
                    </p>
                    <p className="mt-1 text-xs text-slate-500">اختر الاشتراك في تحديثات هذا المتجر فقط.</p>
                  </div>
                  <button
                    type="button"
                    onClick={toggleStoreNotifications}
                    disabled={storeNotificationLoading || storeNotificationSaving}
                    aria-pressed={storeNotificationSubscription?.enabled === true}
                    className="min-h-11 rounded-xl px-4 py-2 text-sm font-black text-white disabled:opacity-60"
                    style={{ backgroundColor: storefrontColor }}
                  >
                    {storeNotificationLoading ? "جارٍ التحميل..." : storeNotificationSaving
                      ? "جارٍ الحفظ..."
                      : storeNotificationSubscription?.enabled ? "إلغاء الاشتراك" : user ? "تفعيل إشعارات المتجر" : "سجّل الدخول للاشتراك"}
                  </button>
                </div>
                {storeNotificationError && <p role="alert" className="mt-2 text-xs font-bold text-rose-700">{storeNotificationError}</p>}
              </div>
            )}
            {store.cartEnabled && (
            !store.ordersEnabled && <p className="text-xs font-bold text-amber-700">إرسال الطلبات غير متاح في خطة المتجر.</p>
          )}

          {(contactPhones.length > 0 || whatsappContacts.length > 0 || contact.email || contact.mapsUrl || Object.values(store.social || {}).some(Boolean) || (canInstall && store.pwaEnabled)) && (
            <div id="store-contact" className="scroll-mt-6 border-t border-slate-100 pt-4 sm:flex sm:flex-wrap sm:items-center sm:gap-x-3 sm:gap-y-2" style={advancedCustomization ? { borderColor: `${storefrontColor}33` } : undefined}>
              <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-3">
                {contactPhones.length === 1 && <a href={`tel:${contactPhones[0].value}`} className="flex min-h-11 items-center justify-center rounded-xl px-4 py-2.5 text-sm font-bold transition-opacity hover:opacity-90" style={{ backgroundColor: storefrontColor, color: storefrontTextColor }}>اتصل</a>}
                {contactPhones.length > 1 && <button type="button" aria-expanded={phonesOpen} onClick={() => { setPhonesOpen((open) => !open); setWhatsappOpen(false); }} className="min-h-11 rounded-xl px-4 py-2.5 text-sm font-bold transition-opacity hover:opacity-90" style={{ backgroundColor: storefrontColor, color: storefrontTextColor }}>اتصل</button>}

                {whatsappContacts.length === 1 && whatsappLink && <a href={whatsappLink} target="_blank" rel="noreferrer" className="flex min-h-11 items-center justify-center rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-emerald-700">واتساب</a>}
                {whatsappContacts.length > 1 && <button type="button" aria-expanded={whatsappOpen} onClick={() => { setWhatsappOpen((open) => !open); setPhonesOpen(false); }} className="min-h-11 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-emerald-700">واتساب</button>}

                {contact.email && <a href={`mailto:${contact.email}`} className="flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50" style={advancedCustomization ? { backgroundColor: storeInfoBackgroundColor, borderColor: `${storefrontColor}55` } : undefined}>مراسلة</a>}
                {contact.mapsUrl && <a href={contact.mapsUrl} target="_blank" rel="noreferrer" className="flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50" style={advancedCustomization ? { backgroundColor: storeInfoBackgroundColor, borderColor: `${storefrontColor}55` } : undefined}>الموقع</a>}
              </div>
              {Object.values(store.social || {}).some(Boolean) && (
                <div className="mt-2 flex flex-nowrap items-center justify-center gap-2 sm:mr-auto sm:mt-0">
                  {Object.entries(store.social || {}).filter(([, url]) => url).map(([platform, url]) => (
                    <a key={platform} href={url} target="_blank" rel="noopener noreferrer" aria-label={getSocialLabel(platform)} title={getSocialLabel(platform)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white transition-colors hover:bg-slate-50" style={advancedCustomization ? { backgroundColor: storeInfoBackgroundColor, borderColor: `${storefrontColor}55` } : undefined}>
                      <StoreSocialIcon platform={platform} />
                    </a>
                  ))}
                </div>
              )}
              {(canInstall || isPWAStandalone()) && store.pwaEnabled && <div className="mt-2 flex flex-col items-center gap-2 sm:basis-full">
                <button type="button" onClick={handleInstallClick} className="min-h-11 w-full max-w-48 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50">تثبيت المتجر</button>
                {showBrowserInstallGuidance && <div role="status" className="w-full max-w-md rounded-xl border border-blue-100 bg-blue-50 p-3 text-right text-xs leading-6 text-slate-700">
                  <p className="font-bold">لتثبيت تطبيق {store.storeName || "المتجر"} بشكل مستقل، افتح رابط المتجر في Chrome أو Safari ثم اختر «إضافة إلى الشاشة الرئيسية».</p>
                  <label className="mt-2 block font-semibold" htmlFor="store-install-url">انسخ رابط صفحة المتجر وافتحه في المتصفح:</label>
                  <input id="store-install-url" readOnly value={window.location.href} onFocus={(event) => event.currentTarget.select()} dir="ltr" className="mt-1 min-h-10 w-full rounded-lg border border-blue-200 bg-white px-2 text-left text-xs" />
                  <button type="button" onClick={() => setShowBrowserInstallGuidance(false)} className="mt-2 font-bold text-blue-700">إغلاق</button>
                </div>}
              </div>}

              {phonesOpen && contactPhones.length > 1 && <div className="mt-3 grid gap-2 rounded-2xl bg-slate-50 p-3 sm:grid-cols-2">
                {contactPhones.map((item, index) => <a key={`phone-${index}`} href={`tel:${item.value}`} className="flex min-h-11 items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700" dir="rtl"><span>رقم اتصال {index + 1}</span><span dir="ltr" className="font-bold">{item.value}</span></a>)}
              </div>}

              {whatsappOpen && whatsappContacts.length > 1 && <div className="mt-3 grid gap-2 rounded-2xl bg-emerald-50 p-3 sm:grid-cols-2">
                {whatsappContacts.map((item, index) => {
                  const itemLink = normalizeWhatsAppPhone(item.value);
                  return itemLink && <a key={`whatsapp-${index}`} href={itemLink} target="_blank" rel="noreferrer" className="flex min-h-11 items-center justify-between rounded-xl border border-emerald-100 bg-white px-3 py-2 text-sm font-semibold text-slate-700" dir="rtl"><span>واتساب</span><span dir="ltr" className="font-bold">{item.value}</span></a>;
                })}
              </div>}
            </div>
          )}
        </div>
      </section>

      <StoreTemplateRenderer
        store={store}
        ads={ads}
        total={data?.total || 0}
        pages={pages}
        page={page}
        productView={productView}
        categoryOptions={categoryOptions}
        selectedCategory={selectedCategory}
        storeSearch={storeSearch}
        templateKey={templateKey}
        storefrontColor={storefrontColor}
        storefrontTextColor={storefrontTextColor}
        onSelectCategory={selectStoreCategory}
        onSearchChange={updateStoreSearch}
        onPageChange={changeStorePage}
        onProductViewChange={changeProductView}
        onAddToCart={store.cartEnabled ? addToCart : null}
      />
      {store.cartEnabled && (
        <div className="fixed bottom-20 left-5 z-[60] flex flex-col items-start gap-2 md:bottom-5">
          {cartMessage && <span role="status" className="max-w-64 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-lg">{cartMessage}</span>}
          <button
            type="button"
            onClick={() => navigate("/cart")}
            aria-label={`فتح سلة المتجر${cartItemCount ? `، ${cartItemCount} منتجات` : ""}`}
            className="relative flex min-h-12 items-center gap-2 rounded-full bg-blue-600 px-4 py-3 text-sm font-black text-white shadow-lg transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-200"
          >
            <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l2.2 11.2a2 2 0 0 0 2 1.6h8.9a2 2 0 0 0 2-1.6L22 8H6" />
              <circle cx="10" cy="20" r="1" fill="currentColor" />
              <circle cx="18" cy="20" r="1" fill="currentColor" />
            </svg>
            <span>سلة المتجر</span>
            {cartItemCount > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-[10px] font-black text-blue-700">{cartItemCount}</span>}
          </button>
        </div>
      )}
    </div>
  );
}
