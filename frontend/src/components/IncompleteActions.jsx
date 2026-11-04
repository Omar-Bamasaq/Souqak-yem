import React from "react";
import { useNavigate } from "react-router-dom";
import { useApi } from "../api/axios.js";
import { useIncompleteActions } from "../hooks/useDraftActions.js";

const ACTION_DETAILS = {
  store_creation: {
    title: "إنشاء متجرك",
    icon: "🏪",
    route: "/seller/store/create",
    steps: ["اختيار الباقة", "بيانات المتجر", "التصنيفات والموقع", "الدفع"]
  },
  family_production_registration: {
    title: "التسجيل في صناعات سوقك",
    icon: "🧺",
    route: "/family-production/register",
    steps: ["اختيار الباقة", "بيانات المشروع", "التصنيفات والموقع", "الدفع"]
  },
  featured_ad_upgrade: {
    title: "تمييز إعلان",
    icon: "⭐",
    route: "/seller/featured-ad",
    steps: ["اختيار الإعلان والباقة", "الدفع"]
  },
  wallet_service_catalog: {
    title: "طلب خدمة دفع إلكتروني",
    icon: "💳",
    route: "/wallet-services",
    steps: ["اختيار الخدمة", "تفاصيل الطلب"]
  }
};

export default function IncompleteActions({ userId, compact = false }) {
  const api = useApi();
  const navigate = useNavigate();
  const { drafts, error, deleteDraft } = useIncompleteActions(api, userId);
  if (!userId || (!drafts.length && !error)) return null;
  if (!drafts.length) {
    return <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-bold text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">{error}</p>;
  }

  const visibleDrafts = compact ? drafts.slice(0, 2) : drafts;
  return (
    <section className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:rounded-3xl sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-base font-black text-slate-900 dark:text-white">
          {compact ? "أكمل ما بدأت" : "عمليات غير مكتملة"}
        </h2>
        {compact && drafts.length > visibleDrafts.length && (
          <button
            type="button"
            onClick={() => navigate("/seller/subscriptions")}
            className="text-xs font-bold text-blue-700 dark:text-blue-300"
          >
            عرض الكل
          </button>
        )}
      </div>
      {error && <p role="alert" className="mb-3 text-xs font-bold text-red-600">{error}</p>}
      {visibleDrafts.length > 0 && (
        <ul className="space-y-3">
          {visibleDrafts.map((draft) => {
            const details = ACTION_DETAILS[draft.type];
            if (!details) return null;
            const stoppedAt = details.steps[Math.max(0, Math.min(details.steps.length - 1, draft.currentStep - 1))];
            return (
              <li key={draft._id} className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-800">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-xl dark:bg-slate-700" aria-hidden="true">{details.icon}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-black text-slate-900 dark:text-white">{details.title}</p>
                  <p className="mt-0.5 text-xs font-semibold text-slate-500 dark:text-slate-300">توقفت عند {stoppedAt}</p>
                </div>
                <button
                  type="button"
                  onClick={() => navigate(`${details.route}?draftActionId=${encodeURIComponent(draft._id)}`)}
                  className="shrink-0 rounded-lg bg-blue-700 px-3 py-2 text-xs font-black text-white"
                >
                  متابعة
                </button>
                <button
                  type="button"
                  onClick={() => deleteDraft(draft._id)}
                  aria-label={`إغلاق ${details.title}`}
                  title="إغلاق وحذف العملية غير المكتملة"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-lg font-bold text-slate-500 dark:border-slate-600 dark:text-slate-300"
                >
                  ×
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
