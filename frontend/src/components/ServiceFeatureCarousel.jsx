import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { getServicePageBanner, SERVICE_FEATURE_BANNERS } from "../lib/serviceFeatureBanners.js";

function ServiceIllustration({ id, className = "" }) {
  if (id === "secure-deal") {
    return <img src="/Amana-Logo.svg" alt="أمانة" className={`rounded-2xl bg-white/90 p-3 object-contain shadow-xl ${className}`} />;
  }
  if (id === "wallet-services") {
    return <img src="/tmam-full-logo.png" alt="تمام باي Tmam Pay" className={`rounded-2xl bg-white/95 p-3 object-contain shadow-xl ${className}`} />;
  }

  const renderArtwork = () => {
    switch (id) {
      case "promotion":
        return (
          <>
            <rect x="54" y="43" width="112" height="82" rx="12" fill="white" />
            <rect x="65" y="54" width="90" height="12" rx="6" fill="#bfdbfe" />
            <rect x="65" y="75" width="52" height="39" rx="7" fill="#dbeafe" />
            <path d="M76 102 89 88l10 9 11-14" fill="none" stroke="#2563eb" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
            <rect x="124" y="78" width="31" height="7" rx="3.5" fill="#818cf8" />
            <rect x="124" y="92" width="24" height="7" rx="3.5" fill="#c4b5fd" />
            <path d="m161 38 5 12 12 5-12 5-5 12-5-12-12-5 12-5z" fill="#fde68a" />
          </>
        );
      case "secure-deal":
        return null;
      case "store":
        return (
          <>
            <path d="M58 78h104v65H58z" fill="white" />
            <path d="m49 78 13-32h96l13 32z" fill="#ffedd5" />
            <path d="M54 77h112c0 14-12 21-23 12-10 10-22 10-33 0-11 10-23 10-33 0-11 9-23 2-23-12z" fill="#fb923c" />
            <rect x="72" y="101" width="28" height="42" rx="4" fill="#fed7aa" />
            <rect x="112" y="99" width="36" height="25" rx="4" fill="#ffedd5" />
            <path d="M119 119V108h22v11" fill="none" stroke="#ea580c" strokeWidth="4" />
          </>
        );
      case "family-production":
        return (
          <>
            <path d="M73 78h74l-8 64H81z" fill="white" />
            <path d="M81 91h58l-6 42H87z" fill="#f5d0fe" />
            <path d="M89 78c0-13 8-23 21-23s21 10 21 23" fill="none" stroke="white" strokeWidth="8" strokeLinecap="round" />
            <path d="M109 112c-19-1-27-14-23-29 16 1 26 10 23 29zm3 0c1-20 13-29 28-27 0 16-10 27-28 27z" fill="#c084fc" />
            <path d="M110 116v15" stroke="#7e22ce" strokeWidth="4" strokeLinecap="round" />
          </>
        );
      case "wallet-services":
        return (
          <>
            <rect x="55" y="48" width="110" height="91" rx="12" fill="white" />
            <rect x="66" y="61" width="88" height="19" rx="5" fill="#cffafe" />
            <rect x="66" y="91" width="54" height="37" rx="6" fill="#e0f2fe" />
            <path d="M79 116V104h28v12" fill="none" stroke="#0284c7" strokeWidth="5" />
            <rect x="128" y="93" width="26" height="8" rx="4" fill="#38bdf8" />
            <rect x="128" y="108" width="20" height="8" rx="4" fill="#bae6fd" />
            <circle cx="145" cy="70" r="5" fill="#0284c7" />
          </>
        );
      case "verification":
        return (
          <>
            <rect x="49" y="48" width="119" height="83" rx="12" fill="white" />
            <rect x="62" y="64" width="31" height="37" rx="7" fill="#dbeafe" />
            <circle cx="77.5" cy="76" r="7" fill="#60a5fa" />
            <path d="M67 94c2-9 19-9 21 0" fill="none" stroke="#2563eb" strokeWidth="4" strokeLinecap="round" />
            <rect x="104" y="66" width="49" height="7" rx="3.5" fill="#93c5fd" />
            <rect x="104" y="81" width="40" height="6" rx="3" fill="#dbeafe" />
            <rect x="104" y="94" width="31" height="6" rx="3" fill="#dbeafe" />
            <circle cx="150" cy="119" r="21" fill="#bfdbfe" />
            <path d="m140 119 7 7 14-16" fill="none" stroke="#1d4ed8" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
          </>
        );
      case "seller-services":
        return (
          <>
            <rect x="48" y="42" width="125" height="94" rx="12" fill="white" />
            <rect x="48" y="42" width="125" height="19" rx="12" fill="#dbeafe" />
            <circle cx="61" cy="51.5" r="3" fill="#60a5fa" />
            <circle cx="72" cy="51.5" r="3" fill="#818cf8" />
            <rect x="61" y="73" width="30" height="48" rx="6" fill="#bfdbfe" />
            <rect x="101" y="73" width="59" height="19" rx="5" fill="#e0e7ff" />
            <rect x="101" y="101" width="25" height="20" rx="5" fill="#c4b5fd" />
            <rect x="135" y="101" width="25" height="20" rx="5" fill="#a5b4fc" />
          </>
        );
      case "wallet":
        return (
          <>
            <rect x="52" y="58" width="114" height="77" rx="13" fill="white" />
            <path d="M52 75h114v47H52z" fill="#d1fae5" />
            <path d="M52 76c0-10 8-18 18-18h72c9 0 17 6 20 14H75c-10 0-18 2-23 4z" fill="#a7f3d0" />
            <path d="M127 91h39v27h-39c-8 0-13-5-13-13s5-14 13-14z" fill="#10b981" />
            <circle cx="132" cy="105" r="4" fill="white" />
            <circle cx="77" cy="103" r="15" fill="#6ee7b7" />
            <path d="M77 94v18m-6-13c0-4 12-4 12 0s-12 3-12 8 12 4 12 0" fill="none" stroke="#047857" strokeWidth="2.5" strokeLinecap="round" />
          </>
        );
      case "referrals":
        return (
          <>
            <circle cx="82" cy="72" r="19" fill="white" />
            <circle cx="143" cy="72" r="19" fill="#ede9fe" />
            <circle cx="112" cy="126" r="19" fill="#f5d0fe" />
            <path d="M98 77h26M91 91l13 20m22-20-13 20" stroke="white" strokeWidth="7" strokeLinecap="round" />
            <circle cx="82" cy="69" r="7" fill="#7c3aed" />
            <path d="M70 85c2-10 22-10 24 0" fill="none" stroke="#7c3aed" strokeWidth="5" strokeLinecap="round" />
            <circle cx="143" cy="69" r="7" fill="#a21caf" />
            <path d="M131 85c2-10 22-10 24 0" fill="none" stroke="#a21caf" strokeWidth="5" strokeLinecap="round" />
            <circle cx="112" cy="123" r="7" fill="#c026d3" />
            <path d="M100 139c2-10 22-10 24 0" fill="none" stroke="#c026d3" strokeWidth="5" strokeLinecap="round" />
          </>
        );
      case "auctions":
        return (
          <>
            <path d="m75 49 47 47m-57-37 17-17 17 17-17 17zm42 42 17-17 17 17-17 17z" fill="white" stroke="#ffedd5" strokeWidth="5" strokeLinejoin="round" />
            <path d="m119 113 24-24m-11 35 24-24" stroke="#fff7ed" strokeWidth="8" strokeLinecap="round" />
            <path d="M68 136h88" stroke="white" strokeWidth="8" strokeLinecap="round" />
            <circle cx="160" cy="53" r="15" fill="#fde68a" />
            <path d="M160 44v18m-6-13c0-4 12-4 12 0s-12 3-12 8 12 4 12 0" fill="none" stroke="#c2410c" strokeWidth="2.5" strokeLinecap="round" />
          </>
        );
      case "quote-requests":
        return (
          <>
            <rect x="58" y="43" width="104" height="104" rx="13" fill="white" />
            <rect x="72" y="58" width="76" height="16" rx="5" fill="#dbeafe" />
            <rect x="72" y="84" width="32" height="48" rx="6" fill="#c7d2fe" />
            <rect x="112" y="84" width="36" height="48" rx="6" fill="#a5f3fc" />
            <path d="M81 96h14m-14 11h14m-14 11h9m15-22h20m-20 11h20m-20 11h15" stroke="#4f46e5" strokeWidth="4" strokeLinecap="round" />
            <circle cx="151" cy="43" r="14" fill="#fde68a" />
            <path d="M151 35v16m-5-12c0-3 10-3 10 0s-10 3-10 7 10 3 10 0" fill="none" stroke="#4338ca" strokeWidth="2.3" strokeLinecap="round" />
          </>
        );
      default:
        return (
          <>
            <rect x="53" y="45" width="114" height="87" rx="12" fill="white" />
            <path d="M71 109 94 85l17 15 31-36" fill="none" stroke="#60a5fa" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="151" cy="50" r="10" fill="#fde68a" />
          </>
        );
    }
  };

  return (
    <svg aria-hidden="true" viewBox="0 0 220 180" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="110" cy="151" rx="72" ry="12" fill="#0f172a" fillOpacity=".18" />
      <circle cx="110" cy="91" r="72" fill="white" fillOpacity=".08" />
      <circle cx="110" cy="91" r="62" stroke="white" strokeOpacity=".22" strokeDasharray="4 7" strokeWidth="2" />
      {renderArtwork()}
      <circle cx="48" cy="55" r="6" fill="white" fillOpacity=".75" />
      <circle cx="170" cy="128" r="8" fill="white" fillOpacity=".4" />
    </svg>
  );
}

function ServiceFeatureBanner({ banner, className }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const slides = banner.details.slice(0, 3);

  useEffect(() => {
    setActiveIndex(0);
  }, [banner.id]);

  useEffect(() => {
    if (paused || slides.length < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % slides.length);
    }, 3000);
    return () => window.clearInterval(timer);
  }, [paused, slides.length]);

  const changeSlide = (offset) => {
    setActiveIndex((current) => (current + offset + slides.length) % slides.length);
  };

  return (
    <section
      aria-labelledby={`service-banner-${banner.id}`}
      className={`relative isolate overflow-hidden rounded-2xl bg-gradient-to-l ${banner.theme} p-3 text-white shadow-lg shadow-slate-900/10 sm:rounded-3xl sm:p-6 sm:shadow-xl lg:p-7 ${className}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false);
      }}
    >
      <div aria-hidden="true" className={`absolute -left-12 -top-16 h-48 w-48 rounded-full blur-3xl ${banner.glow}`} />
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_15%_100%,rgba(255,255,255,0.2),transparent_48%)]" />

      <div className="relative flex items-center gap-3 sm:min-h-36 sm:gap-6 lg:min-h-40">
        <div className="min-w-0 flex-1">
          <p className="mb-1 inline-flex max-w-full items-center rounded-full border border-white/25 bg-white/10 px-2 py-0.5 text-[8px] font-black text-white/90 backdrop-blur-sm sm:mb-2 sm:px-3 sm:py-1 sm:text-xs">
            <span>{banner.id === "secure-deal" ? "الشراء الآمن عبر أمانة" : banner.id === "wallet-services" ? "شريك مستقل: تمام باي" : "خدمة من سوقك"}</span>
          </p>
          <h2 id={`service-banner-${banner.id}`} className="break-words text-sm font-black leading-5 drop-shadow-sm sm:text-3xl sm:leading-10">
            {banner.detailHeading}
          </h2>
          <div className="mt-2 min-h-10 sm:mt-3 sm:min-h-14" aria-live="polite" aria-atomic="true">
            <p className="text-xs font-semibold leading-5 text-white/95 sm:text-base sm:leading-7">
              <span className="me-1 text-white/70">{activeIndex + 1}.</span>
              {slides[activeIndex]}
            </p>
          </div>
          <div className="mt-2 flex items-center justify-between gap-2 sm:mt-4">
            <a
              href="#service-page-content"
              className="inline-flex min-h-8 items-center gap-1.5 rounded-full bg-white px-3 py-1 text-[10px] font-black text-slate-900 shadow-lg transition hover:-translate-y-0.5 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-slate-800 sm:min-h-11 sm:gap-2 sm:px-5 sm:py-2.5 sm:text-sm"
            >
              {banner.action}
              <span aria-hidden="true">←</span>
            </a>
            <div className="flex shrink-0 items-center gap-1.5" role="group" aria-label={`شرائح ${banner.detailHeading}`}>
              <button type="button" onClick={() => changeSlide(-1)} aria-label="الشريحة السابقة" className="flex h-7 w-7 items-center justify-center rounded-full border border-white/30 bg-white/10 text-xs transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white sm:h-9 sm:w-9">›</button>
              <div className="flex items-center gap-1" aria-label={`الشريحة ${activeIndex + 1} من ${slides.length}`}>
                {slides.map((slide, index) => (
                  <button
                    key={`${banner.id}-${index}`}
                    type="button"
                    onClick={() => setActiveIndex(index)}
                    aria-label={`عرض الشريحة ${index + 1}`}
                    aria-current={index === activeIndex ? "true" : undefined}
                    className={`h-1.5 rounded-full transition-all ${index === activeIndex ? "w-4 bg-white" : "w-1.5 bg-white/50 hover:bg-white/80"}`}
                  />
                ))}
              </div>
              <button type="button" onClick={() => changeSlide(1)} aria-label="الشريحة التالية" className="flex h-7 w-7 items-center justify-center rounded-full border border-white/30 bg-white/10 text-xs transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white sm:h-9 sm:w-9">‹</button>
            </div>
          </div>
        </div>

        <ServiceIllustration id={banner.id} className="hidden h-16 w-20 shrink-0 drop-shadow-xl sm:block sm:h-40 sm:w-52" />
      </div>
    </section>
  );
}

export default function ServiceFeatureCarousel({ className = "", variant = "carousel" }) {
  const { pathname } = useLocation();
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const serviceBanner = getServicePageBanner(pathname);
  const banners = useMemo(
    () => SERVICE_FEATURE_BANNERS.filter((banner) => banner.to !== pathname),
    [pathname]
  );

  useEffect(() => {
    setActiveIndex(0);
  }, [pathname]);

  useEffect(() => {
    if (variant !== "carousel") return undefined;
    if (paused || banners.length < 2) return undefined;
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % banners.length);
    }, 4500);
    return () => window.clearInterval(timer);
  }, [banners.length, paused, variant]);

  if (variant === "service") {
    return serviceBanner ? <ServiceFeatureBanner banner={serviceBanner} className={className} /> : null;
  }
  if (!banners.length) return null;
  const activeBanner = banners[activeIndex % banners.length];
  const changeBanner = (offset) => {
    setActiveIndex((current) => (current + offset + banners.length) % banners.length);
  };

  return (
    <section
      aria-label="اكتشف خدمات سوقك"
      aria-roledescription="عارض بانرات"
      className={`relative isolate overflow-hidden rounded-2xl bg-gradient-to-l ${activeBanner.theme} p-2.5 text-white shadow-lg shadow-slate-900/10 transition-colors duration-500 sm:rounded-3xl sm:p-5 sm:shadow-xl lg:p-6 ${className}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false);
      }}
    >
      <div aria-hidden="true" className={`absolute -left-10 -top-16 h-48 w-48 rounded-full blur-3xl ${activeBanner.glow}`} />
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_15%_100%,rgba(255,255,255,0.2),transparent_48%)]" />

      <div className="relative flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-5">
        <ServiceIllustration id={activeBanner.id} className="hidden h-28 w-36 shrink-0 drop-shadow-xl sm:block" />

        <div className="min-w-0 flex-1" aria-live="polite" aria-atomic="true">
          <p className="mb-0.5 hidden text-xs font-black tracking-wide text-white/75 sm:block sm:mb-1">اكتشف من خدمات سوقك</p>
          <h2 className="break-words text-sm font-black leading-5 sm:text-2xl sm:leading-8">{activeBanner.title}</h2>
          <p className="mt-0.5 break-words text-[11px] font-medium leading-4 text-white/90 sm:mt-1 sm:text-sm sm:leading-6">{activeBanner.description}</p>
          <div className="mt-1.5 flex items-center justify-between gap-2 sm:mt-3">
            <Link to={activeBanner.to} className="inline-flex min-h-8 items-center justify-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[11px] font-black text-slate-900 shadow-md transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-white sm:min-h-10 sm:gap-2 sm:px-4 sm:py-2 sm:text-sm">
              {activeBanner.action}<span aria-hidden="true">←</span>
            </Link>

            <div className="flex shrink-0 items-center justify-center gap-1 sm:gap-2" aria-label={`البانر ${activeIndex + 1} من ${banners.length}`}>
              <button type="button" onClick={() => changeBanner(-1)} aria-label="البانر السابق" className="flex h-6 w-6 items-center justify-center rounded-full border border-white/25 bg-white/10 text-[10px] font-black transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white sm:h-8 sm:w-8 sm:text-sm">
                ›
              </button>
              <div className="flex items-center gap-1">
                {banners.map((banner, index) => (
                  <button
                    key={banner.id}
                    type="button"
                    onClick={() => setActiveIndex(index)}
                    aria-label={`عرض بانر: ${banner.title}`}
                    aria-current={index === activeIndex ? "true" : undefined}
                    className={`h-1.5 rounded-full transition-all sm:h-2 ${index === activeIndex ? "w-4 bg-white sm:w-6" : "w-1.5 bg-white/50 hover:bg-white/80 sm:w-2"}`}
                  />
                ))}
              </div>
              <button type="button" onClick={() => changeBanner(1)} aria-label="البانر التالي" className="flex h-6 w-6 items-center justify-center rounded-full border border-white/25 bg-white/10 text-[10px] font-black transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white sm:h-8 sm:w-8 sm:text-sm">
                ‹
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
