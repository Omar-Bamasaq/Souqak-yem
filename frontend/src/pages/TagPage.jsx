import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useApi } from "../api/axios.js";
import ProductCard from "../components/ProductCard.jsx";

export default function TagPage() {
  const { slug } = useParams();
  const api = useApi();
  const [tag, setTag] = useState(null);
  const [ads, setAds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    setPage(1);
    setAds([]);
    setError(null);
    loadTag();
  }, [slug]);

  useEffect(() => {
    if (tag) {
      loadAds();
    }
  }, [tag, page]);

  const loadTag = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/tags/${slug}`);
      setTag(response.data);
    } catch (error) {
      console.error("Error loading tag:", error);
      setError(error.response?.data?.error || "تعذر تحميل الوسم");
    } finally {
      setLoading(false);
    }
  };

  const loadAds = async () => {
    if (!tag) return;
    try {
      const limit = 20;
      const response = await api.get(`/tags/${slug}/ads`, {
        params: { page, limit }
      });

      const responseData = response.data || {};
      const newAds = responseData.items || [];
      setAds(prev => page === 1 ? newAds : [...prev, ...newAds]);
      setHasMore(newAds.length === limit);
    } catch (error) {
      console.error("Error loading ads:", error);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-48 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-red-600 mb-4">خطأ</h1>
        <p className="text-gray-600 mb-4">{error}</p>
        <Link to="/" className="text-emerald-600 hover:underline">
          العودة إلى الصفحة الرئيسية
        </Link>
      </div>
    );
  }

  if (!tag) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">الوسم غير موجود</h1>
        <p className="text-gray-600 mb-4">لا يمكن العثور على الوسم المطلوب</p>
        <Link to="/" className="text-emerald-600 hover:underline">
          العودة إلى الصفحة الرئيسية
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Breadcrumbs */}
      <nav className="mb-4 text-sm text-gray-500">
        <Link to="/" className="hover:text-emerald-600">الرئيسية</Link>
        <span className="mx-2">/</span>
        <span className="text-gray-900">وسم: {tag.name}</span>
      </nav>

      {/* Tag Header */}
      <div 
        className="rounded-lg shadow-sm p-6 mb-8 text-white"
        style={{ backgroundColor: tag.color || "#6366f1" }}
      >
        <h1 className="text-3xl font-bold mb-2">#{tag.name}</h1>
        {tag.description && <p className="opacity-90">{tag.description}</p>}
      </div>

      {/* Ads Grid */}
      {ads.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500">لا توجد إعلانات بهذا الوسم</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {ads.map((ad) => (
              <ProductCard key={ad._id} product={ad} featured={!!ad.featured} to={`/ad/${ad._id}`} />
            ))}
          </div>

          {hasMore && (
            <div className="mt-8 text-center">
              <button
                onClick={() => setPage(p => p + 1)}
                className="rounded-md bg-emerald-600 px-6 py-2 text-white hover:bg-emerald-700"
              >
                تحميل المزيد
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
