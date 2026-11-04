import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useApi } from "../api/axios.js";
import ProductCard from "../components/ProductCard.jsx";
import { uploadsUrl } from "../lib/uploads.js";

const PAGE_SIZE = 12;

export default function StoreDirectory({ storeType = "store" }) {
  const api = useApi();
  const [searchParams, setSearchParams] = useSearchParams();
  const view = searchParams.get("view") === "discounts" ? "discounts" : "stores";
  const isFamilyProduction = storeType === "family-production";
  const heading = isFamilyProduction ? "الأسر المنتجة" : "متاجر سوقك";
  const createPath = isFamilyProduction ? "/family-production/register" : "/seller/store/create";
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [filterError, setFilterError] = useState("");
  const [locationError, setLocationError] = useState("");
  const [activities, setActivities] = useState([]);
  const [governorates, setGovernorates] = useState([]);
  const [cities, setCities] = useState([]);
  const activityKey = searchParams.get("activityKey") || "";
  const governorateId = searchParams.get("governorateId") || "";
  const cityId = searchParams.get("cityId") || "";
  const directoryParams = { storeType, view, activityKey, governorateId, cityId };

  useEffect(() => {
    let active = true;
    Promise.all([
      api.get("/stores/activities", { params: { type: storeType } }),
      api.get("/governorates", { params: { active: true } })
    ]).then(([activityResponse, governorateResponse]) => {
      if (!active) return;
      setActivities(activityResponse.data || []);
      setGovernorates(governorateResponse.data || []);
      setFilterError("");
    }).catch((requestError) => {
      if (active) setFilterError(requestError.response?.data?.error || "تعذر تحميل خيارات التصفية.");
    });
    return () => { active = false; };
  }, [api, storeType]);

  useEffect(() => {
    if (!governorateId) {
      setCities([]);
      setLocationError("");
      return undefined;
    }
    let active = true;
    api.get("/cities", { params: { governorateId, active: true } })
      .then(({ data }) => {
        if (active) {
          setCities(data || []);
          if (cityId && !(data || []).some((city) => city._id === cityId)) {
            updateFilters({ cityId: "" });
          }
          setLocationError("");
        }
      })
      .catch((requestError) => {
        if (active) setLocationError(requestError.response?.data?.error || "تعذر تحميل مدن المحافظة.");
      });
    return () => { active = false; };
  }, [api, governorateId, cityId]);

  useEffect(() => {
    let active = true;
    setItems([]);
    setPage(1);
    setHasNextPage(false);
    setLoading(true);
    setError("");

    api.get("/stores/directory", {
      params: { ...directoryParams, page: 1, limit: PAGE_SIZE }
    }).then(({ data }) => {
      if (!active) return;
      setItems(data.items || []);
      setHasNextPage(data.pagination?.hasNextPage === true);
    }).catch((requestError) => {
      if (!active) return;
      setError(requestError.response?.data?.error || "تعذر تحميل البيانات. حاول مرة أخرى.");
    }).finally(() => {
      if (active) setLoading(false);
    });

    return () => { active = false; };
  }, [api, storeType, view, activityKey, governorateId, cityId]);

  const loadMore = async () => {
    if (loadingMore || !hasNextPage) return;
    const nextPage = page + 1;
    setLoadingMore(true);
    setError("");
    try {
      const { data } = await api.get("/stores/directory", {
        params: { ...directoryParams, page: nextPage, limit: PAGE_SIZE }
      });
      setItems((current) => [...current, ...(data.items || [])]);
      setPage(nextPage);
      setHasNextPage(data.pagination?.hasNextPage === true);
    } catch (requestError) {
      setError(requestError.response?.data?.error || "تعذر تحميل المزيد.");
    } finally {
      setLoadingMore(false);
    }
  };

  const selectView = (nextView) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (nextView === "stores") next.delete("view");
      else next.set("view", nextView);
      return next;
    });
  };

  const updateFilters = (updates) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      Object.entries(updates).forEach(([key, value]) => {
        if (value) next.set(key, value);
        else next.delete(key);
      });
      return next;
    });
  };

  return (
    <section dir="rtl" className="mx-auto max-w-6xl space-y-5 sm:space-y-7">
      <header className={`rounded-2xl p-4 text-white shadow-lg sm:rounded-3xl sm:p-7 ${isFamilyProduction ? "bg-gradient-to-l from-fuchsia-800 via-purple-700 to-pink-700" : "bg-gradient-to-l from-blue-900 via-blue-800 to-cyan-700"}`}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold text-white/75 sm:text-sm">اكتشف المشاريع والمتاجر في سوقك</p>
            <h1 className="mt-1 text-2xl font-black sm:text-3xl">{heading}</h1>
            <p className="mt-1 text-xs leading-5 text-white/85 sm:text-sm">
              {view === "discounts" ? "تصفح المنتجات المخفضة من المتاجر والمشاريع المعتمدة." : "تصفح الجهات المعتمدة وزر صفحاتها للتعرف على منتجاتها."}
            </p>
          </div>
          <Link
            to={createPath}
            className="inline-flex min-h-10 items-center justify-center rounded-xl bg-white px-4 py-2 text-sm font-black text-slate-900 shadow-md transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            {isFamilyProduction ? "أنشئ مشروع أسرتك" : "إنشاء متجري"}
          </Link>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1.5 dark:bg-slate-800">
        <button
          type="button"
          aria-pressed={view === "stores"}
          onClick={() => selectView("stores")}
          className={`min-h-11 rounded-xl px-3 py-2 text-sm font-black transition ${view === "stores" ? "bg-white text-blue-800 shadow-sm dark:bg-slate-700 dark:text-white" : "text-slate-600 hover:bg-white/70 dark:text-slate-300 dark:hover:bg-slate-700/70"}`}
        >
          {isFamilyProduction ? "المشاريع" : "المتاجر"}
        </button>
        <button
          type="button"
          aria-pressed={view === "discounts"}
          onClick={() => selectView("discounts")}
          className={`min-h-11 rounded-xl px-3 py-2 text-sm font-black transition ${view === "discounts" ? "bg-white text-blue-800 shadow-sm dark:bg-slate-700 dark:text-white" : "text-slate-600 hover:bg-white/70 dark:text-slate-300 dark:hover:bg-slate-700/70"}`}
        >
          العروض والتخفيضات
        </button>
      </div>

      <section aria-label="تصفية النتائج" className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-black text-slate-800 dark:text-white">تصفية {view === "discounts" ? "التخفيضات" : (isFamilyProduction ? "المشاريع" : "المتاجر")}</h2>
          {(activityKey || governorateId || cityId) && (
            <button type="button" onClick={() => updateFilters({ activityKey: "", governorateId: "", cityId: "" })} className="text-xs font-bold text-blue-700 hover:underline dark:text-blue-300">
              مسح التصفية
            </button>
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="text-xs font-bold text-slate-600 dark:text-slate-300">
            النشاط
            <select value={activityKey} onChange={(event) => updateFilters({ activityKey: event.target.value })} className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white">
              <option value="">كل الأنشطة</option>
              {activities.map((activity) => <option key={activity.activityKey} value={activity.activityKey}>{activity.nameAr}</option>)}
            </select>
          </label>
          <label className="text-xs font-bold text-slate-600 dark:text-slate-300">
            المحافظة
            <select value={governorateId} onChange={(event) => updateFilters({ governorateId: event.target.value, cityId: "" })} className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white">
              <option value="">كل المحافظات</option>
              {governorates.map((governorate) => <option key={governorate._id} value={governorate._id}>{governorate.name}</option>)}
            </select>
          </label>
          <label className="text-xs font-bold text-slate-600 dark:text-slate-300">
            المدينة
            <select value={cityId} disabled={!governorateId} onChange={(event) => updateFilters({ cityId: event.target.value })} className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-white">
              <option value="">{governorateId ? "كل المدن" : "اختر المحافظة أولًا"}</option>
              {cities.map((city) => <option key={city._id} value={city._id}>{city.name}</option>)}
            </select>
          </label>
        </div>
        {filterError && <p role="alert" className="mt-3 text-xs font-bold text-rose-700 dark:text-rose-300">{filterError}</p>}
        {locationError && <p role="alert" className="mt-3 text-xs font-bold text-rose-700 dark:text-rose-300">{locationError}</p>}
      </section>

      {error && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      )}

      {loading ? (
        <div className={view === "stores" ? "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" : "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"}>
          {Array.from({ length: 8 }, (_, index) => (
            <div key={index} className="h-36 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800 sm:h-48" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-12 text-center dark:border-slate-700">
          <p className="font-bold text-slate-600 dark:text-slate-300">
            {view === "discounts" ? "لا توجد عروض أو تخفيضات متاحة حاليًا." : `لا توجد ${isFamilyProduction ? "مشاريع أسر منتجة" : "متاجر"} متاحة حاليًا.`}
          </p>
        </div>
      ) : view === "stores" ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
          {items.map((store) => (
            <Link
              key={store._id}
              to={`/store/${encodeURIComponent(store.slug)}`}
              className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md dark:border-slate-700 dark:bg-slate-900"
            >
              <div className="relative h-24 bg-slate-100 dark:bg-slate-800 sm:h-32">
                {store.cover ? (
                  <img src={uploadsUrl(store.cover, "thumb")} alt="" className="h-full w-full object-cover" loading="lazy" />
                ) : (
                  <div className="h-full bg-gradient-to-br from-blue-100 to-cyan-50 dark:from-slate-700 dark:to-slate-800" />
                )}
                <div className="absolute bottom-2 right-3 flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl border-2 border-white bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800 sm:h-14 sm:w-14">
                  {store.logo ? (
                    <img src={uploadsUrl(store.logo, "thumb")} alt="" className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <span aria-hidden="true" className="text-xl font-black text-blue-700">{store.storeName?.slice(0, 1) || "س"}</span>
                  )}
                </div>
              </div>
              <div className="p-3 pt-4 sm:p-4 sm:pt-5">
                <h2 className="line-clamp-1 text-sm font-black text-slate-900 group-hover:text-blue-700 dark:text-white dark:group-hover:text-blue-300 sm:text-base">{store.storeName}</h2>
                <p className="mt-1 line-clamp-1 text-xs font-semibold text-slate-500 dark:text-slate-400">{store.businessActivity}</p>
                {store.location && <p className="mt-2 line-clamp-1 text-[11px] text-slate-500 dark:text-slate-400">{store.location}</p>}
                <span className="mt-3 inline-flex text-xs font-black text-blue-700 dark:text-blue-300">زيارة {isFamilyProduction ? "المشروع" : "المتجر"} ←</span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-1.5 sm:gap-2">
          {items.map((product) => (
            <ProductCard
              key={product._id}
              product={product}
              to={`/ad/${product._id}`}
              governorateName={product.governorateId?.name || ""}
              cityName={product.cityId?.name || ""}
              featured={product.featured}
              displayMode="list"
            />
          ))}
        </div>
      )}

      {!loading && hasNextPage && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={loadMore}
            disabled={loadingMore}
            className="min-h-11 rounded-xl border border-slate-200 bg-white px-6 py-2 text-sm font-black text-slate-700 shadow-sm transition hover:border-blue-300 hover:text-blue-700 disabled:cursor-wait disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            {loadingMore ? "جارٍ التحميل..." : "عرض المزيد"}
          </button>
        </div>
      )}
    </section>
  );
}
