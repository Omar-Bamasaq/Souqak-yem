import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";

/**
 * A responsive Select component that renders a standard <select> on desktop
 * and a custom Bottom Sheet on mobile.
 */
export default function MobileSelect({ 
  label, 
  value, 
  onChange, 
  options = [], 
  placeholder = "اختر...", 
  required = false, 
  disabled = false,
  className = "" 
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const selectedOption = options.find(opt => String(opt.value) === String(value));
  const displayValue = selectedOption ? selectedOption.label : placeholder;

  const handleSelect = (val) => {
    onChange({ target: { value: val } });
    setIsOpen(false);
  };

  if (!isMobile) {
    return (
      <div className={`space-y-1 ${className}`}>
        {label && (
          <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-1 px-1">
            {label} {required && <span className="text-red-500">*</span>}
          </label>
        )}
        <select
          value={value}
          onChange={onChange}
          required={required}
          disabled={disabled}
          className="ds-select h-12 w-full"
        >
          <option value="">{placeholder}</option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  // Mobile Bottom Sheet UI
  return (
    <div className={`space-y-1 ${className}`}>
      {label && (
        <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-1 px-1">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(true)}
        className={`w-full h-12 px-4 flex items-center justify-between rounded-xl border bg-white text-sm transition-all text-right
          ${disabled ? "opacity-50 bg-gray-50 cursor-not-allowed" : "hover:border-blue-300 active:bg-gray-50"}
          ${selectedOption ? "text-gray-900 font-bold" : "text-gray-400"}
        `}
      >
        <span className="truncate">{displayValue}</span>
        <svg className={`h-5 w-5 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && createPortal(
        <div className="fixed inset-0 z-[999999] flex items-end justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setIsOpen(false)}>
          <div 
            className="w-full max-w-lg bg-white rounded-t-[2.5rem] shadow-2xl animate-in slide-in-from-bottom duration-300 flex flex-col max-h-[85vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="relative flex items-center justify-center py-5 border-b flex-shrink-0">
              <div className="absolute top-2 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-gray-200 rounded-full"></div>
              <h3 className="text-base font-black text-gray-900 mt-2">{label || "اختر خياراً"}</h3>
              <button 
                onClick={() => setIsOpen(false)}
                className="absolute left-4 top-5 p-2 bg-gray-50 hover:bg-gray-100 rounded-full transition-colors text-gray-500"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* List Container */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar scroll-smooth pb-12 max-h-[60vh]">
              <button
                onClick={() => handleSelect("")}
                className={`w-full p-4 rounded-2xl text-right text-sm font-bold transition-all border
                  ${!value ? "bg-blue-50 border-blue-200 text-blue-600 shadow-sm" : "bg-white border-gray-50 text-gray-500 hover:bg-gray-50"}
                `}
              >
                {placeholder}
              </button>
              
              {options.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleSelect(opt.value)}
                  className={`w-full p-4 rounded-2xl text-right text-sm font-bold transition-all border flex items-center justify-between
                    ${String(value) === String(opt.value) 
                      ? "bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-100 scale-[1.02]" 
                      : "bg-white border-gray-100 text-gray-700 hover:bg-gray-50 hover:border-blue-100"}
                  `}
                >
                  <span className="truncate">{opt.label}</span>
                  {String(value) === String(opt.value) && (
                    <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
