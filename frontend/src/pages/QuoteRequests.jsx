import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useApi } from "../api/axios.js";
import { useAuth } from "../store/AuthContext.jsx";
import { uploadsUrl } from "../lib/uploads.js";

const emptyFilters = { q: "", governorateId: "", cityId: "", categoryId: "", from: "", to: "", sort: "newest" };
const statusLabels = { open: "يستقبل عروضًا", closed: "مغلق", cancelled: "ملغي", awarded: "تم اختيار عرض" };

function RequestCard({ item, mode }) {
  const offer = mode === "offers" ? item.offers?.[0] : null;
  return (
    <Link to={`/quote-requests/${item._id}`} className="block rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md dark:border-slate-700 dark:bg-slate-800">
      <div className="flex gap-4">
        {item.image && <img src={uploadsUrl(item.image, "thumb")} alt="" className="h-20 w-20 rounded-xl object-cover" />}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-black text-slate-900 dark:text-white">{item.itemName}</h2>
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${item.status === "open" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
              {statusLabels[item.status] || item.status}
            </span>
          </div>
          <p className="mt-2 line-clamp-2 text-sm text-slate-600 dark:text-slate-300">{item.description || item.specifications || "لا توجد تفاصيل إضافية."}</p>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
            <span>الكمية: {Number(item.quantity).toLocaleString("ar")}</span>
            <span>{item.governorateId?.name} - {item.cityId?.name}</span>
            {item.categoryId?.name && <span>{item.categoryId.name}</span>}
            {mode === "offers" ? (
              <span className="font-bold text-blue-700">عرضك: {Number(offer?.price || 0).toLocaleString("ar")} {offer?.currency}</span>
            ) : mode === "mine" ? (
              <span>{item.offers?.length || 0} عروض</span>
            ) : <span>عرض التفاصيل</span>}
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function QuoteRequests() {
  const api = useApi();
  const location = useLocation();
  const { user } = useAuth();
  const mode = location.pathname === "/my-quote-requests" ? "mine" : location.pathname === "/my-quote-offers" ? "offers" : "public";
  const [filters, setFilters] = useState(emptyFilters);
  const [items, setItems] = useState([]);
  const [governorates, setGovernorates] = useState([]);
  const [cities, setCities] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      api.get("/governorates", { params: { active: true } }),
      api.get("/categories", { params: { flat: "true" } })
    ]).then(([governorateResponse, categoryResponse]) => {
      setGovernorates(governorateResponse.data || []);
      setCategories(categoryResponse.data || []);
    }).catch(() => setError("تعذر تحميل خيارات البحث."));
  }, [api]);

  useEffect(() => {
    if (!filters.governorateId) {
      setCities([]);
      return;
    }
    api.get("/cities", { params: { governorateId: filters.governorateId, active: true } })
      .then(({ data }) => setCities(data || []))
      .catch(() => setCities([]));
  }, [api, filters.governorateId]);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value && key !== "sort") params.set(key, value);
    });
    if (filters.sort) params.set("sort", filters.sort);
    return params.toString();
  }, [filters]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    const endpoint = mode === "mine" ? "/quote-requests/mine" : mode === "offers" ? "/quote-requests/offers/mine" : `/quote-requests?${query}`;
    api.get(endpoint).then(({ data }) => {
      if (active) setItems(Array.isArray(data) ? data : data.items || []);
    }).catch((requestError) => {
      if (active) setError(requestError.response?.data?.error || "تعذر تحميل طلبات التسعير.");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [api, mode, query]);

  const heading = mode === "mine" ? "طلباتي" : mode === "offers" ? "عروضي" : "تسعيرة سوقك";
  return (
    <section dir="rtl" className="mx-auto max-w-5xl space-y-5">
      <h1 className="sr-only">{heading}</h1>
      <nav aria-label="روابط تسعيرة سوقك" className="flex flex-wrap gap-2">
        {user && <Link to="/my-quote-requests" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">طلباتي</Link>}
        {user && <Link to="/my-quote-offers" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">عروضي</Link>}
        <Link to="/quote-requests/new" className="rounded-xl bg-amber-400 px-4 py-2 text-sm font-black text-blue-950 shadow-sm transition hover:bg-amber-300">+ اطلب تسعيرة</Link>
      </nav>

      {mode === "public" && (
        <div className="grid grid-cols-2 gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:grid-cols-4 dark:border-slate-700 dark:bg-slate-800">
          <input value={filters.q} onChange={(event) => setFilters({ ...filters, q: event.target.value })} placeholder="ابحث عن سلعة..." className="rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900" />
          <select value={filters.governorateId} onChange={(event) => setFilters({ ...filters, governorateId: event.target.value, cityId: "" })} className="rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900">
            <option value="">كل المحافظات</option>{governorates.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}
          </select>
          <select value={filters.cityId} disabled={!filters.governorateId} onChange={(event) => setFilters({ ...filters, cityId: event.target.value })} className="rounded-xl border border-slate-200 px-3 py-2 text-sm disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900">
            <option value="">كل المدن</option>{cities.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}
          </select>
          <select value={filters.categoryId} onChange={(event) => setFilters({ ...filters, categoryId: event.target.value })} className="rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900">
            <option value="">كل التصنيفات</option>{categories.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}
          </select>
          <label className="text-xs font-bold text-slate-600 dark:text-slate-300">من تاريخ<input type="date" value={filters.from} onChange={(event) => setFilters({ ...filters, from: event.target.value })} className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900" /></label>
          <label className="text-xs font-bold text-slate-600 dark:text-slate-300">إلى تاريخ<input type="date" value={filters.to} onChange={(event) => setFilters({ ...filters, to: event.target.value })} className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900" /></label>
          <select value={filters.sort} onChange={(event) => setFilters({ ...filters, sort: event.target.value })} className="self-end rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900">
            <option value="newest">الأحدث أولًا</option><option value="oldest">الأقدم أولًا</option>
          </select>
          <button onClick={() => setFilters(emptyFilters)} className="self-end rounded-xl bg-slate-100 px-3 py-2 text-sm font-bold text-slate-700 dark:bg-slate-700 dark:text-white">مسح الفلاتر</button>
        </div>
      )}

      {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm font-bold text-red-700">{error}</p>}
      {loading ? <p className="py-10 text-center text-slate-500">جارٍ تحميل الطلبات...</p> : items.length ? (
        <div className="grid gap-3">{items.map((item) => <RequestCard key={item._id} item={item} mode={mode} />)}</div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 sm:p-10">
          {mode === "public" ? "لا توجد طلبات مطابقة حاليًا." : mode === "mine" ? "لم تنشئ طلب تسعير بعد." : "لم تقدم أي عروض بعد."}
        </div>
      )}
    </section>
  );
}
