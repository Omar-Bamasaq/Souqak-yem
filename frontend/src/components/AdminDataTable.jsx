import React from "react";
import LoadingSpinner from "./LoadingSpinner.jsx";

const AdminDataTable = ({
  headers,
  data,
  loading,
  pagination,
  onPageChange,
  emptyMessage = "لا توجد بيانات لعرضها"
}) => {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 md:py-20 bg-white dark:bg-slate-900 rounded-2xl border dark:border-slate-800">
        <LoadingSpinner size="lg" />
        <p className="mt-4 text-gray-500 font-bold text-sm md:text-base">جاري تحميل البيانات...</p>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 md:py-20 bg-white dark:bg-slate-900 rounded-2xl border dark:border-slate-800">
        <svg className="h-12 w-12 md:h-16 md:w-16 text-gray-300 dark:text-slate-700 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
        </svg>
        <p className="text-gray-500 font-black text-sm md:text-lg">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border dark:border-slate-800 overflow-hidden shadow-sm">
      {/* Mobile-friendly horizontal scroll container */}
      <div className="overflow-x-auto -webkit-overflow-scrolling-touch">
        <table className="w-full text-right border-collapse min-w-[600px] md:min-w-0">
          <thead>
            <tr className="bg-gray-50 dark:bg-slate-800/50 border-b dark:border-slate-700">
              {headers.map((header, idx) => (
                <th key={idx} className="px-3 md:px-6 py-3 md:py-4 text-xs md:text-sm font-black text-gray-600 dark:text-slate-400 whitespace-nowrap">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y dark:divide-slate-800">
            {data.map((row, rowIdx) => (
              <tr key={rowIdx} className="hover:bg-gray-50 dark:hover:bg-slate-800/30 transition-colors">
                {row.map((cell, cellIdx) => (
                  <td key={cellIdx} className="px-3 md:px-6 py-3 md:py-4 text-xs md:text-sm text-gray-700 dark:text-slate-300">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile-friendly Pagination */}
      {pagination && pagination.pages > 1 && (
        <div className="px-4 py-3 md:px-6 md:py-4 bg-gray-50 dark:bg-slate-800/50 border-t dark:border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            disabled={pagination.page === 1}
            onClick={() => onPageChange(pagination.page - 1)}
            className="w-full sm:w-auto px-4 py-2.5 text-sm font-bold text-gray-600 dark:text-slate-400 bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-xl disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-slate-800 transition-all active:scale-95"
          >
            <span className="flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              السابق
            </span>
          </button>

          <div className="flex items-center gap-2 text-xs md:text-sm font-bold text-gray-500">
            <span className="px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg border border-blue-100 dark:border-blue-800">
              {pagination.page}
            </span>
            <span className="text-gray-400">من</span>
            <span className="px-3 py-1.5 bg-gray-100 dark:bg-slate-800 rounded-lg">
              {pagination.pages}
            </span>
          </div>

          <button
            disabled={pagination.page === pagination.pages}
            onClick={() => onPageChange(pagination.page + 1)}
            className="w-full sm:w-auto px-4 py-2.5 text-sm font-bold text-gray-600 dark:text-slate-400 bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-xl disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-slate-800 transition-all active:scale-95"
          >
            <span className="flex items-center justify-center gap-2">
              التالي
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </span>
          </button>
        </div>
      )}
    </div>
  );
};

export default AdminDataTable;
