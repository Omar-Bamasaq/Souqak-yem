import { useEffect } from "react";
import { Link } from "react-router-dom";
import { t } from "../i18n/index.js";

export const platformFeatureSections = [
  {
    title: "الإعلانات واكتشاف المنتجات",
    features: [
      { key: "createListing", icon: "ads", to: "/add-product" },
      { key: "manageListings", icon: "ads", to: "/my-ads" },
      { key: "manualReview", icon: "review", to: "/how-it-works" },
      { key: "productSearch", icon: "search", to: "/search" },
      { key: "browseCategories", icon: "categories", to: "/categories" },
      { key: "searchByLocation", icon: "location", to: "/search" },
      { key: "saveFavorites", icon: "heart", to: "/favorites" },
      { key: "followSellers", icon: "share", to: "/following" }
    ]
  },
  {
    title: "الشراء والتواصل",
    features: [
      { key: "safePurchase", icon: "shield", to: "/secure-deal-explanation" },
      { key: "contactSellers", icon: "chat", to: "/messages" },
      { key: "storeCart", icon: "cart", to: "/cart" },
      { key: "wallet", icon: "wallet", to: "/wallet" },
      { key: "instantNotifications", icon: "bell", to: "/notifications" }
    ]
  },
  {
    title: "الخدمات والفرص",
    features: [
      { key: "bookingServices", icon: "service", to: "/bookings" },
      { key: "digitalPaymentServices", icon: "wallet", to: "/wallet-services" },
      { key: "quoteRequests", icon: "quote", to: "/quote-requests" },
      { key: "auctions", icon: "auction", to: "/auctions" },
      { key: "featuredAds", icon: "star", to: "/seller/featured-ad" },
      { key: "sellerSubscriptions", icon: "plans", to: "/seller/subscriptions" }
    ]
  },
  {
    title: "المتاجر والأسر المنتجة",
    features: [
      { key: "browseStores", icon: "store", to: "/stores" },
      { key: "familyProduction", icon: "family", to: "/family-production" },
      { key: "createStore", icon: "store", to: "/seller/store/create" },
      { key: "storeCart", icon: "cart", to: "/cart" }
    ]
  },
  {
    title: "الحساب والثقة",
    features: [
      { key: "verifiedSellers", icon: "badge", to: "/seller/verification" },
      { key: "platformReviews", icon: "star", to: "/platform-reviews" },
      { key: "referrals", icon: "share", to: "/referrals" }
    ]
  }
];

export const platformFeatures = platformFeatureSections.flatMap((section) => section.features);

const icons = {
  cart: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />,
  shield: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3 5 6v5c0 4.5 2.9 8 7 10 4.1-2 7-5.5 7-10V6l-7-3zm-3 8 2 2 4-4" />,
  chat: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />,
  ads: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />,
  search: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m21 21-4.35-4.35M19 10.5a8.5 8.5 0 1 1-17 0 8.5 8.5 0 0 1 17 0Z" />,
  categories: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" />,
  review: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />,
  star: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />,
  badge: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />,
  bell: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />,
  location: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />,
  heart: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />,
  wallet: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6.5A2.5 2.5 0 016.5 4H19v4H6.5A2.5 2.5 0 014 5.5m0 1v11A2.5 2.5 0 006.5 20H20V8H6.5A2.5 2.5 0 014 6.5ZM16 14h.01" />,
  service: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM8 3 6 5m10-2 2 2" />,
  quote: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />,
  auction: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m14 6 4 4m-7-7 7 7M3 21l10-10m-5-5 6 6m-2 8h9" />,
  store: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18l-2-6H5l-2 6Zm2 0v10h14V10M9 20v-6h6v6M3 10a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0" />,
  family: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m7-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm7-7.5a4 4 0 0 1 0 7.75M22 21v-2a4 4 0 0 0-3-3.87" />,
  plans: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3z" />,
  share: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 8a3 3 0 1 0-2.83-4M9 12l6-3m-6 3 6 3m3 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM6 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z" />
};

export function FeatureIcon({ name, className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      {icons[name]}
    </svg>
  );
}

export function PlatformFeaturesModal({ onClose }) {
  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-slate-950/60 p-0 backdrop-blur-sm sm:p-4"
      onClick={onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="platform-features-title"
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[28px] bg-white text-right shadow-2xl dark:bg-slate-900 sm:rounded-3xl"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="relative shrink-0 overflow-hidden bg-gradient-to-l from-blue-700 via-blue-600 to-indigo-600 px-5 pb-5 pt-6 text-white sm:px-7 sm:pt-7">
          <div className="absolute -left-10 -top-16 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
          <div className="relative flex items-start justify-between gap-4">
            <div>
              <p className="mb-1 text-xs font-bold text-blue-100">سوقك • منصة الإعلانات المحلية</p>
              <h2 id="platform-features-title" className="text-xl font-black sm:text-2xl">
                {t("login.featuresTitle")}
              </h2>
              <p className="mt-1.5 text-sm leading-6 text-blue-50/90">
                تصفّح الإعلانات والخدمات والمتاجر، وانتقل مباشرة إلى ما تحتاجه.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="إغلاق نافذة الميزات"
              className="rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/80"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="relative mt-4 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-bold text-white">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
            {platformFeatures.length} ميزة وخدمة
          </div>
        </header>

        <div className="custom-scrollbar overflow-y-auto p-4 sm:p-6">
          <div className="space-y-7">
            {platformFeatureSections.map((section) => (
              <section key={section.title}>
                <h3 className="mb-3 border-r-4 border-blue-500 pr-3 text-sm font-black text-slate-800 dark:text-slate-100">
                  {section.title}
                </h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {section.features.map((feature) => (
                    <Link
                      key={feature.key}
                      to={feature.to}
                      onClick={onClose}
                      className="group flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50/80 p-4 transition hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50/60 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-800 dark:bg-slate-800/60 dark:hover:border-blue-900 dark:hover:bg-slate-800"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700 transition group-hover:bg-blue-600 group-hover:text-white dark:bg-blue-900/50 dark:text-blue-300">
                        <FeatureIcon name={feature.icon} className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="mb-1 text-sm font-extrabold text-slate-900 dark:text-slate-100">
                          {t(`login.features.${feature.key}.title`)}
                        </h4>
                        <p className="text-xs leading-5 text-slate-600 dark:text-slate-300">
                          {t(`login.features.${feature.key}.desc`)}
                        </p>
                      </div>
                      <span aria-hidden="true" className="mt-1 text-slate-400 transition group-hover:-translate-x-0.5 group-hover:text-blue-600">←</span>
                    </Link>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>

        <footer className="shrink-0 border-t border-slate-100 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:px-6">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl bg-blue-600 py-3 text-sm font-bold text-white transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
          >
            إغلاق
          </button>
        </footer>
      </section>
    </div>
  );
}
