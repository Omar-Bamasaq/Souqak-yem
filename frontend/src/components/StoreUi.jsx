import React from "react";

const STATUS_STYLES = {
  new: "border-blue-200 bg-blue-50 text-blue-800",
  processing: "border-amber-200 bg-amber-50 text-amber-800",
  completed: "border-emerald-200 bg-emerald-50 text-emerald-800",
  cancelled: "border-rose-200 bg-rose-50 text-rose-800",
  active: "border-emerald-200 bg-emerald-50 text-emerald-800",
  expired: "border-rose-200 bg-rose-50 text-rose-800",
  pending: "border-amber-200 bg-amber-50 text-amber-800",
  suspended: "border-amber-200 bg-amber-50 text-amber-800",
  rejected: "border-rose-200 bg-rose-50 text-rose-800",
  archived: "border-slate-200 bg-slate-100 text-slate-600",
  hidden: "border-slate-200 bg-slate-100 text-slate-600",
  sold: "border-slate-200 bg-slate-100 text-slate-600",
  inactive: "border-slate-200 bg-slate-50 text-slate-700"
};

export function StoreStatusBadge({ status, label }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-extrabold ${STATUS_STYLES[status] || STATUS_STYLES.inactive}`}>
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}

export function StoreEmptyState({ title, description, action }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 px-5 py-10 text-center">
      <span aria-hidden="true" className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-slate-500 shadow-sm">
        <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 7.5 5 4h14l2 3.5M4 7.5h16v12H4zM9 12h6" />
        </svg>
      </span>
      <h3 className="text-base font-extrabold text-slate-900">{title}</h3>
      {description && <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function StoreStatCard({ label, value, detail, icon, tone = "blue" }) {
  const tones = {
    blue: "bg-blue-50 text-blue-700 ring-blue-100",
    violet: "bg-violet-50 text-violet-700 ring-violet-100",
    emerald: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    amber: "bg-amber-50 text-amber-700 ring-amber-100"
  };
  return (
    <article className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-bold text-slate-500 sm:text-sm">{label}</p>
          <div className="mt-2 break-words text-xl font-black leading-tight tracking-tight text-slate-950 sm:text-2xl">{value}</div>
        </div>
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ${tones[tone] || tones.blue}`}>
          {icon}
        </span>
      </div>
      {detail && <p className="mt-3 line-clamp-2 text-xs font-semibold leading-5 text-slate-500">{detail}</p>}
    </article>
  );
}

export function StoreLoadingCards({ count = 3 }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="جارٍ التحميل" aria-busy="true">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="ds-skeleton h-4 w-1/3" />
          <div className="ds-skeleton mt-4 h-8 w-1/2" />
          <div className="ds-skeleton mt-4 h-3 w-2/3" />
        </div>
      ))}
    </div>
  );
}
