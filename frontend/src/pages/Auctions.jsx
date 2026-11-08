import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useApi } from "../api/axios.js";
import { useAuth } from "../store/AuthContext.jsx";
import AuctionCard from "../components/AuctionCard.jsx";
import { getAuctionError, unpackList } from "../utils/auctionFormat.js";

export default function Auctions() {
  const api = useApi();
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [governorates, setGovernorates] = useState([]);
  const [searchInput, setSearchInput] = useState("");
  const [filters, setFilters] = useState({
    q: "",
    categoryId: "",
    governorateId: "",
    status: "",
    sort: "endingSoon"
  });
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([
      api.get("/categories", { params: { flat: true } }),
      api.get("/governorates", { params: { active: true } })
    ])
      .then(([categoryResponse, governorateResponse]) => {
        if (!active) return;
        setCategories(unpackList(categoryResponse.data));
        setGovernorates(unpackList(governorateResponse.data));
      })
      .catch((requestError) => {
        if (active) setError(getAuctionError(requestError));
      });
    return () => {
      active = false;
    };
  }, [api]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    api
      .get("/auctions", {
        params: { ...filters, page, pageSize: 20 }
      })
      .then((response) => {
        if (!active) return;
        setItems(response.data.items || []);
        setPagination(response.data.pagination || { total: 0, totalPages: 0 });
      })
      .catch((requestError) => {
        if (active) setError(getAuctionError(requestError));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [api, filters, page]);

  const updateFilter = (name, value) => {
    setPage(1);
    setFilters((current) => ({ ...current, [name]: value }));
  };

  const submitSearch = (event) => {
    event.preventDefault();
    updateFilter("q", searchInput.trim());
  };

  return (
    <section dir="rtl" className="space-y-5">
      <header className="flex flex-col justify-between gap-3 rounded-2xl bg-white p-5 shadow-sm dark:bg-slate-900 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">مزادات سوقك</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            تابع المزادات المعتمدة وشارك بعروضك.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {user && (
            <Link
              to="/my-auctions"
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              مزاداتي
            </Link>
          )}
          <Link
            to="/auctions/new"
            className="rounded-xl bg-blue-700 px-4 py-2 text-sm font-bold text-white hover:bg-blue-800"
          >
            إنشاء مزاد
          </Link>
        </div>
      </header>

      <form
        onSubmit={submitSearch}
        className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900 sm:grid-cols-2 lg:grid-cols-5"
      >
        <label className="sm:col-span-2 lg:col-span-2">
          <span className="mb-1 block text-xs font-bold text-slate-600 dark:text-slate-300">بحث</span>
          <input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
            placeholder="ابحث عن سلعة أو مزاد"
          />
        </label>
        <label>
          <span className="mb-1 block text-xs font-bold text-slate-600 dark:text-slate-300">الفئة</span>
          <select
            value={filters.categoryId}
            onChange={(event) => updateFilter("categoryId", event.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
          >
            <option value="">كل الفئات</option>
            {categories.map((category) => (
              <option key={category._id || category.id} value={category._id || category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="mb-1 block text-xs font-bold text-slate-600 dark:text-slate-300">المحافظة</span>
          <select
            value={filters.governorateId}
            onChange={(event) => updateFilter("governorateId", event.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
          >
            <option value="">كل المحافظات</option>
            {governorates.map((governorate) => (
              <option key={governorate._id} value={governorate._id}>{governorate.name}</option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label>
            <span className="mb-1 block text-xs font-bold text-slate-600 dark:text-slate-300">الحالة</span>
            <select
              value={filters.status}
              onChange={(event) => updateFilter("status", event.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-2 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
            >
              <option value="">الكل</option>
              <option value="live">مباشر</option>
              <option value="scheduled">قريبًا</option>
              <option value="ended">منتهٍ</option>
            </select>
          </label>
          <label>
            <span className="mb-1 block text-xs font-bold text-slate-600 dark:text-slate-300">الترتيب</span>
            <select
              value={filters.sort}
              onChange={(event) => updateFilter("sort", event.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-2 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
            >
              <option value="endingSoon">الأقرب انتهاءً</option>
              <option value="newest">الأحدث</option>
              <option value="priceLow">السعر الأقل</option>
              <option value="priceHigh">السعر الأعلى</option>
            </select>
          </label>
        </div>
        <button
          type="submit"
          className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-700 dark:bg-blue-700 dark:hover:bg-blue-600 sm:col-span-2 lg:col-span-5"
        >
          بحث
        </button>
      </form>

      {error && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}
      {loading ? (
        <p className="py-10 text-center text-sm text-slate-500">جارٍ تحميل المزادات…</p>
      ) : items.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((auction) => <AuctionCard key={auction.id} auction={auction} />)}
        </div>
      ) : (
        <p className="rounded-2xl bg-white p-8 text-center text-slate-600 dark:bg-slate-900 dark:text-slate-300">
          لا توجد مزادات مطابقة لخيارات البحث.
        </p>
      )}

      <nav aria-label="صفحات المزادات" className="flex items-center justify-center gap-3">
        <button
          type="button"
          disabled={page <= 1 || loading}
          onClick={() => setPage((value) => Math.max(1, value - 1))}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:opacity-50 dark:border-slate-700"
        >
          السابق
        </button>
        <span className="text-sm text-slate-600 dark:text-slate-300">
          {page} من {Math.max(1, pagination.totalPages)}
        </span>
        <button
          type="button"
          disabled={loading || page >= pagination.totalPages}
          onClick={() => setPage((value) => value + 1)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:opacity-50 dark:border-slate-700"
        >
          التالي
        </button>
      </nav>
    </section>
  );
}
