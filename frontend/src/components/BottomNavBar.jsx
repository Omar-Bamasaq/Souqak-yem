import React from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../store/AuthContext.jsx";
import { useChat } from "../store/ChatContext.jsx";
import { uploadsUrl } from "../lib/uploads.js";

export default function BottomNavBar() {
  const { user } = useAuth();
  const { unread } = useChat();

  const activeClass = "text-blue-700";
  const inactiveClass = "text-gray-500 hover:text-blue-600";

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 block border-t border-blue-100 bg-white/90 backdrop-blur-xl md:hidden">
      <div className="mx-auto flex h-16 max-w-2xl items-center justify-around px-2">
        <NavLink
          to="/"
          className={({ isActive }) =>
            `flex flex-col items-center gap-1 transition-all ${isActive ? activeClass : inactiveClass}`
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
            `flex flex-col items-center gap-1 transition-all ${isActive ? activeClass : inactiveClass}`
          }
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <span className="text-[10px] font-medium">بحث</span>
        </NavLink>

        <NavLink
          to="/choose-add-type"
          className="relative -top-4 flex h-14 w-14 flex-col items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-xl shadow-blue-300/60 ring-4 ring-white transition-transform active:scale-95"
        >
          <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </NavLink>

        <NavLink
          to="/messages"
          className={({ isActive }) =>
            `flex flex-col items-center gap-1 transition-all ${isActive ? activeClass : inactiveClass}`
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
            <NavLink
              to={user.role === "admin" ? "/admin" : "/seller"}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 transition-all ${isActive ? activeClass : inactiveClass}`
              }
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
            </NavLink>

            <NavLink
              to="/account-settings"
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 transition-all ${isActive ? activeClass : inactiveClass}`
              }
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="text-[10px] font-medium">الإعدادات</span>
            </NavLink>
          </>
        ) : (
          <NavLink
            to="/login"
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 transition-all ${isActive ? activeClass : inactiveClass}`
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
  );
}
