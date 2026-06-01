import React from "react";

export default function FeatureCard({ title, icon }) {
  return (
    <div className="rounded-xl border bg-white p-5 shadow-sm transition hover:shadow-md">
      <div className="mb-3 inline-flex items-center justify-center rounded-lg bg-brand-50 p-3 text-brand-700">
        {icon}
      </div>
      <div className="text-sm font-semibold text-gray-900">{title}</div>
    </div>
  );
}
