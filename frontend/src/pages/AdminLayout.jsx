import React, { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import Logo from "../components/Logo.jsx";
import AdminNotificationBell from "../components/AdminNotificationBell.jsx";
import { useApi } from "../api/axios.js";
import { useChat } from "../store/ChatContext.jsx";
import { useAuth } from "../store/AuthContext.jsx";

export default function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toast, setToast] = useState({ open: false, message: "", type: "info" });
  const [unreadSupport, setUnreadSupport] = useState(0);
  const api = useApi();
  const { socket } = useChat();
  const { logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchUnreadSupport();

    if (socket) {
      socket.on("support:new_message", () => {
        fetchUnreadSupport();
      });
      socket.on("support:unread_count_update", () => {
        fetchUnreadSupport();
      });
    }

    return () => {
      if (socket) {
        socket.off("support:new_message");
        socket.off("support:unread_count_update");
      }
    };
  }, [socket]);

  const fetchUnreadSupport = async () => {
    try {
      const res = await api.get("/support/admin/unread-count");
      setUnreadSupport(res.data.count || 0);
    } catch {}
  };

  useEffect(() => {
    const handler = (e) => {
      const d = e.detail || {};
      setToast({ open: true, message: d.message || "", type: d.type || "info" });
      setTimeout(() => setToast((t) => ({ ...t, open: false })), 2500);
    };
    window.addEventListener("admin:toast", handler);
    window.addEventListener("app:toast", handler);
    return () => {
      window.removeEventListener("admin:toast", handler);
      window.removeEventListener("app:toast", handler);
    };
  }, []);

  const [openSections, setOpenSections] = useState({
    market: true,
    finance: false,
    users: false,
    system: false
  });

  const toggleSection = (section) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const menuSections = [
    {
      id: "market",
      label: "إدارة السوق",
      icon: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>,
      links: [
        { to: "/admin/ads", label: "الإعلانات" },
        { to: "/admin/sold-ads", label: "الإعلانات المباعة" },
        { to: "/admin/archived-ads", label: "الأرشيف" },
        { to: "/admin/deleted-ads", label: "الإعلانات المحذوفة" },
        { to: "/admin/categories", label: "الفئات" },
        { to: "/admin/tags", label: "التاجات" },
        { to: "/admin/governorates", label: "المحافظات" },
        { to: "/admin/cities", label: "المدن" },
        { to: "/admin/reports", label: "البلاغات" },
        { to: "/resell/requests", label: "طلبات التسويق" }
      ]
    },
    {
      id: "finance",
      label: "الإدارة المالية",
      icon: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
      links: [
        { to: "/admin/finance-hub", label: "📊 مركز الحسابات المالية" },
        { to: "/admin/finance-hub?tab=escrow", label: "🛡️ الوساطة والمالية" },
        { to: "/admin/finance-hub?tab=commissions", label: "💰 المبيعات والعمولات" },
        { to: "/admin/finance-hub?tab=withdrawals", label: "💸 المحفظة والسحوبات" },
        { to: "/admin/finance-hub?tab=plans", label: "📦 الباقات والحسابات" }
      ]
    },
    {
      id: "users",
      label: "إدارة المستخدمين",
      icon: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
      links: [
        { to: "/admin/users", label: "المستخدمون" },
        { to: "/admin/phone-users", label: "مستخدمو الرقم" },
        { to: "/admin/deleted-users", label: "الحسابات المحذوفة" }
      ]
    },
    {
      id: "system",
      label: "النظام",
      icon: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
      links: [
        { to: "/admin/analytics", label: "إحصائيات المنصة" },
        { to: "/admin/platform-reviews", label: "تقييمات المنصة" },
        { to: "/admin/brokerage", label: "إدارة التسويق" },
        { to: "/admin/activity-logs", label: "سجل النشاطات" },
        { to: "/admin/recycle-bin", label: "سلة المهملات" },
        { to: "/admin/system-health", label: "مراقبة النظام" },
        { to: "/admin/welcome-promotion", label: "التمييز الترحيبي" },
        { to: "/admin/messaging", label: "المراسلة العامة" },
        { to: "/admin/settings", label: "الإعدادات" }
      ]
    }
  ];

  const navLinks = [
    { to: "/admin/dashboard", label: "الرئيسية", icon: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg> },
    { to: "/admin/support-inbox", label: "مراسلات الدعم", badge: unreadSupport, icon: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg> },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex flex-col md:flex-row">
      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between p-4 bg-white dark:bg-slate-900 border-b dark:border-slate-700 sticky top-0 z-30">
        <div className="flex items-center gap-2">
          <Logo iconSize="w-8 h-8" showText={false} />
          <span className="font-black text-blue-600">لوحة الإدارة</span>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/admin/support-inbox" className="relative p-2 rounded-lg bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
            {unreadSupport > 0 && (
              <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-white">
                {unreadSupport}
              </span>
            )}
          </Link>
          <AdminNotificationBell />
          <button 
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-lg bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300"
          >
            {sidebarOpen ? (
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Sidebar Overlay for Mobile */}
      {sidebarOpen && (
        <div 
          className="md:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        ></div>
      )}

      {/* Sidebar */}
      <aside className={`
        fixed md:sticky top-0 z-50 h-screen w-72 bg-white dark:bg-slate-900 border-l dark:border-slate-700 transition-transform duration-300 ease-in-out overflow-y-auto
        ${sidebarOpen ? "translate-x-0" : "translate-x-full md:translate-x-0"}
      `}>
        <div className="p-6">
          <Link to="/" className="flex items-center gap-3 mb-8 group">
            <Logo iconSize="w-10 h-10" textSize="text-xl" />
            <div className="border-r pr-3">
              <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">لوحة الإدارة</p>
            </div>
          </Link>

          <nav className="space-y-1">
            {navLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) => `
                  flex items-center justify-between px-4 py-3 rounded-xl text-sm font-bold transition-all mb-1
                  ${isActive 
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-100 translate-x-1" 
                    : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"}
                `}
              >
                <div className="flex items-center gap-3">
                  <span className="flex-shrink-0">{link.icon}</span>
                  <span>{link.label}</span>
                </div>
                {link.badge > 0 && (
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                    window.location.pathname === link.to ? "bg-white text-blue-600" : "bg-red-500 text-white"
                  }`}>
                    {link.badge}
                  </span>
                )}
              </NavLink>
            ))}

            {menuSections.map((section) => (
              <div key={section.id} className="mt-4">
                <button
                  onClick={() => toggleSection(section.id)}
                  className="flex w-full items-center justify-between px-4 py-3 text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex-shrink-0">{section.icon}</span>
                    <span className="text-xs font-black uppercase tracking-widest">{section.label}</span>
                  </div>
                  <svg className={`h-4 w-4 transition-transform ${openSections[section.id] ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {openSections[section.id] && (
                  <div className="space-y-1 mr-4 border-r dark:border-slate-800 pr-4 mt-1">
                    {section.links.map((link) => (
                      <NavLink
                        key={link.to}
                        to={link.to}
                        onClick={() => setSidebarOpen(false)}
                        className={({ isActive }) => `
                          block px-4 py-2 rounded-xl text-xs font-bold transition-all
                          ${isActive 
                            ? "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400" 
                            : "text-gray-500 hover:text-gray-900 dark:hover:text-slate-300"}
                        `}
                      >
                        {link.label}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </nav>

          <div className="mt-8 pt-6 border-t">
            <button
              onClick={() => {
                logout();
                window.location.href = "/";
              }}
              className="flex w-full items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-red-600 hover:bg-red-50 transition-colors"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span>تسجيل الخروج</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0 bg-gray-50/50 dark:bg-slate-950">
        {/* Desktop Header with Notifications */}
        <header className="hidden md:flex items-center justify-end gap-4 px-8 py-4 bg-white/80 dark:bg-slate-900/85 backdrop-blur-md border-b dark:border-slate-700 sticky top-0 z-20">
          <Link 
            to="/admin/support-inbox" 
            className="relative p-2 rounded-xl bg-gray-50 text-gray-500 hover:bg-blue-50 hover:text-blue-600 transition-all active:scale-95"
            title="مراسلات الدعم"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
            {unreadSupport > 0 && (
              <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-white animate-bounce">
                {unreadSupport}
              </span>
            )}
          </Link>
          <AdminNotificationBell />
        </header>

        <div className="p-4 md:p-8 max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>

      {toast.open && (
        <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom duration-300">
          <div
            className={
              "rounded-2xl px-5 py-3 text-sm font-bold shadow-2xl backdrop-blur-md border " +
              (toast.type === "success"
                ? "bg-green-50/90 text-green-700 border-green-200"
                : toast.type === "error"
                ? "bg-red-50/90 text-red-700 border-red-200"
                : "bg-blue-50/90 text-blue-700 border-blue-200")
            }
          >
            {toast.message}
          </div>
        </div>
      )}
    </div>
  );
}
