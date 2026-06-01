
import React from "react";
import { Link, useNavigate } from "react-router-dom";

export default function ChooseAddType() {
  const navigate = useNavigate();

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:py-20">
      <div className="text-center mb-12">
        <h1 className="text-3xl font-black text-gray-900 mb-4">ماذا تريد أن تفعل اليوم؟</h1>
        <p className="text-gray-600 font-bold">اختر نوع الإعلان الذي ترغب في نشره على منصة سوقك</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Sell Product Option */}
        <button
          onClick={() => navigate("/add-product?type=sell")}
          className="group relative overflow-hidden rounded-[2.5rem] bg-white border-2 border-blue-50 p-8 text-right shadow-xl shadow-blue-100/20 transition-all hover:-translate-y-1 hover:border-blue-500 hover:shadow-2xl hover:shadow-blue-200/40"
        >
          <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 group-hover:bg-blue-500 group-hover:text-white transition-colors">
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-2xl font-black text-gray-900 mb-2">بيع منتج</h2>
          <p className="text-gray-500 font-bold leading-relaxed">أعرض سلعتك للبيع الآن ووصّلها لآلاف المشترين في اليمن</p>
          <div className="mt-6 flex items-center gap-2 text-blue-600 font-black text-sm">
            <span>ابدأ الآن</span>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
          </div>
        </button>

        {/* Request Product Option */}
        <button
          onClick={() => navigate("/add-product?type=order")}
          className="group relative overflow-hidden rounded-[2.5rem] bg-white border-2 border-indigo-50 p-8 text-right shadow-xl shadow-indigo-100/20 transition-all hover:-translate-y-1 hover:border-indigo-500 hover:shadow-2xl hover:shadow-indigo-200/40"
        >
          <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 group-hover:bg-indigo-500 group-hover:text-white transition-colors">
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <h2 className="text-2xl font-black text-gray-900 mb-2">طلب منتج</h2>
          <p className="text-gray-500 font-bold leading-relaxed">تبحث عن شيء معين؟ أضف طلبك ودع البائعين يتواصلون معك</p>
          <div className="mt-6 flex items-center gap-2 text-indigo-600 font-black text-sm">
            <span>أضف طلبك</span>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
          </div>
        </button>
      </div>

      <div className="mt-12 flex justify-center">
        <Link to="/" className="text-gray-400 hover:text-gray-600 font-bold text-sm transition-colors">إلغاء والعودة للرئيسية</Link>
      </div>
    </div>
  );
}
