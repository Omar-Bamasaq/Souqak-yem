import React, { useState } from "react";
import { uploadsUrl } from "../lib/uploads.js";

const CURRENCY_INFO = {
  YER_ADEN: { label: "يمني (عدن)", flag: "🇾🇪" },
  YER_SANAA: { label: "يمني (صنعاء)", flag: "🇾🇪" },
  SAR: { label: "سعودي", flag: "🇸🇦" },
  USD: { label: "دولار", flag: "🇺🇸" },
  YER: { label: "يمني", flag: "🇾🇪" }
};

export default function BankAccountsDisplay({ banks }) {
  const [openIndex, setOpenIndex] = useState(-1);

  const handleCopy = (number, e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(number);
    window.dispatchEvent(new CustomEvent("app:toast", { 
      detail: { message: "تم نسخ رقم الحساب", type: "success" } 
    }));
  };

  const toggleAccordion = (index) => {
    setOpenIndex(openIndex === index ? -1 : index);
  };

  if (!banks || banks.length === 0) {
    return (
      <div className="bg-gray-50/50 rounded-2xl p-8 text-center border border-dashed border-gray-200">
        <p className="text-sm font-bold text-gray-400">لا توجد حسابات بنكية معتمدة حالياً</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {banks.map((bank, index) => {
        const isOpen = openIndex === index;
        return (
          <div 
            key={bank._id} 
            className={`overflow-hidden transition-all duration-300 rounded-2xl border ${
              isOpen 
                ? "bg-white border-blue-200 shadow-md ring-1 ring-blue-50" 
                : "bg-gray-50/50 border-gray-100 hover:bg-white hover:border-gray-200 shadow-sm"
            }`}
          >
            {/* Header */}
            <button
              type="button"
              onClick={() => toggleAccordion(index)}
              className="w-full flex items-center justify-between p-3 sm:p-4 text-right transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl border flex items-center justify-center p-1.5 overflow-hidden transition-all ${
                  isOpen ? "bg-white border-blue-100 shadow-sm" : "bg-white border-gray-100"
                }`}>
                  {bank.logo ? (
                    <img src={bank.logo.startsWith("http") ? bank.logo : uploadsUrl(bank.logo)} alt={bank.bankName} className="w-full h-full object-contain" />
                  ) : (
                    <svg className={`w-6 h-6 sm:w-7 sm:h-7 transition-colors ${isOpen ? "text-blue-500" : "text-gray-300"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  )}
                </div>
                <div>
                  <h4 className={`font-black leading-tight transition-colors ${isOpen ? "text-blue-600 text-base" : "text-gray-800 text-sm"}`}>
                    {bank.bankName}
                  </h4>
                  <p className="text-[10px] sm:text-[11px] font-bold text-gray-400 mt-0.5">{bank.accountOwner}</p>
                </div>
              </div>
              
              <div className={`transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`}>
                <svg className={`w-5 h-5 ${isOpen ? "text-blue-500" : "text-gray-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </button>

            {/* Content (Accordion Body) */}
            <div 
              className={`transition-all duration-300 ease-in-out ${
                isOpen ? "max-h-[500px] opacity-100 border-t border-gray-50 bg-white" : "max-h-0 opacity-0 pointer-events-none"
              }`}
            >
              <div className="p-2 sm:p-3 space-y-1.5">
                {bank.accounts.map((acc, idx) => (
                  <div 
                    key={idx} 
                    onClick={(e) => handleCopy(acc.number, e)}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-gray-50/50 border border-transparent hover:bg-blue-50/30 hover:border-blue-100 transition-all cursor-pointer group"
                  >
                    <div className="flex items-center gap-2 font-mono font-black text-gray-700 tracking-tight text-sm sm:text-base">
                      <span className="select-all">{acc.number}</span>
                      <span className="text-gray-300 font-normal mx-0.5">•</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-base leading-none">{CURRENCY_INFO[acc.currency]?.flag || "🇾🇪"}</span>
                        <span className="text-[10px] font-black text-gray-400 group-hover:text-blue-600 transition-colors">
                          {CURRENCY_INFO[acc.currency]?.label || acc.currency}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-bold text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity hidden sm:inline">إضغط للنسخ</span>
                      <div className="p-1.5 rounded-lg bg-white border border-gray-100 text-gray-400 group-hover:text-blue-600 group-hover:border-blue-100 group-hover:shadow-sm transition-all">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                        </svg>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
