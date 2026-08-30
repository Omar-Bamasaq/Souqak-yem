import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useApi } from "../api/axios.js";
import MobileSelect from "../components/MobileSelect.jsx";
import { prepareFilesForUpload } from "../lib/imageCompression.js";

export default function SellerVerification() {
  const api = useApi();
  const navigate = useNavigate();
  
  // Basic Info
  const [fullName, setFullName] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [country, setCountry] = useState("Yemen");
  const [phone, setPhone] = useState("");
  const [docType, setDocType] = useState("id_card");
  
  // Files
  const [idFront, setIdFront] = useState(null);
  const [idBack, setIdBack] = useState(null);
  const [selfie, setSelfie] = useState(null);
  
  // Additional Info
  const [address, setAddress] = useState("");
  const [occupation, setOccupation] = useState("");

  const [loading, setLoading] = useState(false);
  const [processingDocs, setProcessingDocs] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const processDocFile = async (file, setter, fieldName) => {
    if (!file) return null;
    try {
      const [prepared] = await prepareFilesForUpload([file], {
        maxSizeMB: 0.9,
        maxWidthOrHeight: 1800,
        initialQuality: 0.85,
      });
      setter(prepared);
      return prepared;
    } catch (error) {
      console.error(`Verification document compression failed for ${fieldName}:`, error);
      throw new Error("تعذر تجهيز إحدى صور الوثيقة. يرجى اختيار صورة أخرى أو صورة بحجم أصغر.");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    
    if (!fullName || !idNumber || !dateOfBirth || !country || !phone || !idFront) {
      setError("يرجى إكمال جميع البيانات الأساسية ورفع صورة الهوية الأمامية");
      return;
    }

    setLoading(true);
    setProcessingDocs(true);
    try {
      const preparedFront = await processDocFile(idFront, setIdFront, "idFrontImage");
      const preparedBack = idBack ? await processDocFile(idBack, setIdBack, "idBackImage") : null;
      const preparedSelfie = selfie ? await processDocFile(selfie, setSelfie, "selfieImage") : null;

      const fd = new FormData();
      fd.append("fullName", fullName);
      fd.append("idNumber", idNumber);
      fd.append("dateOfBirth", dateOfBirth);
      fd.append("country", country);
      fd.append("phone", phone);
      fd.append("docType", docType);
      fd.append("idFrontImage", preparedFront || idFront);
      if (preparedBack || idBack) fd.append("idBackImage", preparedBack || idBack);
      if (preparedSelfie || selfie) fd.append("selfieImage", preparedSelfie || selfie);
      if (address) fd.append("address", address);
      if (occupation) fd.append("occupation", occupation);

      const res = await api.post("/verification-requests", fd, {
        headers: { "Content-Type": "multipart/form-data" }
      });

      if (res.data?.success || res.status === 201 || res.status === 200) {
        setSuccess(true);
      }
    } catch (e) {
      const message = e?.message || e?.response?.data?.error || e?.message || "فشل إرسال الطلب";
      setError(message);
    } finally {
      setLoading(false);
      setProcessingDocs(false);
    }
  };

  if (success) {
    return (
      <div className="mx-auto max-w-lg rounded-3xl border-2 border-emerald-100 bg-white p-10 text-center shadow-xl animate-in zoom-in duration-300">
        <div className="mb-6 inline-flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50 text-emerald-500 text-4xl">
          ✓
        </div>
        <h2 className="text-2xl font-black text-gray-900">تم إرسال طلب التوثيق</h2>
        <p className="mt-3 text-gray-600 font-medium leading-relaxed">
          شكراً لك! طلبك الآن قيد المراجعة المجانية. سيتم إخطارك بمجرد الموافقة خلال 24-48 ساعة.
        </p>
        <Link 
          to="/seller/subscriptions" 
          className="mt-8 inline-block w-full rounded-2xl bg-emerald-600 py-4 font-black text-white hover:bg-emerald-700 transition-all active:scale-95 shadow-lg shadow-emerald-100"
        >
          العودة للاشتراكات
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-20 sm:pb-10">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl sm:text-3xl font-black text-gray-900">توثيق الحساب المجاني</h2>
          <p className="text-sm sm:text-base text-gray-500 font-bold">عزز ثقة عملائك بشارة التوثيق الرسمية</p>
        </div>
        <Link 
          to="/seller/subscriptions" 
          className="flex items-center gap-2 bg-gray-50 text-gray-700 px-4 py-2 rounded-2xl text-xs font-black hover:bg-gray-100 transition-all border border-gray-100 shrink-0"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          العودة
        </Link>
      </div>

      {/* Feature Cards - More compact on mobile */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <div className="bg-white p-3 sm:p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center text-center group hover:border-blue-200 transition-colors">
          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-50 rounded-xl flex items-center justify-center text-lg sm:text-xl mb-2 group-hover:scale-110 transition-transform">⭐</div>
          <h4 className="font-black text-[10px] sm:text-sm text-gray-900">شارة موثق</h4>
          <p className="hidden sm:block text-[10px] text-gray-400 font-bold mt-1">تظهر بجانب اسمك في كل مكان</p>
        </div>
        <div className="bg-white p-3 sm:p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center text-center group hover:border-emerald-200 transition-colors">
          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-lg sm:text-xl mb-2 group-hover:scale-110 transition-transform">📈</div>
          <h4 className="font-black text-[10px] sm:text-sm text-gray-900">أولوية الظهور</h4>
          <p className="hidden sm:block text-[10px] text-gray-400 font-bold mt-1">إعلاناتك تظهر قبل الحسابات العادية</p>
        </div>
        <div className="bg-white p-3 sm:p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center text-center group hover:border-purple-200 transition-colors">
          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-purple-50 rounded-xl flex items-center justify-center text-lg sm:text-xl mb-2 group-hover:scale-110 transition-transform">🎁</div>
          <h4 className="font-black text-[10px] sm:text-sm text-gray-900">ميزات حصرية</h4>
          <p className="hidden sm:block text-[10px] text-gray-400 font-bold mt-1">دخول مبكر للميزات والخصومات</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-[2.5rem] border border-gray-100 p-5 sm:p-10 shadow-sm space-y-8">
        {/* Section 1: Basic Info */}
        <div className="space-y-5 sm:space-y-6">
          <h3 className="text-base sm:text-lg font-black text-gray-900 flex items-center gap-3 border-b border-gray-50 pb-4">
            <span className="w-7 h-7 sm:w-8 sm:h-8 bg-blue-600 text-white rounded-lg flex items-center justify-center text-xs sm:text-sm shadow-lg shadow-blue-100">1</span>
            البيانات الأساسية
          </h3>
          
          <div className="grid gap-4 sm:gap-6 sm:grid-cols-2">
            <div>
              <label className="block text-[10px] sm:text-xs font-black text-gray-400 uppercase tracking-widest mb-1.5 sm:mb-2 px-1">الاسم الكامل (كما في الهوية)</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full bg-gray-50 border border-transparent focus:border-blue-500 focus:bg-white rounded-xl sm:rounded-2xl px-4 py-3 sm:px-5 sm:py-4 outline-none transition-all text-xs sm:text-sm font-bold"
                placeholder="أدخل اسمك الثلاثي"
              />
            </div>
            <div>
              <label className="block text-[10px] sm:text-xs font-black text-gray-400 uppercase tracking-widest mb-1.5 sm:mb-2 px-1">رقم الهوية / جواز السفر</label>
              <input
                type="text"
                required
                value={idNumber}
                onChange={(e) => setIdNumber(e.target.value)}
                className="w-full bg-gray-50 border border-transparent focus:border-blue-500 focus:bg-white rounded-xl sm:rounded-2xl px-4 py-3 sm:px-5 sm:py-4 outline-none transition-all text-xs sm:text-sm font-bold"
                placeholder="رقم الوثيقة"
              />
            </div>
            <div>
              <label className="block text-[10px] sm:text-xs font-black text-gray-400 uppercase tracking-widest mb-1.5 sm:mb-2 px-1">تاريخ الميلاد</label>
              <input
                type="date"
                required
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                className="w-full bg-gray-50 border border-transparent focus:border-blue-500 focus:bg-white rounded-xl sm:rounded-2xl px-4 py-3 sm:px-5 sm:py-4 outline-none transition-all text-xs sm:text-sm font-bold"
              />
            </div>
            <div>
              <label className="block text-[10px] sm:text-xs font-black text-gray-400 uppercase tracking-widest mb-1.5 sm:mb-2 px-1">رقم الهاتف (للتواصل)</label>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full bg-gray-50 border border-transparent focus:border-blue-500 focus:bg-white rounded-xl sm:rounded-2xl px-4 py-3 sm:px-5 sm:py-4 outline-none transition-all text-xs sm:text-sm font-bold text-left dir-ltr"
                placeholder="7XXXXXXXX"
              />
            </div>
            <div className="sm:col-span-2">
              <MobileSelect
                label="نوع الوثيقة"
                value={docType}
                onChange={(e) => setDocType(e.target.value)}
                options={[
                  { value: "id_card", label: "بطاقة شخصية" },
                  { value: "passport", label: "جواز سفر" }
                ]}
              />
            </div>
          </div>
        </div>

        {/* Section 2: Files */}
        <div className="space-y-5 sm:space-y-6">
          <h3 className="text-base sm:text-lg font-black text-gray-900 flex items-center gap-3 border-b border-gray-50 pb-4">
            <span className="w-7 h-7 sm:w-8 sm:h-8 bg-blue-600 text-white rounded-lg flex items-center justify-center text-xs sm:text-sm shadow-lg shadow-blue-100">2</span>
            رفع الوثائق
          </h3>
          
          {(processingDocs || loading) && (
          <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-900">
            {processingDocs ? "جاري تجهيز وثائق الهوية..." : "جارٍ إرسال الطلب..."}
          </div>
        )}

        <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <label className="block text-[10px] sm:text-xs font-black text-gray-400 uppercase tracking-widest px-1">صورة الهوية (الأمامية) *</label>
              <div className="relative group aspect-[16/10] sm:aspect-[4/3] rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 flex flex-col items-center justify-center p-4 hover:border-blue-500 transition-all cursor-pointer overflow-hidden">
                {idFront ? (
                  <img src={URL.createObjectURL(idFront)} alt="Front" className="absolute inset-0 w-full h-full object-cover" />
                ) : (
                  <>
                    <span className="text-2xl sm:text-3xl mb-1 sm:mb-2">🪪</span>
                    <span className="text-[10px] font-black text-gray-500">اختر صورة</span>
                  </>
                )}
                <input type="file" required accept="image/*" onChange={(e) => setIdFront(e.target.files[0])} className="absolute inset-0 opacity-0 cursor-pointer" />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-[10px] sm:text-xs font-black text-gray-400 uppercase tracking-widest px-1">صورة الهوية (الخلفية)</label>
              <div className="relative group aspect-[16/10] sm:aspect-[4/3] rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 flex flex-col items-center justify-center p-4 hover:border-blue-500 transition-all cursor-pointer overflow-hidden">
                {idBack ? (
                  <img src={URL.createObjectURL(idBack)} alt="Back" className="absolute inset-0 w-full h-full object-cover" />
                ) : (
                  <>
                    <span className="text-2xl sm:text-3xl mb-1 sm:mb-2">📄</span>
                    <span className="text-[10px] font-black text-gray-500">اختر صورة</span>
                  </>
                )}
                <input type="file" accept="image/*" onChange={(e) => setIdBack(e.target.files[0])} className="absolute inset-0 opacity-0 cursor-pointer" />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-[10px] sm:text-xs font-black text-gray-400 uppercase tracking-widest px-1">سيلفي مع الهوية</label>
              <div className="relative group aspect-[16/10] sm:aspect-[4/3] rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 flex flex-col items-center justify-center p-4 hover:border-blue-500 transition-all cursor-pointer overflow-hidden">
                {selfie ? (
                  <img src={URL.createObjectURL(selfie)} alt="Selfie" className="absolute inset-0 w-full h-full object-cover" />
                ) : (
                  <>
                    <span className="text-2xl sm:text-3xl mb-1 sm:mb-2">📸</span>
                    <span className="text-[10px] font-black text-gray-500">اختر صورة</span>
                  </>
                )}
                <input type="file" accept="image/*" onChange={(e) => setSelfie(e.target.files[0])} className="absolute inset-0 opacity-0 cursor-pointer" />
              </div>
            </div>
          </div>
          <div className="p-3 bg-amber-50 rounded-xl border border-amber-100">
            <p className="text-[10px] text-amber-700 font-bold leading-relaxed flex items-start gap-2">
              <svg className="w-3.5 h-3.5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              تنبيه: يجب أن تكون الصور واضحة وجميع البيانات مقروءة لضمان سرعة قبول الطلب. الحد الأقصى للحجم: 5MB.
            </p>
          </div>
        </div>

        {/* Section 3: Extra Info */}
        <div className="space-y-5 sm:space-y-6">
          <h3 className="text-base sm:text-lg font-black text-gray-900 flex items-center gap-3 border-b border-gray-50 pb-4">
            <span className="w-7 h-7 sm:w-8 sm:h-8 bg-blue-600 text-white rounded-lg flex items-center justify-center text-xs sm:text-sm shadow-lg shadow-blue-100">3</span>
            بيانات إضافية (اختياري)
          </h3>
          
          <div className="grid gap-4 sm:gap-6 sm:grid-cols-2">
            <div>
              <label className="block text-[10px] sm:text-xs font-black text-gray-400 uppercase tracking-widest mb-1.5 sm:mb-2 px-1">العنوان بالتفصيل</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full bg-gray-50 border border-transparent focus:border-blue-500 focus:bg-white rounded-xl sm:rounded-2xl px-4 py-3 sm:px-5 sm:py-4 outline-none transition-all text-xs sm:text-sm font-bold"
                placeholder="المدينة، الحي، الشارع"
              />
            </div>
            <div>
              <label className="block text-[10px] sm:text-xs font-black text-gray-400 uppercase tracking-widest mb-1.5 sm:mb-2 px-1">المهنة</label>
              <input
                type="text"
                value={occupation}
                onChange={(e) => setOccupation(e.target.value)}
                className="w-full bg-gray-50 border border-transparent focus:border-blue-500 focus:bg-white rounded-xl sm:rounded-2xl px-4 py-3 sm:px-5 sm:py-4 outline-none transition-all text-xs sm:text-sm font-bold"
                placeholder="ما هو عملك الحالي؟"
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-50 text-red-600 text-xs font-black rounded-2xl border border-red-100 animate-pulse flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white font-black py-4 sm:py-5 rounded-2xl sm:rounded-[2rem] hover:bg-blue-700 transition-all shadow-xl shadow-blue-100 disabled:opacity-50 active:scale-95 text-base sm:text-lg"
        >
          {loading ? "جاري إرسال الطلب..." : "إرسال طلب التوثيق مجاناً"}
        </button>
      </form>
    </div>
  );
}
