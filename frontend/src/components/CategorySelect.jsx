import { useState, useEffect, useCallback, useRef } from "react";
import { useCategoryApi } from "../api/categories.js";
import { useMainCategories } from "../hooks/useMainCategories.js";
import MobileSelect from "./MobileSelect.jsx";

export default function CategorySelect({ value, onChange, onMainChange, required = false }) {
  const { data: mainCategories = [], isLoading: loading } = useMainCategories();
  const [subCategories, setSubCategories] = useState([]);
  const [loadingSub, setLoadingSub] = useState(false);
  const [selectedMain, setSelectedMain] = useState(null);
  const [selectedSub, setSelectedSub] = useState(null);
  const pendingSubIdRef = useRef(null);
  const categoryApi = useCategoryApi();

  // Load subcategories when main category changes
  useEffect(() => {
    if (selectedMain) {
      loadSubCategories(selectedMain.id);
    } else {
      setSubCategories([]);
    }
  }, [selectedMain]);

  // Set initial value if provided
  useEffect(() => {
    if (value && mainCategories.length > 0 && !selectedMain) {
      initFromValue(value);
    }
  }, [value, mainCategories]);

  const loadSubCategories = async (mainId) => {
    try {
      setLoadingSub(true);
      const response = await categoryApi.getCategoryChildren(mainId);
      const subs = response.data || [];
      setSubCategories(subs);
      // If لا توجد فئات فرعية، اعتبر اختيار الفئة الرئيسية نهائياً
      if (subs.length === 0) {
        setSelectedSub(null);
        onChange?.(mainId);
      }
    } catch (error) {
      console.error("Error loading sub categories:", error);
      setSubCategories([]);
    } finally {
      setLoadingSub(false);
    }
  };

  const initFromValue = useCallback(async (catId) => {
    // If it's a main category, set it directly
    const directMain = mainCategories.find(c => String(c.id || c._id) === String(catId));
    if (directMain) {
      setSelectedMain(directMain);
      setSelectedSub(null);
      onChange?.(directMain.id || directMain._id);
      onMainChange?.(directMain);
      return;
    }
    // Resolve breadcrumbs to find the root main and confirm subcategory
    try {
      const bc = await categoryApi.getBreadcrumbs(catId);
      const crumbs = bc.data || bc || [];
      const root = crumbs[0]?.id || crumbs[0]?._id || null;
      const leaf = crumbs[crumbs.length - 1]?.id || crumbs[crumbs.length - 1]?._id || catId;
      const main = mainCategories.find(c => String(c.id || c._id) === String(root));
      if (main) {
        pendingSubIdRef.current = String(leaf);
        setSelectedMain(main);
        onMainChange?.(main);
      } else {
        // Fallback: pick the first main to trigger load; we'll set sub later if found
        if (mainCategories.length > 0) {
          pendingSubIdRef.current = String(leaf);
          setSelectedMain(mainCategories[0]);
          onMainChange?.(mainCategories[0]);
        }
      }
    } catch (e) {
      console.error("Failed to init category from value:", e);
      // Best-effort: try scanning subcategories of each main
      if (mainCategories.length > 0) {
        setSelectedMain(mainCategories[0]);
        onMainChange?.(mainCategories[0]);
        pendingSubIdRef.current = String(catId);
      }
    }
  }, [mainCategories, categoryApi, onChange]);

  // When subcategories load and we have a pending sub id, set it
  useEffect(() => {
    if (!loadingSub && subCategories.length > 0 && pendingSubIdRef.current) {
      const subId = pendingSubIdRef.current;
      const exists = subCategories.find(c => String(c.id) === String(subId));
      if (exists) {
        setSelectedSub(String(subId));
        onChange?.(String(subId));
        pendingSubIdRef.current = null;
      }
    }
  }, [loadingSub, subCategories, onChange]);

  const handleMainChange = (e) => {
    const mainId = e.target.value;
    if (!mainId) {
      setSelectedMain(null);
      setSelectedSub(null);
      setSubCategories([]);
      onChange(null);
      onMainChange?.(null);
      return;
    }
    const main = mainCategories.find(c => String(c.id || c._id) === String(mainId));
    setSelectedMain(main);
    setSelectedSub(null);
    onMainChange?.(main);
  };

  const handleSubChange = (e) => {
    const subId = e.target.value;
    setSelectedSub(subId || null);
    // Always pass subcategory ID if selected, otherwise keep null (user must choose)
    if (subId) onChange(subId);
  };

  // Require subcategory selection if subcategories exist
  const hasSubCategories = subCategories.length > 0;
  const isValidSelection = selectedMain && (!hasSubCategories || selectedSub);

  if (loading) {
    return (
      <div className="space-y-2">
        <div className="h-10 bg-gray-200 rounded animate-pulse"></div>
        <div className="h-10 bg-gray-200 rounded animate-pulse"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <MobileSelect
        label="الفئة الرئيسية"
        value={selectedMain?.id || ""}
        onChange={handleMainChange}
        required={required}
        options={mainCategories.map(cat => ({ value: cat.id || cat._id, label: cat.name }))}
        placeholder="اختر الفئة الرئيسية"
      />

      {selectedMain && (
        <div className="animate-in slide-in-from-top-2 duration-200">
          <MobileSelect
            label="الفئة الفرعية"
            value={selectedSub || ""}
            onChange={handleSubChange}
            required={hasSubCategories && required}
            disabled={loadingSub || subCategories.length === 0}
            options={subCategories.map(cat => ({ value: cat.id || cat._id, label: `${cat.name} (${cat.adCount || 0} إعلان)` }))}
            placeholder={subCategories.length === 0 ? "لا توجد فئات فرعية" : "اختر الفئة الفرعية"}
          />
          {hasSubCategories && !selectedSub && required && (
            <p className="text-xs text-red-500 mt-1">يجب اختيار فئة فرعية</p>
          )}
        </div>
      )}
    </div>
  );
}
