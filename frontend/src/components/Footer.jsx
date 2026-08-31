import React from "react";
import { Link } from "react-router-dom";
import Logo from "./Logo.jsx";

export default function Footer() {
  return (
    <footer className="mt-14 border-t border-blue-100 bg-gradient-to-b from-white/95 to-blue-50/60 backdrop-blur-md">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="flex flex-col items-center gap-6 text-sm text-gray-500 md:flex-row md:justify-between">
          <div className="flex flex-col items-center md:items-start gap-2">
            <div className="flex items-center gap-2">
              <Logo iconSize="w-8 h-8" textSize="text-lg" />
              <span className="h-4 w-px bg-gray-200"></span>
              <span className="text-xs font-bold text-blue-600/80">منصتك الأولى للتجارة في اليمن</span>
            </div>
            <p className="text-[11px] font-medium text-gray-600">© {new Date().getFullYear()} جميع الحقوق محفوظة لشركة سوقك للتجارة الإلكترونية</p>
            
            {/* Social Media Links */}
            <div className="flex items-center gap-4 mt-2">
              <a 
                href="https://www.facebook.com/share/1GGvSFnu8Q/"
                rel="noopener noreferrer"
                className="w-8 h-8 flex items-center justify-center rounded-full bg-blue-600 text-white hover:bg-blue-700 transition-all shadow-sm hover:scale-110 active:scale-95"
                title="فيسبوك"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
              </a>
              <a 
                href="https://www.instagram.com/souqak.ye?igsh=dWlpa215M2x1MWxz"
                rel="noopener noreferrer"
                className="w-8 h-8 flex items-center justify-center rounded-full bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-600 text-white hover:opacity-90 transition-all shadow-sm hover:scale-110 active:scale-95"
                title="انستقرام"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                </svg>
              </a>
              <a
                href="https://whatsapp.com/channel/0029VbDWxY0BlHplgBSNoc12"
                rel="noopener noreferrer"
                className="w-8 h-8 flex items-center justify-center rounded-full bg-[#25D366] text-white hover:bg-[#1ebe5d] transition-all shadow-sm hover:scale-110 active:scale-95"
                title="واتساب"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12.04 2C6.51 2 2 6.51 2 12.04c0 1.77.46 3.43 1.27 4.87L2 22l5.24-1.24a10 10 0 0 0 4.8 1.22h.01C17.57 21.98 22 17.47 22 11.96 22 6.46 17.55 2 12.04 2Zm0 18.3c-1.54 0-3.05-.42-4.37-1.21l-.31-.18-3.11.74.75-3.03-.2-.32a8.28 8.28 0 0 1-1.27-4.4c0-4.57 3.73-8.3 8.32-8.3 2.21 0 4.29.86 5.86 2.43a8.24 8.24 0 0 1 2.43 5.88c-.02 4.58-3.75 8.39-8.1 8.39Zm4.55-6.23c-.25-.13-1.46-.72-1.69-.8-.23-.09-.4-.13-.57.13-.17.25-.65.8-.8.97-.15.17-.3.19-.55.06-1.5-.75-2.49-1.34-3.49-3.04-.26-.45.26-.42.74-1.39.08-.17.04-.31-.02-.44-.06-.13-.57-1.37-.78-1.88-.21-.5-.42-.43-.57-.44h-.49c-.17 0-.44.06-.67.31-.23.25-.88.86-.88 2.1 0 1.24.9 2.43 1.02 2.6.13.17 1.77 2.71 4.3 3.8 1.6.69 2.23.75 3.03.63.49-.07 1.46-.6 1.67-1.18.21-.58.21-1.08.15-1.18-.06-.1-.23-.16-.48-.29Z"/>
                </svg>
              </a>
            </div>
          </div>
          
          <div className="hidden md:flex flex-wrap justify-center gap-x-3 gap-y-2">
            <Link to="/how-it-works" className="rounded-full border border-blue-100 bg-white px-4 py-1.5 font-bold text-blue-700 border-blue-200 shadow-sm hover:bg-blue-50 transition-all">طريقة العمل</Link>
            <Link to="/terms" className="rounded-full border border-blue-100 bg-white px-4 py-1.5 font-bold text-gray-700 hover:border-blue-300 hover:text-blue-700 transition-colors">الشروط والأحكام</Link>
            <Link to="/privacy" className="rounded-full border border-blue-100 bg-white px-4 py-1.5 font-bold text-gray-700 hover:border-blue-300 hover:text-blue-700 transition-colors">سياسة الخصوصية</Link>
            <Link to="/platform-reviews" className="rounded-full border border-blue-100 bg-white px-4 py-1.5 font-bold text-gray-700 hover:border-blue-300 hover:text-blue-700 transition-colors">حائط الآراء</Link>
            <Link to="/refund-escrow" className="rounded-full border border-blue-100 bg-white px-4 py-1.5 font-bold text-gray-700 hover:border-blue-300 hover:text-blue-700 transition-colors">نظام الضمان</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
