import React, { useEffect, useRef, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../store/AuthContext.jsx";
import { useChat } from "../store/ChatContext.jsx";
import { uploadsUrl } from "../lib/uploads.js";
import { useApi } from "../api/axios.js";
import { getAuthorizedActiveStoreChoices } from "../lib/quickUxHelpers.js";

export default function BottomNavBar() {
  const { user } = useAuth();
  const { unread } = useChat();
  const api = useApi();
  const navigate = useNavigate();
  const [activeStores, setActiveStores] = useState([]);
  const [storeCheckLoading, setStoreCheckLoading] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showStoreChoices, setShowStoreChoices] = useState(false);
  const [activeStoreOwnerId, setActiveStoreOwnerId] = useState("");
  const closeButtonRef = useRef(null);
  const userId = user?._id || user?.id;

  const activeClass = "text-blue-700";
  const inactiveClass = "text-gray-500 hover:text-blue-600";

  useEffect(() => {
    if (!userId) {
      setActiveStores([]);
      setActiveStoreOwnerId("");
      setStoreCheckLoading(false);
      return;
    }
    let cancelled = false;
    setActiveStores([]);
    setActiveStoreOwnerId("");
    setStoreCheckLoading(true);
    Promise.allSettled([
      api.get("/stores/me", { params: { storeType: "store" } }),
      api.get("/stores/me", { params: { storeType: "family-production" } })
    ]).then(([storeResult, familyResult]) => {
      if (cancelled) return;
      const stores = getAuthorizedActiveStoreChoices(storeResult, familyResult);
      setActiveStores(stores);
      setActiveStoreOwnerId(String(userId));
    }).finally(() => {
      if (!cancelled) setStoreCheckLoading(false);
    });
    return () => { cancelled = true; };
  }, [api, userId]);

  useEffect(() => {
    if (!showAddMenu) return undefined;
    closeButtonRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === "Escape") setShowAddMenu(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showAddMenu]);

  const openAddMenu = () => {
    if (userId && storeCheckLoading) return;
    if (userId && activeStoreOwnerId !== String(userId)) return;
    if (!storeCheckLoading && activeStores.length > 0) {
      setShowStoreChoices(false);
      setShowAddMenu(true);
      return;
    }
    navigate("/choose-add-type");
  };

  const openPersonalAd = () => {
    setShowAddMenu(false);
    navigate("/add-product");
  };

  const openStoreProduct = (storeType) => {
    setShowAddMenu(false);
    navigate(`/add-product?storeProduct=1&storeType=${encodeURIComponent(storeType)}&type=sell`);
  };

  return (
    <>
    <nav aria-label="التنقل الرئيسي" className="app-bottom-nav fixed bottom-0 left-0 right-0 z-50 block border-t border-blue-100 bg-white/95 md:hidden">
      <div className="mx-auto flex h-16 max-w-2xl items-center justify-around gap-1 px-2">
        <NavLink
          to="/"
          className={({ isActive }) =>
            `flex min-h-11 min-w-11 flex-1 flex-col items-center justify-center gap-1 rounded-xl transition-colors duration-150 active:scale-[0.97] active:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 ${isActive ? activeClass : inactiveClass}`
          }
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          <span className="text-[10px] font-medium">الرئيسية</span>
        </NavLink>

        <NavLink
          to="/search"
          className={({ isActive }) =>
            `flex min-h-11 min-w-11 flex-1 flex-col items-center justify-center gap-1 rounded-xl transition-colors duration-150 active:scale-[0.97] active:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 ${isActive ? activeClass : inactiveClass}`
          }
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <span className="text-[10px] font-medium">بحث</span>
        </NavLink>

        <button
          type="button"
          onClick={openAddMenu}
          disabled={Boolean(userId && storeCheckLoading)}
          aria-busy={Boolean(userId && storeCheckLoading)}
          aria-label="إضافة إعلان"
          title="إضافة إعلان"
          className="relative -top-3 flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-md ring-4 ring-white transition-transform duration-150 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >
          <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>

        <NavLink
          to="/messages"
          className={({ isActive }) =>
            `flex min-h-11 min-w-11 flex-1 flex-col items-center justify-center gap-1 rounded-xl transition-colors duration-150 active:scale-[0.97] active:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 ${isActive ? activeClass : inactiveClass}`
          }
        >
          <div className="relative">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
            {unread > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                {unread}
              </span>
            )}
          </div>
          <span className="text-[10px] font-medium">رسائلي</span>
        </NavLink>

        {user ? (
          <>
            <button
              type="button"
              aria-label="فتح قائمة الحساب"
              aria-haspopup="dialog"
              onClick={() => window.dispatchEvent(new Event("account-menu:open"))}
              className={`flex min-h-11 min-w-11 flex-1 flex-col items-center justify-center gap-1 rounded-xl transition-colors duration-150 active:scale-[0.97] active:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 ${inactiveClass}`}
            >
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 text-[10px] font-bold text-blue-700 overflow-hidden border border-blue-200">
                {user.avatar ? (
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
              <span className="text-[10px] font-medium">حسابي</span>
            </button>

          </>
        ) : (
          <NavLink
            to="/login"
            className={({ isActive }) =>
              `flex min-h-11 min-w-12 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1 transition-colors duration-150 active:scale-[0.97] active:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 ${isActive ? activeClass : inactiveClass}`
            }
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span className="text-[10px] font-medium">دخول</span>
          </NavLink>
        )}
      </div>
    </nav>
    {showAddMenu && (
      <div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/50 p-3 backdrop-blur-sm md:hidden" role="presentation" onMouseDown={(event) => {
        if (event.target === event.currentTarget) setShowAddMenu(false);
      }}>
        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby="bottom-add-menu-title"
          dir="rtl"
          className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-4 shadow-2xl dark:border-slate-700 dark:bg-slate-900"
        >
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 id="bottom-add-menu-title" className="text-lg font-black text-slate-900 dark:text-white">ماذا تريد أن تضيف؟</h2>
            <button ref={closeButtonRef} type="button" onClick={() => setShowAddMenu(false)} aria-label="إغلاق نافذة الإضافة" className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-xl font-black text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 dark:bg-slate-800 dark:text-white">×</button>
          </div>

          {!showStoreChoices ? (
            <div className="grid gap-3">
              <button type="button" onClick={openPersonalAd} className="min-h-14 rounded-2xl border-2 border-blue-100 bg-blue-50 px-4 py-3 text-right text-base font-black text-blue-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-100">
                إعلان شخصي
              </button>
              <button type="button" onClick={() => {
                if (activeStores.length === 1) openStoreProduct(activeStores[0].storeType);
                else setShowStoreChoices(true);
              }} className="min-h-14 rounded-2xl border-2 border-emerald-100 bg-emerald-50 px-4 py-3 text-right text-base font-black text-emerald-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
                {activeStores.length === 1
                  ? activeStores[0].storeType === "family-production" ? "منتج لمشروعي" : "منتج للمتجر"
                  : "منتج لمتجر أو مشروعي"}
              </button>
            </div>
          ) : (
            <div className="grid gap-3">
              <p className="text-sm font-bold text-slate-600 dark:text-slate-300">اختر المتجر الذي تريد إضافة منتج له:</p>
              {activeStores.map((store) => (
                <button key={store.storeType} type="button" onClick={() => openStoreProduct(store.storeType)} className="min-h-14 rounded-2xl border-2 border-slate-200 bg-slate-50 px-4 py-3 text-right text-base font-black text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 dark:border-slate-700 dark:bg-slate-800 dark:text-white">
                  {store.label}
                </button>
              ))}
              <button type="button" onClick={() => setShowStoreChoices(false)} className="min-h-11 text-sm font-black text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">رجوع</button>
            </div>
          )}
        </section>
      </div>
    )}
    </>
  );
}
