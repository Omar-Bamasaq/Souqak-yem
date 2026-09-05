import React from "react";

export default function LoadingSpinner({ size = "md", className = "", fullPage = false }) {
  const sizes = {
    xs: "h-4 w-4",
    sm: "h-5 w-5",
    md: "h-8 w-8",
    lg: "h-10 w-10"
  };
  const s = sizes[size] || sizes.md;
  const wrapperClassName = fullPage ? "min-h-screen flex items-center justify-center" : "";
  return <div className={wrapperClassName}><div className={`${s} animate-spin rounded-full border-2 border-gray-300 border-t-brand-600 ${className}`} /></div>;
}
