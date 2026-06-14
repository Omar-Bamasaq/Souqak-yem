import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useCategoryApi } from "../api/categories.js";
import { useApi } from "../api/axios.js";
import MobileSelect from "./MobileSelect.jsx";

function buildFilters(initialFilters = {}, preSelectedCategory = null) {
  const safeFilters = initialFilters || {};
  return {
    q: safeFilters.q || "",
    categoryId: safeFilters.categoryId || preSelectedCategory?.id || "",
    subCategoryId: safeFilters.subCategoryId || "",
    governorateId: safeFilters.governorateId || "",
    cityId: safeFilters.cityId || "",
    minPrice: safeFilters.minPrice || "",
    maxPrice: safeFilters.maxPrice || "",
    currency: safeFilters.currency || "",
    condition: Array.isArray(safeFilters.condition)
      ? safeFilters.condition
      : safeFilters.condition
      ? String(safeFilters.condition).split(",").map((item) => item.trim()).filter(Boolean)
      : [],
    dateRange: safeFilters.dateRange || "any",
    verifiedOnly: safeFilters.verifiedOnly === true || safeFilters.verifiedOnly === "true",
    featuredOnly: safeFilters.featuredOnly === true || safeFilters.featuredOnly === "true",
    adType: safeFilters.adType || "",
    sort: safeFilters.sort || "best"
  };
}

export default function AdvancedSearchModal({ isOpen, onClose, preSelectedCategory = null, initialFilters = null) {
  const navigate = useNavigate();
  const categoryApi = useCategoryApi();
  const api = useApi();
  
  const [filters, setFilters] = useState(buildFilters(initialFilters, preSelectedCategory));

  const [categories, setCategories] = useState([]);
  const [subCategories, setSubCategories] = useState([]);
  const [governorates, setGovernorates] = useState([]);
  const [cities, setCities] = useState([]);
  const [categoryAttributes, setCategoryAttributes] = useState([]);
  const [attributeValues, setAttributeValues] = useState({});

  useEffect(() => {
    loadCategories();
    loadGovernorates();
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setFilters(buildFilters(initialFilters, preSelectedCategory));
    setAttributeValues({});
  }, [isOpen, initialFilters, preSelectedCategory]);

  useEffect(() => {
    if (filters.categoryId) {
      loadSubCategories(filters.categoryId);
      loadCategoryAttributes(filters.subCategoryId || filters.categoryId);
    } else {
      setSubCategories([]);
      setCategoryAttributes([]);
    }
  }, [filters.categoryId, filters.subCategoryId]);

  useEffect(() => {
    if (filters.governorateId) {
      loadCities(filters.governorateId);
    } else {
      setCities([]);
    }
  }, [filters.governorateId]);

  const loadCategories = async () => {
    try {
      // Use dedicated main-categories endpoint so we don't include subcategories
      const res = await api.get("/categories/main");
      setCategories(res.data || []);
    } catch (error) {
      console.error("Error loading categories:", error);
    }
  };

  const loadSubCategories = async (parentId) => {
    try {
      // Find the selected category object
      const selectedCat = categories.find(c => (c._id || c.id) === parentId);
      
      if (selectedCat && (selectedCat.slug === "purchase-orders" || selectedCat.name === "طلبات الشراء")) {
        // If it's Purchase Orders, show all OTHER main categories as sub-categories
        setSubCategories(categories.filter(c => c.slug !== "purchase-orders" && c.name !== "طلبات الشراء"));
        return;
      }

      const res = await api.get("/categories", { params: { flat: true, parent: parentId } });
      setSubCategories(res.data || []);
    } catch (error) {
      console.error("Error loading subcategories:", error);
    }
  };

  const loadGovernorates = async () => {
    try {
      const res = await api.get("/governorates", { params: { active: true } });
      setGovernorates(res.data || []);
    } catch (error) {
      console.error("Error loading governorates:", error);
    }
  };

  const loadCities = async (govId) => {
    try {
      const res = await api.get("/cities", { params: { governorateId: govId, active: true } });
      setCities(res.data || []);
    } catch (error) {
      console.error("Error loading cities:", error);
    }
  };

  const loadCategoryAttributes = async (catId) => {
    try {
      const res = await api.get(`/category-attributes/category/${catId}`);
      setCategoryAttributes(res.data || []);
    } catch (error) {
      console.error("Error loading category attributes:", error);
    }
  };

  const handleConditionToggle = (value) => {
    setFilters(prev => ({
      ...prev,
      condition: prev.condition.includes(value)
        ? prev.condition.filter(c => c !== value)
        : [...prev.condition, value]
    }));
  };

  const handleSearch = () => {
    const params = new URLSearchParams();
    
    if (filters.q) params.append("q", filters.q);
    if (filters.subCategoryId) params.append("categoryId", filters.subCategoryId);
    else if (filters.categoryId) params.append("categoryId", filters.categoryId);
    if (filters.governorateId) params.append("governorateId", filters.governorateId);
    if (filters.cityId) params.append("cityId", filters.cityId);
    if (filters.minPrice) params.append("minPrice", filters.minPrice);
    if (filters.maxPrice) params.append("maxPrice", filters.maxPrice);
    if (filters.currency) params.append("currency", filters.currency);
    if (filters.condition.length > 0) params.append("conditions", filters.condition.join(","));
    if (filters.verifiedOnly) params.append("verifiedOnly", "true");
    if (filters.featuredOnly) params.append("featuredOnly", "true");
    if (filters.adType) params.append("adType", filters.adType);
    if (filters.sort !== "best") params.append("sort", filters.sort);

    // Add dynamic attributes
    Object.entries(attributeValues).forEach(([key, value]) => {
      if (value) params.append(`attr_${key}`, value);
    });

    navigate(`/search?${params.toString()}`);
    onClose();
  };

  const handleReset = () => {
    setFilters(buildFilters({}, preSelectedCategory));
    setAttributeValues({});
  };

  if (!isOpen) return null;

  const modalContent = (
    <div className="fixed inset-0 bg-black/60 z-[99999] flex items-center justify-center p-4 backdrop-blur-sm">
      <div 
        className="bg-white rounded-[2rem] shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col w-[95%] max-w-xl max-h-[90vh] overflow-hidden relative border border-gray-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative flex items-center justify-center py-3 border-b flex-shrink-0 bg-white z-10">
          <h2 className="text-sm font-black text-gray-900">البحث المتقدم</h2>
          <button 
            onClick={onClose} 
            className="absolute left-2 top-2 p-1.5 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-600"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar scroll-smooth">
          {/* Search Query */}
          <div>
            <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 px-1">كلمة البحث</label>
            <div className="relative">
              <input
                type="text"
                value={filters.q}
                onChange={(e) => setFilters({ ...filters, q: e.target.value })}
                placeholder="ابحث عن سيارة، جوال، عقار..."
                className="ds-input h-12 pr-10 pl-4"
              />
              <svg className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>

          {/* Categories */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <MobileSelect
              label="📁 الفئة الرئيسية"
              value={filters.categoryId}
              onChange={(e) => {
                const val = e.target.value;
                const selectedCat = categories.find(c => (c._id || c.id) === val);
                const newFilters = { ...filters, categoryId: val, subCategoryId: "" };
                if (selectedCat && (selectedCat.slug === "purchase-orders" || selectedCat.name === "طلبات الشراء")) {
                  newFilters.adType = "order";
                }
                setFilters(newFilters);
              }}
              options={categories.map(c => ({ value: c._id, label: c.name }))}
              placeholder="جميع الفئات"
            />

            <MobileSelect
              label="📂 الفئة الفرعية"
              value={filters.subCategoryId}
              onChange={(e) => setFilters({ ...filters, subCategoryId: e.target.value }))}
              options={subCategories.map(c => ({ value: c._id, label: c.name }))}
              placeholder={filters.categoryId ? (subCategories.length > 0 ? "جميع الفئات الفرعية" : "لا توجد فئات فرعية") : "اختر الفئة الرئيسية أولاً"}
              disabled={!filters.categoryId || subCategories.length === 0}
            />
          </div>

          {/* Location */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <MobileSelect
              label="📍 المحافظة"
              value={filters.governorateId}
              onChange={(e) => setFilters({ ...filters, governorateId: e.target.value, cityId: "" }))}
              options={governorates.map(g => ({ value: g._id, label: g.name }))}
              placeholder="جميع المحافظات"
            />

            <MobileSelect
              label="🏙️ المدينة"
              value={filters.cityId}
              onChange={(e) => setFilters({ ...filters, cityId: e.target.value }))}
              options={cities.map(c => ({ value: c._id, label: c.name }))}
              placeholder={filters.governorateId ? (cities.length > 0 ? "جميع المدن" : "لا توجد مدن") : "اختر المحافظة أولاً"}
              disabled={!filters.governorateId || cities.length === 0}
            />
          </div>

          {/* Ad Type */}
          <div>
            <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 px-1">نوع الإعلان</label>
            <div className="flex flex-wrap gap-2">
              {[
                  { id: "", label: "الكل" },
                  { id: "sell", label: "بيع" },
                  { id: "order", label: "طلب شراء" }
                ].map((type) => (
                <button
                  key={type.id}
                  onClick={() => setFilters({ ...filters, adType: type.id }))}
                  className={`flex-1 min-w-[80px] px-3 py-2.5 rounded-xl border-2 transition-all font-bold text-sm ${
                    filters.adType === type.id
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-100 scale-[1.02]"
                      : "bg-white text-gray-700 border-gray-100 hover:border-indigo-200"
                  }`}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>

          {/* Price Range */}
          <div className="space-y-3">
            <label className="block text-xs font-black text-gray-400 uppercase tracking-widest px-1">💰 نطاق السعر والعملة</label>
            
            <div className="flex flex-wrap gap-2 mb-3">
              {[
                { id: "", label: "الكل" },
                { id: "YER_ADEN", label: "ريال (عدن)" },
                { id: "YER_SANAA", label: "ريال (صنعاء)" },
                { id: "SAR", label: "ريال سعودي" },
                { id: "USD", label: "دولار" }
              ].map((curr) => (
                <button
                  key={curr.id}
                  onClick={() => setFilters({ ...filters, currency: curr.id }))}
                  className={`flex-1 min-w-[70px] px-2 py-2 rounded-xl border-2 transition-all font-bold text-[10px] ${
                    filters.currency === curr.id
                      ? "bg-blue-600 text-white border-blue-600 shadow-md scale-[1.02]"
                      : "bg-white text-gray-600 border-gray-100 hover:border-blue-200"
                  }`}
                >
                  {curr.label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <span className="text-xs font-black text-gray-900 w-6 flex-shrink-0">من</span>
                <div className="relative flex-1">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={filters.minPrice}
                    onChange={(e) => setFilters({ ...filters, minPrice: (e.target.value || '').replace(/\D/g, '') })}
                    placeholder="أقل سعر"
                    className="ds-input h-12 pr-4 pl-4"
                  />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-black text-gray-900 w-6 flex-shrink-0">إلى</span>
                <div className="relative flex-1">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={filters.maxPrice}
                    onChange={(e) => setFilters({ ...filters, maxPrice: (e.target.value || '').replace(/\D/g, '') }))}
                    placeholder="أعلى سعر"
                    className="ds-input h-12 pr-4 pl-4"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Condition */}
          <div>
            <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 px-1">✨ الحالة</label>
            <div className="flex flex-wrap gap-2">
              {[
                { id: "new", label: "جديد" },
                { id: "used", label: "مستعمل" },
                { id: "like_new", label: "كالجديد" }
              ].map((cond) => (
                <button
                  key={cond.id}
                  onClick={() => handleConditionToggle(cond.id))}
                  className={`flex-1 px-4 py-2.5 rounded-xl border-2 transition-all font-bold text-sm ${
                    filters.condition.includes(cond.id)
                      ? "bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-100 scale-[1.02]"
                      : "bg-white text-gray-700 border-gray-100 hover:border-blue-200"
                  }`}
                >
                  {cond.label}
                </button>
              ))}
            </div>
          </div>

          {/* Dynamic Attributes */}
          {categoryAttributes.length > 0 && (
            <div className="border-t pt-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-5 w-1 bg-indigo-500 rounded-full"></div>
                <h3 className="text-base font-bold text-gray-900">🎯 خصائص إضافية</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {categoryAttributes.map((attr) => (
                  <div key={attr._id}>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1 px-1">{attr.label || attr.name}</label>
                    {attr.type === "select" ? (
                      <select
                        value={attributeValues[attr._id] || ""}
                        onChange={(e) => setAttributeValues({ ...attributeValues, [attr._id]: e.target.value }))}
                        className="ds-select h-11"
                      >
                        <option value="">اختر...</option>
                        {attr.options?.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    ) : attr.type === "number" ? (
                      <input
                        type="number"
                        value={attributeValues[attr._id] || ""}
                        onChange={(e) => setAttributeValues({ ...attributeValues, [attr._id]: e.target.value }))}
                        placeholder={attr.placeholder}
                        className="ds-input h-11"
                      />
                    ) : (
                      <input
                        type="text"
                        value={attributeValues[attr._id] || ""}
                        onChange={(e) => setAttributeValues({ ...attributeValues, [attr._id]: e.target.value }))}
                        placeholder={attr.placeholder}
                        className="ds-input h-11"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Additional Options */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <label className="flex items-center gap-3 cursor-pointer group p-3 rounded-xl border border-gray-50 hover:bg-gray-50 transition-colors">
              <input
                type="checkbox"
                checked={filters.verifiedOnly}
                onChange={(e) => setFilters({ ...filters, verifiedOnly: e.target.checked }))}
                className="w-5 h-5 text-blue-600 rounded-md border-gray-300 focus:ring-blue-500 cursor-pointer"
              />
              <span className="text-sm font-bold text-gray-700 group-hover:text-blue-600 transition-colors">✓ بائعين موثوقين</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer group p-3 rounded-xl border border-gray-50 hover:bg-gray-50 transition-colors">
              <input
                type="checkbox"
                checked={filters.featuredOnly}
                onChange={(e) => setFilters({ ...filters, featuredOnly: e.target.checked }))}
                className="w-5 h-5 text-blue-600 rounded-md border-gray-300 focus:ring-blue-500 cursor-pointer"
              />
              <span className="text-sm font-bold text-gray-700 group-hover:text-blue-600 transition-colors">⭐ إعلانات مميزة</span>
            </label>
          </div>

          {/* Sort */}
          <div>
            <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 px-1">📊 ترتيب النتائج</label>
            <select
              value={filters.sort}
              onChange={(e) => setFilters({ ...filters, sort: e.target.value }))}
              className="ds-select h-12"
            >
              <option value="best">الأفضل (Quality Score)</option>
              <option value="new">الأحدث أولاً</option>
              <option value="old">الأقدم أولاً</option>
              <option value="price_asc">السعر (الأقل → الأعلى)</option>
              <option value="price_desc">السعر (الأعلى → الأقل)</option>
              <option value="rating">الأعلى تقييماً</option>
              <option value="views">الأكثر مشاهدة</option>
            </select>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t bg-gray-50 flex-shrink-0">
          <button
            onClick={handleReset}
            className="px-6 py-2.5 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-xl font-bold transition-all text-sm active:scale-95"
          >
            مسح الكل
          </button>
          <button
            onClick={handleSearch}
            className="px-10 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-blue-200 flex items-center gap-2 active:scale-95 text-sm"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            إظهار النتائج
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
