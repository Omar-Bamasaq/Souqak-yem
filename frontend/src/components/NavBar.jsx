import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../store/AuthContext.jsx";
import { t } from "../i18n/index.js";
import Logo from "./Logo.jsx";
import { useChat } from "../store/ChatContext.jsx";
import { useApi } from "../api/axios.js";
import AdvancedSearchModal from "./AdvancedSearchModal.jsx";
import MobileSelect from "./MobileSelect.jsx";
import UserNotificationBell from "./UserNotificationBell.jsx";
import PWAInstallButton from "./PWAInstallButton.jsx";
import { useTheme } from "../store/ThemeContext";
import { useBrokerageStatus } from "../store/BrokerageStatusContext";
import { uploadsUrl } from "../lib/uploads.js";
import { useGovernorates } from "../hooks/useGovernorates.js";
import { getNotificationRequest } from "../api/notificationRequests.js";

export default function NavBar() {
  const { user, logout } = useAuth();
  const isAdminAccount = ["admin", "supervisor"].includes(user?.role);
  const { unread } = useChat();
  const { enabled: brokerageEnabled } = useBrokerageStatus();
  const [open, setOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [q, setQ] = useState("");
  const [showMobileSearchSuggestions, setShowMobileSearchSuggestions] = useState(false);
  const [governorateId, setGovernorateId] = useState("");
  const { data: governorates = [] } = useGovernorates();
  const [unreadNotif, setUnreadNotif] = useState(0);
  const [favCount, setFavCount] = useState(0);
  const [activeConvId, setActiveConvId] = useState("");
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const [mobileSuggestionsPosition, setMobileSuggestionsPosition] = useState({ top: 0, left: 0 });
  const [myStore, setMyStore] = useState(null);
  const [myFamilyProduction, setMyFamilyProduction] = useState(null);
  const api = useApi();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const dropdownRef = React.useRef(null);
  const accountMenuRef = React.useRef(null);
  const mobileSearchButtonRef = React.useRef(null);
  const mobileSuggestionsRef = React.useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (user) setOpen(false);
  }, [user]);

  useEffect(() => {
    const openAccountMenu = () => setAccountMenuOpen(true);
    window.addEventListener("account-menu:open", openAccountMenu);
    return () => window.removeEventListener("account-menu:open", openAccountMenu);
  }, []);

  useEffect(() => {
    setAccountMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!accountMenuOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement;
    document.body.style.overflow = "hidden";
    const getFocusableElements = () => Array.from(
      accountMenuRef.current?.querySelectorAll('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])') || []
    );
    getFocusableElements()[0]?.focus();
    const closeOnEscape = (event) => {
      if (event.key === "Escape") {
        setAccountMenuOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const focusableElements = getFocusableElements();
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      if (!firstElement || !lastElement) return;
      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, [accountMenuOpen]);

  useEffect(() => {
    if (!showMobileSearchSuggestions) return;

    const updatePosition = () => {
      const buttonRect = mobileSearchButtonRef.current?.getBoundingClientRect();
      if (!buttonRect) return;
      const popupWidth = 224;
      setMobileSuggestionsPosition({
        top: buttonRect.bottom + 8,
        left: Math.max(8, Math.min(buttonRect.left, window.innerWidth - popupWidth - 8))
      });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [showMobileSearchSuggestions]);

  useEffect(() => {
    if (!user) {
      setMyStore(null);
      setMyFamilyProduction(null);
      return;
    }
    let cancelled = false;
    Promise.all([
      api.get("/stores/me", { params: { storeType: "store" } }).catch(() => null),
      api.get("/stores/me", { params: { storeType: "family-production" } }).catch(() => null)
    ]).then(([storeRes, familyRes]) => {
      if (cancelled) return;
      setMyStore(storeRes?.data || null);
      setMyFamilyProduction(familyRes?.data || null);
    });
    return () => { cancelled = true; };
  }, [user, api]);

  useEffect(() => {
    (async () => {
      if (!user) return setUnreadNotif(0);
      try {
        const r = await getNotificationRequest(api, "/notifications/unread-count", user?._id || user?.id);
        setUnreadNotif(Number(r.data?.count || 0));
      } catch {
        setUnreadNotif(0);
      }
    })();
  }, [user]);
  useEffect(() => {
    const fetchFavCount = async () => {
      if (!user) return setFavCount(0);
      try {
        const r = await api.get("/favorites/count");
        setFavCount(Number(r.data?.count || 0));
      } catch {
        setFavCount(0);
      }
    };
    
    fetchFavCount();
    
    // Listen for updates from other components
    window.addEventListener("favorite:updated", fetchFavCount);
    return () => window.removeEventListener("favorite:updated", fetchFavCount);
  }, [user]);
  useEffect(() => {
    let timer;
    if (user) {
      timer = setInterval(async () => {
        try {
          const rn = await getNotificationRequest(api, "/notifications/unread-count", user?._id || user?.id);
          setUnreadNotif(Number(rn.data?.count || 0));
        } catch {}
      }, 30000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [user]);
  useEffect(() => {
    const handler = (e) => {
      setUnreadNotif((c) => c + 1);
    };
    window.addEventListener("notification:new", handler);
    return () => window.removeEventListener("notification:new", handler);
  }, []);
  useEffect(() => {
    const onActive = (e) => {
      const { conversationId } = e.detail || {};
      setActiveConvId(conversationId || "");
    };
    const onNewMsg = (e) => {
      // Handled by ChatContext now
    };
    const onRead = async () => {
      // Handled by ChatContext now
    };
    window.addEventListener("conversation:active", onActive);
    return () => {
      window.removeEventListener("conversation:active", onActive);
    };
  }, [user, activeConvId]);
  const prevUnreadRef = React.useRef(0);
  useEffect(() => {
    const enabled = localStorage.getItem("notifyEnabled") === "true";
    if (!enabled) {
      prevUnreadRef.current = unread;
      return;
    }
    if (unread > prevUnreadRef.current) {
      try {
        new Notification("رسالة جديدة", { body: "لديك رسائل غير مقروءة" });
      } catch {}
    }
    prevUnreadRef.current = unread;
  }, [unread]);
  useEffect(() => {
    const enabled = localStorage.getItem("notifyEnabled") === "true";
    if (!user || !enabled) return;
    const poll = async () => {
      try {
        const res = await api.get("/ads/my");
        const mapKey = "adsStatusMap";
        const prevRaw = localStorage.getItem(mapKey);
        const prevMap = prevRaw ? JSON.parse(prevRaw) : {};
        const currMap = {};
        (res.data || []).forEach((a) => {
          currMap[a._id] = a.status;
          const prev = prevMap[a._id];
          if (prev && prev !== a.status && (a.status === "approved" || a.status === "rejected")) {
            try {
              new Notification("تحديث حالة إعلان", { body: `${a.title} • ${a.status}` });
            } catch {}
          }
        });
        localStorage.setItem(mapKey, JSON.stringify(currMap));
      } catch {}
    };
    const t = setInterval(poll, 30000);
    poll();
    return () => clearInterval(t);
  }, [user]);
  const handleSearchSubmit = (query = q) => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (governorateId) params.set("governorateId", governorateId);
    setShowMobileSearchSuggestions(false);
    navigate(`/search?${params.toString()}`);
  };
  const onSearch = (e) => {
    e.preventDefault();
    handleSearchSubmit();
  };
  return (
    <>
    <header className="app-top-bar fixed inset-x-0 top-0 z-40 border-b border-white/10 bg-[#061b45] backdrop-blur-2xl transition-all duration-300 hover:shadow-lg hover:shadow-blue-950/30 md:border-blue-100/80 md:bg-white/80 md:hover:shadow-blue-100/50 dark:border-slate-700 dark:bg-slate-900/85 dark:hover:shadow-slate-900/40">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-blue-500/60 to-transparent" />
      <div className="mx-auto max-w-6xl px-4">
        <div className="flex h-[60px] items-center gap-2 md:h-[70px] md:justify-between md:gap-4">
          {/* Logo & Search Toggle on Mobile */}
          <div className="flex shrink-0 items-center gap-4">
            <Link to="/" className="rounded-2xl border border-blue-100 bg-white/80 px-2.5 py-1.5 shadow-sm shadow-blue-100/40 transition-all hover:-translate-y-0.5 hover:shadow-md">
              <Logo />
            </Link>
          </div>

          <form
            onSubmit={onSearch}
            onBlur={(event) => {
              if (
                !event.currentTarget.contains(event.relatedTarget) &&
                !mobileSuggestionsRef.current?.contains(event.relatedTarget)
              ) {
                setShowMobileSearchSuggestions(false);
              }
            }}
            className="relative flex min-w-0 flex-1 items-center md:hidden"
          >
            <div className="flex min-w-0 w-full items-center gap-1 rounded-xl border border-white/15 bg-white/10 px-2 py-1.5 text-white shadow-sm">
              <svg aria-hidden="true" className="h-4 w-4 shrink-0 text-white/70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="search"
                inputMode="search"
                placeholder="ابحث في سوقك..."
                value={q}
                onFocus={() => setShowMobileSearchSuggestions(true)}
                onChange={(event) => setQ(event.target.value)}
                aria-label="البحث"
                aria-expanded={showMobileSearchSuggestions}
                aria-controls="mobile-top-search-suggestions"
                className="min-w-0 flex-1 bg-transparent text-[11px] font-bold text-white outline-none placeholder:text-white/60"
              />
              <div className="relative shrink-0">
                <button
                  ref={mobileSearchButtonRef}
                  type={q.trim() ? "submit" : "button"}
                  aria-label="تنفيذ البحث"
                  onClick={() => {
                    if (!q.trim()) setShowMobileSearchSuggestions(true);
                  }}
                  className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/15 text-white transition-colors hover:bg-white/25"
                >
                  <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </button>
              </div>
            </div>
            {showMobileSearchSuggestions && createPortal(
              <div
                ref={mobileSuggestionsRef}
                id="mobile-top-search-suggestions"
                style={{ top: mobileSuggestionsPosition.top, left: mobileSuggestionsPosition.left }}
                className="fixed z-[100] w-56 rounded-xl border border-slate-200 bg-white p-2.5 text-right text-slate-800 shadow-xl shadow-blue-950/20"
              >
                <p className="mb-2 text-[10px] font-black text-slate-500">كلمات رائجة للبحث</p>
                <div className="flex flex-wrap gap-1.5">
                  {["سيارة", "جوال", "بيت", "عقار", "أثاث", "وظائف"].map((keyword) => (
                    <button
                      key={keyword}
                      type="button"
                      onClick={() => handleSearchSubmit(keyword)}
                      className="rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-[10px] font-black text-blue-800 transition-colors hover:bg-blue-100"
                    >
                      {keyword}
                    </button>
                  ))}
                </div>
              </div>,
              document.body
            )}
          </form>

          {/* Search Bar - Hidden on small mobile, shown on tablet/desktop */}
          <div className="hidden md:flex flex-1 max-w-xl">
            <form onSubmit={onSearch} className="relative w-full group flex items-center">
              <div className="relative flex-1">
                <input
                  type="search"
                  inputMode="search"
                  className="w-full rounded-full border border-blue-100/90 bg-white px-5 py-2.5 pr-12 text-sm outline-none transition-all placeholder:text-gray-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/15 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-400 dark:focus:bg-slate-800" 
                  placeholder="ابحث عن سيارات، عقارات، إلكترونيات..." 
                  value={q} 
                  onChange={(e) => setQ(e.target.value)} 
                />
                <button type="submit" className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 p-1.5 text-white hover:from-blue-700 hover:to-indigo-700 transition-colors shadow-md">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </button>
              </div>
              <button 
                type="button"
                onClick={() => setShowAdvancedSearch(true)}
                className="mr-2 flex items-center gap-1.5 rounded-full border border-blue-200 bg-gradient-to-b from-blue-50 to-indigo-50 px-3 py-2 text-xs font-bold text-blue-700 hover:from-blue-100 hover:to-indigo-100 transition-all hover:border-blue-300 active:scale-95 whitespace-nowrap"
                title="بحث متقدم"
              >
                <svg className="h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
                <span>بحث متقدم</span>
              </button>
            </form>
          </div>

          <AdvancedSearchModal 
            isOpen={showAdvancedSearch} 
            onClose={() => setShowAdvancedSearch(false)} 
            initialFilters={{ q }}
          />

          {/* Mobile Actions - Simplified & Consistent */}
          <div className="flex shrink-0 items-center gap-1.5 md:hidden">
            <PWAInstallButton mobile={true} />
            {user && (
              <div className="relative">
                <UserNotificationBell mobile={true} />
                <Link 
                  to="/messages" 
                  className="absolute -left-2 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white shadow-sm border border-white"
                  style={{ display: unread > 0 ? 'flex' : 'none' }}
                >
                  {unread > 9 ? '+9' : unread}
                </Link>
              </div>
            )}
          </div>

          {/* Desktop Actions */}
          <div className="flex items-center gap-1.5 sm:gap-3">
            <PWAInstallButton />
            <button
              type="button"
              onClick={toggleTheme}
              className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-blue-100 bg-white px-3 py-2 text-xs font-bold text-gray-700 shadow-sm transition-colors hover:bg-blue-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
              title="تبديل الوضع الليلي"
            >
              <span>{isDark ? "☀️" : "🌙"}</span>
              <span>{isDark ? "فاتح" : "داكن"}</span>
            </button>

            {/* Notifications Bell - Desktop/Tablet */}
            {user && (
              <div className="hidden sm:block">
                <UserNotificationBell />
              </div>
            )}

            {/* Location Selector - Desktop/Mobile */}
            <div className="hidden lg:block relative">
              <MobileSelect
                value={governorateId}
                onChange={(e) => {
                  const val = e.target.value;
                  setGovernorateId(val);
                  const params = new URLSearchParams();
                  if (q) params.set("q", q);
                  if (val) params.set("governorateId", val);
                  navigate(`/${params.toString() ? `?${params.toString()}` : ""}`);
                }}
                options={governorates.map(g => ({ value: g._id, label: g.name }))}
                placeholder="كل اليمن"
                className="min-w-[150px]"
              />
            </div>

            {/* User Profile / Login */}
            {user ? (
              <button
                  type="button"
                  aria-label="فتح قائمة الحساب"
                  aria-haspopup="dialog"
                  aria-expanded={accountMenuOpen}
                  aria-controls="account-side-menu"
                  className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/10 p-1.5 pr-3 text-white hover:bg-white/20 transition-all shadow-sm active:scale-95 md:border-slate-100 md:bg-white md:text-slate-900 md:hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900"
                  onClick={() => setAccountMenuOpen(true)}
                >
                  <div className="hidden sm:flex flex-col items-end mr-1">
                    <span className="text-xs font-black text-slate-900 dark:text-white leading-none">{user.name}</span>
                    {user?.isVerifiedSeller && <span className="text-[10px] text-blue-600 font-black">موثّق</span>}
                  </div>
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-sm font-black text-white shadow-lg overflow-hidden">
                    {user?.avatar ? (
                      <img 
                        src={uploadsUrl(user.avatar, "thumb")} 
                        alt="" 
                        className="w-full h-full object-cover" 
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = uploadsUrl(user.avatar, "full");
                        }}
                      />
                    ) : (
                      user.name?.charAt(0) || 'U'
                    )}
                  </div>
              </button>
            ) : (
              <div className="relative" ref={dropdownRef}>
                <div className="hidden sm:flex items-center gap-1 sm:gap-2">
                  <Link to="/login" className="px-3 py-2 text-xs sm:text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors">دخول</Link>
                  <Link to="/register" className="rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-xs sm:text-sm font-bold text-white hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg shadow-blue-300/50">إنشاء حساب</Link>
                </div>
                {/* Mobile Hamburger for non-logged-in users */}
                <button 
                  className="sm:hidden flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/10 text-white shadow-sm hover:bg-white/20" 
                  onClick={() => setOpen((v) => !v)}
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
                  </svg>
                </button>
                {open && (
                  <div className="absolute left-0 z-50 mt-2 w-44 sm:w-48 origin-top-left rounded-2xl border bg-white p-2 shadow-xl ring-1 ring-black/5 animate-in fade-in zoom-in duration-200">
                    <Link to="/quote-requests" className="flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-50">تسعيرة سوقك</Link>
                    <Link to="/login" className="flex items-center gap-3 px-3 py-2 text-xs sm:text-sm text-gray-700 hover:bg-gray-50 rounded-lg font-medium">تسجيل الدخول</Link>
                    <Link to="/register" className="flex items-center gap-3 px-3 py-2 text-xs sm:text-sm text-blue-600 hover:bg-blue-50 rounded-lg font-bold">إنشاء حساب جديد</Link>
                    <div className="border-t my-1 pt-1">
                      <Link to="/terms" className="hidden sm:flex items-center gap-3 px-3 py-2 text-[10px] sm:text-xs text-gray-500 hover:bg-gray-50 rounded-lg">الشروط والأحكام</Link>
                      <Link to="/privacy" className="hidden sm:flex items-center gap-3 px-3 py-2 text-[10px] sm:text-xs text-gray-500 hover:bg-gray-50 rounded-lg">سياسة الخصوصية</Link>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Add Ad Button - Desktop */}
            <Link to="/choose-add-type" className="hidden sm:inline-flex rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3 text-sm font-black text-white hover:from-blue-700 hover:to-indigo-700 shadow-xl shadow-blue-500/25 transition-all hover:scale-105 active:scale-95">
              {t("navbar.addAd")}
            </Link>
          </div>
        </div>
      </div>
    </header>
    {user && accountMenuOpen && createPortal(
      <div className="fixed inset-0 z-[100]" dir="rtl">
        <button
          type="button"
          aria-label="إغلاق قائمة الحساب"
          onClick={() => setAccountMenuOpen(false)}
          className="absolute inset-0 h-full w-full bg-slate-950/50 backdrop-blur-[2px]"
        />
        <aside
          ref={accountMenuRef}
          id="account-side-menu"
          role="dialog"
          aria-modal="true"
          aria-labelledby="account-side-menu-title"
          className="absolute right-0 top-0 flex h-full w-[min(22rem,90vw)] flex-col border-l border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
        >
          <div className="flex items-center justify-between border-b border-slate-100 p-4 dark:border-slate-800">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-lg font-black text-white">
                {user.avatar ? (
                  <img
                    src={uploadsUrl(user.avatar, "thumb")}
                    alt=""
                    className="h-full w-full object-cover"
                    onError={(event) => {
                      event.currentTarget.onerror = null;
                      event.currentTarget.src = uploadsUrl(user.avatar, "full");
                    }}
                  />
                ) : user.name?.charAt(0) || "U"}
              </div>
              <div className="min-w-0">
                <h2 id="account-side-menu-title" className="truncate text-sm font-black text-slate-900 dark:text-white">{user.name}</h2>
                <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">{isAdminAccount ? "إدارة سوقك" : "القائمة الرئيسية"}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setAccountMenuOpen(false)}
              aria-label="إغلاق القائمة"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="m6 6 12 12M18 6 6 18" />
              </svg>
            </button>
          </div>

          <nav aria-label="روابط الحساب" className="flex-1 space-y-5 overflow-y-auto p-4">
            {!user.isEmailVerified && !user.managedAccount?.createdByAdmin && (
              <Link
                to="/verify-email"
                onClick={() => setAccountMenuOpen(false)}
                className="flex items-center gap-3 rounded-xl border border-red-100 bg-red-50 px-3 py-3 text-sm font-black text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300"
              >
                <span aria-hidden="true">✉️</span>
                تفعيل الحساب
              </Link>
            )}

            <section>
              <h3 className="mb-2 px-2 text-[11px] font-black text-slate-400">تصفح سوقك</h3>
              <div className="space-y-1">
                {[
                  ["🔎", "تصفح الإعلانات", "/search"],
                  ["🗂️", "تصفح الفئات", "/categories"],
                  ["🏪", "تصفح المتاجر", "/stores"],
                  ["🏠", "تصفح الأسر المنتجة", "/family-production"],
                  ["💳", "خدمة الدفع الإلكتروني", "/wallet-services"],
                  ["🔨", "تصفح المزادات", "/auctions"],
                  ["📅", "تصفح الحجوزات", "/bookings"],
                  ["🏷️", "تصفح طلبات التسعيرات", "/quote-requests"],
                  ["🤝", "شركاء سوقك", "/partners"]
                ].map(([icon, label, to]) => (
                  <Link
                    key={to}
                    to={to}
                    onClick={() => setAccountMenuOpen(false)}
                    className="flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-blue-50 hover:text-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-blue-300"
                  >
                    <span aria-hidden="true" className="w-6 text-center text-base">{icon}</span>
                    {label}
                  </Link>
                ))}
              </div>
            </section>

            {!isAdminAccount && (
              <section>
                <h3 className="mb-2 px-2 text-[11px] font-black text-slate-400">خدماتك وإعلاناتك</h3>
                <div className="space-y-1">
                  {[
                    ["➕", "إضافة إعلان", "/choose-add-type"],
                    ["⭐", "ميز إعلانك", "/seller/feature-ad"],
                    ["🛡️", "وثق حسابك", "/seller/verification"],
                    ["🧰", "خدمات سوقك", "/seller/subscriptions"],
                    ["📋", "إعلاناتي", "/my-ads"],
                    ["🔨", "مزاداتي", "/my-auctions"],
                    ["🧾", "طلباتي للتسعير", "/my-quote-requests"],
                    ["💬", "عروضي على التسعيرات", "/my-quote-offers"],
                    [myStore ? "🏬" : "🏪", myStore?.status === "pending" ? "متابعة طلب متجري" : myStore?.status === "rejected" ? "إعادة تقديم طلب المتجر" : myStore ? "إدارة متجري" : "أنشئ متجرك", myStore?.status === "rejected" || !myStore ? "/seller/store/create" : "/my-store"],
                    [myFamilyProduction ? "🏡" : "🌱", myFamilyProduction?.status === "pending" ? "متابعة طلب الأسرة المنتجة" : myFamilyProduction?.status === "rejected" ? "إعادة تقديم طلب الأسرة المنتجة" : myFamilyProduction ? "إدارة الأسرة المنتجة" : "انضم إلى الأسر المنتجة", myFamilyProduction?.status === "rejected" || !myFamilyProduction ? "/family-production/register" : "/my-family-production"]
                  ].map(([icon, label, to]) => (
                    <Link
                      key={to}
                      to={to}
                      onClick={() => setAccountMenuOpen(false)}
                      className="flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-blue-50 hover:text-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-blue-300"
                    >
                      <span aria-hidden="true" className="w-6 text-center text-base">{icon}</span>
                      {label}
                    </Link>
                  ))}
                  {myStore && myStore.status === "active" && myStore.subscriptionStatus === "active" && myStore.slug && (
                    <Link
                      to={`/store/${myStore.slug}`}
                      onClick={() => setAccountMenuOpen(false)}
                      className="flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm font-bold text-emerald-700 transition hover:bg-emerald-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-600 dark:text-emerald-300 dark:hover:bg-emerald-950/30"
                    >
                      <span aria-hidden="true" className="w-6 text-center text-base">🌐</span>
                      عرض متجري
                    </Link>
                  )}
                  {myFamilyProduction && myFamilyProduction.status === "active" && myFamilyProduction.subscriptionStatus === "active" && myFamilyProduction.slug && (
                    <Link
                      to={`/store/${myFamilyProduction.slug}`}
                      onClick={() => setAccountMenuOpen(false)}
                      className="flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm font-bold text-emerald-700 transition hover:bg-emerald-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-600 dark:text-emerald-300 dark:hover:bg-emerald-950/30"
                    >
                      <span aria-hidden="true" className="w-6 text-center text-base">🌐</span>
                      عرض مشروع الأسرة المنتجة
                    </Link>
                  )}
                </div>
              </section>
            )}

            <section>
              <h3 className="mb-2 px-2 text-[11px] font-black text-slate-400">حسابي</h3>
              <div className="space-y-1">
                {[
                  ["👤", "مركز الحساب", "/account"],
                  ["🔔", "الإشعارات", "/notifications"],
                  ["✉️", "الرسائل", "/messages"],
                  ["❤️", "المفضلة", "/favorites"],
                  ["👥", "الحسابات التي أتابعها", "/following"],
                  ...(!isAdminAccount ? [["💰", "المحفظة والشراء الآمن", "/wallet"]] : []),
                  ["⚙️", "الإعدادات", "/account-settings"],
                  ...(isAdminAccount ? [["🛠️", "لوحة التحكم", "/admin"]] : []),
                  ...(brokerageEnabled && !isAdminAccount ? [["🤝", "لوحة الوسيط", "/brokerage"]] : []),
                  ...(!isAdminAccount ? [["🎁", "سفراء سوقك", "/referrals"]] : [])
                ].map(([icon, label, to]) => (
                  <Link
                    key={to}
                    to={to}
                    onClick={() => setAccountMenuOpen(false)}
                    className="flex min-h-11 items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-blue-50 hover:text-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-blue-300"
                  >
                    <span className="flex items-center gap-3">
                      <span aria-hidden="true" className="w-6 text-center text-base">{icon}</span>
                      {label}
                    </span>
                    {to === "/messages" && unread > 0 && <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-black text-white">{unread}</span>}
                    {to === "/favorites" && favCount > 0 && <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-black text-white">{favCount}</span>}
                  </Link>
                ))}
              </div>
            </section>
          </nav>

          <div className="border-t border-slate-100 p-4 dark:border-slate-800">
            <button
              type="button"
              onClick={() => {
                setAccountMenuOpen(false);
                logout();
              }}
              className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-black text-red-600 transition hover:bg-red-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-600 dark:text-red-400 dark:hover:bg-red-950/30"
            >
              <span aria-hidden="true">↪</span>
              تسجيل الخروج
            </button>
          </div>
        </aside>
      </div>,
      document.body
    )}
    </>
  );
}
