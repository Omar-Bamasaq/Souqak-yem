import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useApi } from "../api/axios.js";
import { useAuth } from "../store/AuthContext.jsx";

export default function Following() {
  const api = useApi();
  const { user } = useAuth();
  const [sellers, setSellers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await api.get("/follows/mine");
        setSellers(res.data || []);
      } catch {
        setSellers([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (!user) return <div className="ds-card text-sm">الرجاء تسجيل الدخول</div>;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-xl font-black text-gray-900">البائعون الذين أتابعهم</h2>
        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-600 border border-blue-100">
          {sellers.length} بائع
        </span>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
        </div>
      )}

      {!loading && sellers.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-gray-200 bg-white py-16 text-center">
          <div className="mb-4 rounded-full bg-gray-50 p-4 text-gray-300">
            <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </div>
          <p className="text-sm font-bold text-gray-400">لا تتابع أي بائع حتى الآن.</p>
          <Link to="/" className="mt-4 text-xs font-black text-blue-600 hover:underline">اكتشف بائعين جدد</Link>
        </div>
      )}

      {!loading && sellers.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sellers.map((s) => (
            <Link 
              key={s._id} 
              to={`/s/${s._id}`} 
              className="group flex items-center gap-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md active:scale-[0.98]"
            >
              <div className="relative flex-shrink-0">
                <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-blue-50 to-indigo-50 text-blue-600 border border-blue-100 text-xl font-black transition-transform group-hover:scale-105">
                  {(s.name || "?").charAt(0)}
                </div>
                {s.isVerifiedSeller && (
                  <div className="absolute -bottom-1 -right-1 rounded-full bg-blue-600 p-1 text-white shadow-sm ring-2 ring-white">
                    <svg className="h-2.5 w-2.5" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812z" />
                    </svg>
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-black text-gray-900 group-hover:text-blue-600 transition-colors">{s.name}</div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {s.isVerifiedSeller && <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">موثّق</span>}
                  <span className="text-[10px] text-gray-400">@{s._id.slice(-6).toUpperCase()}</span>
                </div>
              </div>
              <div className="text-gray-300 group-hover:text-blue-600 transition-colors">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
