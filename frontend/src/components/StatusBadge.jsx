import React from "react";

const StatusBadge = ({ status, className = "" }) => {
  const statusConfig = {
    // Ad Statuses
    active: { label: "نشط", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
    approved: { label: "معتمد", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
    pending: { label: "قيد المراجعة", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" },
    rejected: { label: "مرفوض", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
    sold: { label: "مباع", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
    SOLD: { label: "مباع", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
    archived: { label: "مؤرشف", color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400" },
    deleted: { label: "محذوف", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
    blocked: { label: "محظور", color: "bg-red-200 text-red-800 dark:bg-red-900/50 dark:text-red-300" },
    reported: { label: "مبلغ عنه", color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
    
    // Financial Statuses
    paid: { label: "مدفوع", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
    unpaid: { label: "غير مدفوع", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
    overdue: { label: "متأخر", color: "bg-red-200 text-red-800 dark:bg-red-900/50 dark:text-red-300" },
    refunded: { label: "مسترجع", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" },
    
    // Verification Statuses
    verified: { label: "موثق", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
    
    // General
    open: { label: "مفتوح", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
    closed: { label: "مغلق", color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400" },
  };

  const config = statusConfig[status] || { label: status, color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400" };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${config.color} ${className}`}>
      {config.label}
    </span>
  );
};

export default StatusBadge;
