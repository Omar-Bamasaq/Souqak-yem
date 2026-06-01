import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../store/AuthContext.jsx";
import { t } from "../i18n/index.js";
import Logo from "./Logo.jsx";
import { useChat } from "../store/ChatContext.jsx";
import axios from "axios";
import { useApi } from "../api/axios.js";
import AdvancedSearchModal from "./AdvancedSearchModal.jsx";
import MobileSelect from "./MobileSelect.jsx";
import UserNotificationBell from "./UserNotificationBell.jsx";
import { useTheme } from "../store/ThemeContext";
import { uploadsUrl } from "../lib/uploads.js";

export default function NavBar() {
  const { user, logout } = useAuth();
  const { unread } = useChat();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [governorateId, setGovernorateId] = useState("");
  const [governorates, setGovernorates] = useState([]);
  const [unreadNotif, setUnreadNotif] = useState(0);
  const [favCount, setFavCount] = useState(0);
  const [activeConvId, setActiveConvId] = useState("");
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const api = useApi();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const dropdownRef = React.useRef(null);

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
    (async () => {
      try {
        const res = await api.get("/governorates", { params: { active: true } });
        setGovernorates(res.data || []);
      } catch {
        setGovernorates([]);
      }
    })();
  }, []);
  useEffect(() => {
    (async () => {
      if (!user) return setUnreadNotif(0);
      try {
        const r = await api.get("/notifications/unread-count");
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
          const rn = await api.get("/notifications/unread-count");
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
  const onSearch = (e) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (governorateId) params.set("governorateId", governorateId);
    navigate(`/search?${params.toString()}`);
  };
  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b border-blue-100/80 bg-white/80 backdrop-blur-2xl transition-all duration-300 hover:shadow-lg hover:shadow-blue-100/50 dark:border-slate-700 dark:bg-slate-900/85 dark:hover:shadow-slate-900/40">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-blue-500/60 to-transparent" />
      <div className="mx-auto max-w-6xl px-4">
        <div className="flex h-[70px] items-center justify-between gap-4">
          {/* Logo & Search Toggle on Mobile */}
          <div className="flex items-center gap-4">
            <Link to="/" className="rounded-2xl border border-blue-100 bg-white/80 px-2.5 py-1.5 shadow-sm shadow-blue-100/40 transition-all hover:-translate-y-0.5 hover:shadow-md">
              <Logo />
            </Link>
          </div>

          {/* Search Bar - Hidden on small mobile, shown on tablet/desktop */}
          <div className="hidden md:flex flex-1 max-w-xl">
            <form onSubmit={onSearch} className="relative w-full group flex items-center">
              <div className="relative flex-1">
                <input 
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
          <div className="flex md:hidden flex-1 justify-end items-center gap-2">
            <button 
              onClick={() => navigate("/search")}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-100 bg-white text-slate-600 shadow-sm transition-all active:scale-90 dark:border-slate-800 dark:bg-slate-900"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
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
              <div className="relative" ref={dropdownRef}>
                <button 
                  className="flex items-center gap-2 rounded-2xl border border-slate-100 bg-white p-1.5 pr-3 hover:bg-slate-50 transition-all shadow-sm active:scale-95 dark:border-slate-800 dark:bg-slate-900"
                  onClick={() => setOpen((v) => !v)}
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
                {open && (
                  <div className="absolute left-0 z-50 mt-2 w-52 sm:w-56 origin-top-left rounded-2xl border border-blue-100 bg-white p-2 shadow-2xl ring-1 ring-blue-100/40 animate-in fade-in zoom-in duration-200 max-h-[85vh] overflow-y-auto dark:border-slate-700 dark:bg-slate-800 dark:ring-slate-700/40">
                    <div className="px-3 py-2 border-b mb-1 sticky top-0 bg-white dark:bg-slate-800 dark:border-slate-700 z-10">
                      <p className="text-[10px] sm:text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">الحساب</p>
                    </div>
                    {!user.isEmailVerified && (
                      <Link to="/verify-email" className="flex items-center gap-3 px-3 py-2 text-xs sm:text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 rounded-lg font-medium">تفعيل الحساب</Link>
                    )}
                    {user?.role !== "admin" && (
                      <>
                        <Link to="/wallet" className="flex items-center justify-between px-3 py-2 text-xs sm:text-sm text-blue-600 dark:text-blue-400 font-black hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg">
                          <div className="flex items-center gap-2">
                            <span>💳</span>
                            <span>المحفظة والشراء الآمن</span>
                          </div>
                          <span className="text-[10px] bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 px-1.5 py-0.5 rounded-md">جديد</span>
                        </Link>
                        <Link to="/seller" className="flex items-center gap-3 px-3 py-2 text-xs sm:text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700/50 rounded-lg">لوحة البائع</Link>
                        <Link to="/my-ads" className="flex items-center gap-3 px-3 py-2 text-xs sm:text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700/50 rounded-lg">إعلاناتي</Link>
                        <Link to="/favorites" className="flex items-center justify-between px-3 py-2 text-xs sm:text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700/50 rounded-lg">
                          <span>المفضلة</span>
                          {favCount > 0 && <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white">{favCount}</span>}
                        </Link>
                        <Link to="/seller/subscriptions" className="flex items-center gap-3 px-3 py-2 text-xs sm:text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700/50 rounded-lg">الاشتراكات والتمييز</Link>
                      </>
                    )}
                    
                    <Link to="/messages" className="flex items-center justify-between px-3 py-2 text-xs sm:text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700/50 rounded-lg">
                      <span>الرسائل</span>
                      {unread > 0 && <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-bold text-white">{unread}</span>}
                    </Link>

                    {user?.role === "admin" && (
                      <Link to="/admin" className="flex items-center gap-3 px-3 py-2 text-xs sm:text-sm text-blue-600 font-bold hover:bg-blue-50 rounded-lg">لوحة التحكم</Link>
                    )}
                    
                    <div className="border-t my-1 pt-1">
                      <button onClick={logout} className="flex w-full items-center gap-3 px-3 py-2 text-xs sm:text-sm text-red-600 hover:bg-red-50 rounded-lg font-medium">تسجيل الخروج</button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="relative" ref={dropdownRef}>
                <div className="hidden sm:flex items-center gap-1 sm:gap-2">
                  <Link to="/login" className="px-3 py-2 text-xs sm:text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors">دخول</Link>
                  <Link to="/register" className="rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-xs sm:text-sm font-bold text-white hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg shadow-blue-300/50">إنشاء حساب</Link>
                </div>
                {/* Mobile Hamburger for non-logged-in users */}
                <button 
                  className="sm:hidden flex h-9 w-9 items-center justify-center rounded-full border border-blue-100 bg-white text-gray-600 shadow-sm hover:bg-blue-50" 
                  onClick={() => setOpen((v) => !v)}
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
                  </svg>
                </button>
                {open && (
                  <div className="absolute left-0 z-50 mt-2 w-44 sm:w-48 origin-top-left rounded-2xl border bg-white p-2 shadow-xl ring-1 ring-black/5 animate-in fade-in zoom-in duration-200">
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
  );
}
