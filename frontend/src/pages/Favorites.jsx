import React, { useEffect, useState } from "react";
import { useApi } from "../api/axios.js";
import { Link } from "react-router-dom";
import ProductCard from "../components/ProductCard.jsx";

export default function Favorites() {
  const api = useApi();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get("/favorites");
      setItems(res.data || []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="ds-title">مفضلتي</div>
        <Link to={-1} className="flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-blue-600 transition-colors bg-white px-3 py-1.5 rounded-full border border-gray-100 shadow-sm">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
          </svg>
          العودة
        </Link>
      </div>

      <div className="ds-section p-0">
        <div className="border-b px-4 py-3 bg-gray-50/50">
          <h3 className="text-sm font-bold text-gray-800">الإعلانات المحفوظة ({items.length})</h3>
        </div>
        
        {loading && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <div className="h-8 w-8 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin"></div>
            <p className="text-xs font-bold text-gray-500">جاري التحميل...</p>
          </div>
        )}

        {!loading && items.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
            <div className="h-16 w-16 bg-gray-100 rounded-full flex items-center justify-center text-gray-400 mb-4">
              <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </div>
            <p className="text-sm font-bold text-gray-600 mb-1">لا توجد إعلانات محفوظة</p>
            <p className="text-xs text-gray-400">تصفح الإعلانات وأضف ما يعجبك للمفضلة</p>
            <Link to="/" className="mt-4 ds-btn-primary ds-btn-sm">تصفح الإعلانات</Link>
          </div>
        )}

        {!loading && items.length > 0 && (
          <div className="grid grid-cols-2 gap-3 p-4 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4">
            {items.map((a) => (
              <ProductCard
                key={a._id}
                product={a}
                to={`/ad/${a._id}`}
                featured={!!a.featured}
                governorateName={a.governorateId?.name || ""}
                cityName={a.cityId?.name || ""}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
