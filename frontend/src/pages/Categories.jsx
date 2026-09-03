import React from "react";
import { Link } from "react-router-dom";
import { useMainCategories } from "../hooks/useMainCategories.js";

import { uploadsUrl } from "../lib/uploads.js";

export default function Categories() {
  const { data: categories = [], isLoading: loading } = useMainCategories();

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="h-8 bg-gray-200 rounded w-48 mb-8 animate-pulse"></div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
          {[...Array(12)].map((_, i) => (
            <div key={i} className="aspect-square bg-gray-200 rounded-3xl animate-pulse"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <div className="flex items-center gap-3">
        <div className="h-8 w-1.5 bg-blue-600 rounded-full"></div>
        <h1 className="text-2xl md:text-3xl font-black text-gray-900">تصفح جميع الفئات</h1>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
        {categories.map((category) => (
          <Link
            key={category.id}
            to={`/category/${category.slug}`}
            className="group relative overflow-hidden flex flex-col items-center p-6 rounded-[2.5rem] bg-white border border-gray-100 shadow-sm transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl hover:shadow-blue-500/10 hover:border-blue-100"
          >
            {/* Icon/Image Container */}
            <div className="relative mb-5">
              <div className="absolute inset-0 bg-blue-500/5 rounded-3xl scale-0 group-hover:scale-150 transition-transform duration-700"></div>
              {category.image ? (
                <img
                  src={uploadsUrl(category.image)}
                  alt={category.name}
                  loading="lazy"
                  className="relative z-10 w-20 h-20 object-contain rounded-2xl transition-transform duration-500 group-hover:scale-110"
                />
              ) : (
                <div className="relative z-10 w-20 h-20 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-300 group-hover:bg-blue-50 group-hover:text-blue-500 transition-colors">
                  <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </div>
              )}
            </div>

            <h3 className="relative z-10 text-sm md:text-base font-black text-gray-900 group-hover:text-blue-600 transition-colors text-center w-full px-1 line-clamp-2 min-h-[2.5rem] flex items-center justify-center">
              {category.name}
            </h3>
            
            <div className="relative z-10 mt-2 flex items-center gap-1.5 px-3 py-1 rounded-full bg-gray-50 group-hover:bg-blue-50 transition-colors">
              <span className="text-[11px] font-black text-gray-400 group-hover:text-blue-500">
                {(category.adCount || 0).toLocaleString("ar-EG")} إعلان
              </span>
            </div>

            {/* Decorative element */}
            <div className="absolute -bottom-4 -right-4 h-20 w-20 bg-blue-500/5 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
          </Link>
        ))}
      </div>

      {categories.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="h-20 w-20 bg-gray-50 rounded-full flex items-center justify-center mb-4 text-gray-200">
            <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </div>
          <p className="text-gray-500 font-bold">لا توجد فئات متاحة حالياً</p>
        </div>
      )}
    </div>
  );
}
