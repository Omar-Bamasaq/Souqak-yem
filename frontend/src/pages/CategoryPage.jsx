import { useState, useEffect, Fragment, useCallback, useRef, useMemo } from "react";
import { useParams, Link, useNavigate, useSearchParams } from "react-router-dom";
import { useCategoryApi } from "../api/categories.js";
import { useCategoryAttributeApi } from "../api/categoryAttributes.js";
import { useApi } from "../api/axios.js";
import { uploadsUrl } from "../lib/uploads.js";
import ProductCard from "../components/ProductCard.jsx";
import CategoryTree from "../components/CategoryTree.jsx";
import AdvancedSearchModal from "../components/AdvancedSearchModal.jsx";

export default function CategoryPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [category, setCategory] = useState(null);
  const [ads, setAds] = useState([]);
  const [totalAds, setTotalAds] = useState(0);
  const [breadcrumbs, setBreadcrumbs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [purchaseOrderMainCategories, setPurchaseOrderMainCategories] = useState([]);

  // URL State
  const page = parseInt(searchParams.get("page") || "1");
  const subSlug = searchParams.get("sub");
  const subSubSlug = searchParams.get("subSub");

  const categoryApi = useCategoryApi();
  const attributeApi = useCategoryAttributeApi();
  const api = useApi();

  const [searchQuery, setSearchQuery] = useState("");
  const [showAdvancedModal, setShowAdvancedModal] = useState(false);
  const [subSubCategories, setSubSubCategories] = useState([]);
  const [categoryAttributes, setCategoryAttributes] = useState([]);
  const [loadingAttributes, setLoadingAttributes] = useState(false);
  const lastLoadedCategoryId = useRef(null);
  const sentinelRef = useRef(null);
  const isFirstLoad = useRef(true);

  const currentSlug = slug;

  // Helper to get category icon based on name/slug
  const getCategoryIcon = (cat) => {
    const name = (cat.name || "").toLowerCase();
    const slug = (cat.slug || "").toLowerCase();
    
    // Orders
    if (slug.includes("order") || name.includes("طلب")) return "🔍";
    
    // Other (check this early to avoid matching broader keywords like 'car' or 'stationery')
    if (name.includes("أخرى") || slug.includes("other")) return "✨";

    // Musical Instruments
    if (slug.includes("string-instruments") || name.includes("آلات وترية")) return "🎸";
    if (slug.includes("wind-instruments") || name.includes("آلات نفخ")) return "🎷";
    if (slug.includes("percussion-instruments") || name.includes("آلات إيقاعية")) return "🥁";
    if (slug.includes("piano-keyboard") || name.includes("بيانو وأورغ")) return "🎹";
    if (slug.includes("musical-accessories") || name.includes("ملحقات موسيقية")) return "🎧";
    if (slug.includes("music") || name.includes("موسيق")) return "🎵";

    // Cars & Vehicles
    if (slug.includes("cars-for-sale") || name.includes("سيارات للبيع")) return "🚗";
    if (slug.includes("cars-for-rent") || name.includes("سيارات للإيجار")) return "🔑";
    if (slug.includes("cars-transfer") || name.includes("سيارات للتنازل")) return "🤝";
    if (slug.includes("car-parts") || name.includes("قطع غيار")) return "⚙️";
    if (slug.includes("special-plates") || name.includes("لوحات مميزة")) return "🔢";
    if (slug.includes("motorcycles") || name.includes("دراجات نارية") || name.includes("دراجات")) return "🏍️";
    if (slug.includes("trucks") || name.includes("شاحنات")) return "🚛";
    if (slug === "cars" || slug.startsWith("car-") || slug.endsWith("-cars") || name.includes("سيارة")) return "🚗";

    // Special Vehicles
    if (slug.includes("boats") || name.includes("قوارب")) return "🛥️";
    if (slug.includes("agricultural-vehicles") || name.includes("مركبات زراعية")) return "🚜";
    if (slug.includes("electric-vehicles") || name.includes("مركبات كهربائية")) return "⚡";
    if (slug.includes("special-vehicles") || name.includes("مركبات خاصة")) return "🚜";

    // Electronics
    if (slug.includes("mobiles") || name.includes("جوالات")) return "📱";
    if (slug.includes("desktop-computers") || name.includes("كمبيوتر مكتبي") || name.includes("كمبيوتر مكتبية")) return "🖥️";
    if (slug.includes("computers") || name.includes("أجهزة كمبيوتر")) return "🖥️";
    if (slug.includes("laptops") || name.includes("لابتوبات")) return "💻";
    if (slug.includes("screens") || name.includes("شاشات")) return "📺";
    if (slug.includes("cameras") || name.includes("كاميرات")) return "📷";
    if (slug.includes("gaming-consoles") || name.includes("أجهزة ألعاب")) return "🎮";
    if (slug.includes("computer-accessories") || name.includes("ملحقات الكمبيوتر")) return "🖱️";
    if (slug.includes("networks-communications") || name.includes("الشبكات والاتصالات")) return "🌐";
    if (slug.includes("audio-devices") || name.includes("الصوتيات")) return "🎧";
    if (slug.includes("printers-scanners") || name.includes("الطابعات والماسحات")) return "🖨️";
    if (slug.includes("smart-watches") || name.includes("الساعات الذكية")) return "⌚";
    if (slug.includes("tablets") || name.includes("تابلت")) return "📟";
    if (slug.includes("electronic") || name.includes("إلكترون")) return "⚡";

    // Beauty & Health
    if (slug.includes("cosmetics") || name.includes("مستحضرات تجميل")) return "💅";
    if (slug.includes("skin-care") || name.includes("عناية بالبشرة")) return "🧴";
    if (slug.includes("hair-care") || name.includes("عناية بالشعر")) return "💇";
    if (slug.includes("perfumes") || name.includes("عطور")) return "💨";
    if (slug.includes("beauty-tools") || name.includes("أدوات تجميل")) return "✂️";
    if (slug.includes("beauty") || name.includes("تجميل") || name.includes("صحة")) return "💄";

    // Stationery & School
    if (slug.includes("pens-notebooks") || name.includes("أقلام ودفاتر")) return "📝";
    if (slug.includes("office-supplies") || name.includes("أدوات مكتبية")) return "🖇️";
    if (slug.includes("school-supplies") || name.includes("لوازم مدرسية")) return "🎒";
    if (slug.includes("bags") || name.includes("حقائب وشنط")) return "👜";
    if (slug.includes("stationery") || name.includes("مكتبية")) return "📁";

    // Real Estate
    if (slug.includes("apartments-for-sale") || name.includes("شقق للبيع")) return "🏢";
    if (slug.includes("apartments-for-rent") || name.includes("شقق للإيجار")) return "🗝️";
    if (slug.includes("lands") || name.includes("أراضي")) return "🗺️";
    if (slug.includes("villas") || name.includes("فلل")) return "🏰";
    if (slug.includes("shops") || name.includes("محلات")) return "🏪";
    if (slug.includes("offices") || name.includes("مكاتب")) return "🏢";
    if (slug.includes("lounges") || name.includes("استراحات")) return "🏖️";
    if (slug.includes("real-estate") || name.includes("عقار")) return "🏠";

    // Furniture
    if (slug.includes("bedrooms") || name.includes("غرف نوم")) return "🛏️";
    if (slug.includes("majalis") || name.includes("مجالس")) return "🛋️";
    if (slug.includes("kitchens") || name.includes("مطابخ")) return "🍳";
    if (slug.includes("tables-chairs") || name.includes("طاولات وكراسي")) return "🪑";
    if (slug.includes("office-furniture") || name.includes("أثاث مكتبي")) return "💼";
    if (slug.includes("furniture") || name.includes("أثاث")) return "🛋️";

    // Jobs
    if (slug.includes("private-jobs") || name.includes("وظائف خاصة")) return "🏢";
    if (slug.includes("government-jobs") || name.includes("وظائف حكومية")) return "🏛️";
    if (slug.includes("remote-jobs") || name.includes("وظائف عن بعد")) return "🏠";
    if (slug.includes("part-time-jobs") || name.includes("وظائف جزئية")) return "⏱️";
    if (slug.includes("job") || name.includes("وظائف")) return "💼";

    // Animals
    if (slug.includes("sheep") || name.includes("أغنام")) return "🐑";
    if (slug.includes("camels") || name.includes("إبل")) return "🐪";
    if (slug.includes("cows") || name.includes("أبقار")) return "🐄";
    if (slug.includes("birds") || name.includes("طيور")) return "🦜";
    if (slug.includes("pets") || name.includes("حيوانات أليفة")) return "🐱";
    if (slug.includes("animal") || name.includes("حيوان")) return "🐾";

    // Fashion
    if (slug.includes("mens-wear") || name.includes("رجالي")) return "👔";
    if (slug.includes("womens-wear") || name.includes("نسائي")) return "👗";
    if (slug.includes("kids-wear") || name.includes("أطفال")) return "👶";
    if (slug.includes("shoes") || name.includes("أحذية")) return "👟";
    if (slug.includes("accessories") || name.includes("إكسسوارات")) return "💍";
    if (slug.includes("fashion") || name.includes("ملابس") || name.includes("أزياء")) return "👕";

    // Games & Entertainment
    if (slug.includes("video-games") || name.includes("ألعاب فيديو")) return "🕹️";
    if (slug.includes("gaming-devices") || name.includes("أجهزة ترفيه")) return "🎢";
    if (slug.includes("kids-games") || name.includes("ألعاب أطفال")) return "🧸";
    if (slug.includes("hobbies") || name.includes("هوايات")) return "🎨";
    if (slug.includes("game") || name.includes("ألعاب")) return "🎮";

    // Services
    if (slug.includes("home-services") || name.includes("خدمات منزلية")) return "🏠";
    if (slug.includes("maintenance") || name.includes("صيانة")) return "🔧";
    if (slug.includes("transportation") || name.includes("نقل")) return "🚚";
    if (slug.includes("design") || name.includes("تصميم")) return "📐";
    if (slug.includes("educational-services") || name.includes("خدمات تعليمية")) return "🎓";
    if (slug.includes("service") || name.includes("خدمات")) return "🛠️";

    // Tools & Equipment
    if (slug.includes("electric-tools") || name.includes("أدوات كهربائية")) return "⚡";
    if (slug.includes("mechanical-tools") || name.includes("أدوات ميكانيكية")) return "🛠️";
    if (slug.includes("home-equipment") || name.includes("معدات منزلية")) return "🏠";
    if (slug.includes("industrial-equipment") || name.includes("معدات صناعية")) return "🏭";
    if (slug.includes("garden-tools") || name.includes("أدوات الحدائق")) return "🏡";
    if (slug.includes("tools-equipment") || name.includes("أدوات والمعدات")) return "🔧";

    // Travel & Tourism
    if (slug.includes("tourism-trips") || name.includes("رحلات سياحية")) return "🌴";
    if (slug.includes("hotel-bookings") || name.includes("حجوزات فنادق")) return "🏨";
    if (slug.includes("travel-tickets") || name.includes("تذاكر سفر")) return "🎫";
    if (slug.includes("leisure-activities") || name.includes("أنشطة ترفيهية")) return "🎡";
    if (slug.includes("travel") || name.includes("سفر") || name.includes("سياح")) return "✈️";

    // Sports
    if (slug.includes("sports-devices") || name.includes("أجهزة رياضية")) return "🏋️";
    if (slug.includes("sports-gear") || name.includes("معدات رياضية")) return "🎾";
    if (slug.includes("sports-clothing") || name.includes("ملابس رياضية")) return "🎽";
    if (slug.includes("food-supplements") || name.includes("مكملات غذائية")) return "💊";
    if (slug.includes("bodybuilding") || name.includes("كمال أجسام")) return "💪";
    if (slug.includes("sport") || name.includes("رياض")) return "⚽";

    // Books
    if (slug.includes("educational-books") || name.includes("كتب تعليمية")) return "📖";
    if (slug.includes("religious-books") || name.includes("كتب دينية")) return "🕋";
    if (slug.includes("literary-books") || name.includes("كتب أدبية")) return "📜";
    if (slug.includes("magazines") || name.includes("مجلات")) return "📰";
    if (slug.includes("kids-books") || name.includes("كتب أطفال")) return "👦";
    if (slug.includes("book") || name.includes("كتب")) return "📚";

    // Food
    if (slug.includes("dry-foods") || name.includes("مواد غذائية جافة")) return "🌾";
    if (slug.includes("vegetables-fruits") || name.includes("خضروات وفواكه")) return "🥦";
    if (slug.includes("meat-poultry") || name.includes("لحوم ودواجن")) return "🍗";
    if (slug.includes("dairy-products") || name.includes("منتجات ألبان")) return "🧀";
    if (slug.includes("wholesale-foods") || name.includes("مواد بالجملة")) return "📦";
    if (slug.includes("food") || name.includes("مواد غذائية") || name.includes("طعام")) return "🍎";

    // Home Appliances
    if (slug.includes("refrigerators") || name.includes("ثلاجات")) return "❄️";
    if (slug.includes("washing-machines") || name.includes("غسالات")) return "🧺";
    if (slug.includes("air-conditioners") || name.includes("مكيفات")) return "🌬️";
    if (slug.includes("ovens-microwaves") || name.includes("أفران وميكروويف")) return "♨️";
    if (slug.includes("kitchen-appliances") || name.includes("أجهزة مطبخ")) return "🥘";
    if (slug.includes("small-appliances") || name.includes("أجهزة كهربائية صغيرة")) return "🔌";
    if (slug.includes("vacuum-cleaners") || name.includes("مكانس كهربائية")) return "🧹";
    if (slug.includes("water-heaters") || name.includes("سخانات مياه")) return "🚿";
    if (slug.includes("appliances") || name.includes("أجهزة منزلية")) return "🏠";
    
    return "📁"; // Default folder icon
  };

  const selectedSubcategory = useMemo(() => {
    return category?.children?.find(c => c.slug === subSlug) || 
           (category?.slug === "purchase-orders" ? purchaseOrderMainCategories.find(c => c.slug === subSlug) : null);
  }, [category, subSlug, purchaseOrderMainCategories]);

  useEffect(() => {
    if (selectedSubcategory && category?.slug === "purchase-orders") {
      categoryApi.getCategoryChildren(selectedSubcategory.id).then(res => {
        setSubSubCategories(res.data || []);
      });
    } else {
      setSubSubCategories([]);
    }
  }, [selectedSubcategory, category?.slug, categoryApi]);

  const loadCategoryAttributes = useCallback(async (categoryId) => {
    if (!categoryId || lastLoadedCategoryId.current === categoryId) return;
    
    try {
      setLoadingAttributes(true);
      lastLoadedCategoryId.current = categoryId;
      const res = await attributeApi.getCategoryAttributes(categoryId, { includeAncestors: true });
      const attrs = res.data || [];
      setCategoryAttributes(attrs);
    } catch (error) {
      console.error("Error loading category attributes:", error);
      lastLoadedCategoryId.current = null;
    } finally {
      setLoadingAttributes(false);
    }
  }, [attributeApi]);

  const loadCategory = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const adType = currentSlug === "purchase-orders" ? "order" : undefined;
      const response = await categoryApi.getCategoryBySlug(currentSlug, adType);
      const cat = response.data;
      setCategory(cat);
      
      // Load attributes for this category
      if (cat?.id) {
        loadCategoryAttributes(cat.id);
      }

      // If this is Purchase Orders, fetch all other main categories to show as subcategories
      if (cat.slug === "purchase-orders") {
        const mainRes = await categoryApi.getMainCategories("order");
        const allMains = mainRes.data || [];
        setPurchaseOrderMainCategories(allMains.filter(c => c.slug !== "purchase-orders"));
      }
    } catch (error) {
      setError(error.response?.data?.error || "تعذر تحميل الفئة");
    } finally {
      // Don't set loading false here, loadAds will do it
    }
  }, [categoryApi, currentSlug, loadCategoryAttributes]);

  const loadBreadcrumbs = useCallback(async () => {
    if (!category) return;
    try {
      const response = await categoryApi.getBreadcrumbs(category.id);
      setBreadcrumbs(response.data);
    } catch (error) {
      console.error("Error loading breadcrumbs:", error);
    }
  }, [category, categoryApi]);

  const loadAds = useCallback(async (isInitial = false) => {
    if (!category?.id) return;
    
    // Only show full-page loading on initial load or if we don't have ads yet
    // Otherwise use isFetching for a smoother experience (no scroll jump)
    if (ads.length > 0 && !isInitial) setIsFetching(true);
    else setLoading(true);

    try {
      const currentLimit = 20;
      const isInitialRestore = isInitial && page > 1;

      // If we have a subSlug, we need to find that subcategory's ID
      let categoryId = category.id;
      let adType = category.slug === "purchase-orders" ? "order" : undefined;

      // Special handling for Purchase Orders root: show ALL orders
      if (category.slug === "purchase-orders" && !subSlug && !subSubSlug) {
        categoryId = undefined;
      } else if (subSubSlug) {
        // Try to find it in the current list
        let subSub = subSubCategories.find(c => c.slug === subSubSlug);
        
        // If not found (e.g. direct deep link), we might need to fetch it
        if (!subSub && category.slug === "purchase-orders") {
          try {
            const subRes = await categoryApi.getCategoryBySlug(subSubSlug);
            if (subRes.data) {
              categoryId = subRes.data.id;
            }
          } catch (e) {
            console.error("Failed to fetch sub-sub category for deep link:", e);
          }
        } else if (subSub) {
          categoryId = subSub.id;
        }
      } else if (subSlug) {
        // Look in children first
        let sub = category.children?.find(c => c.slug === subSlug);
        // If not found and we are in Purchase Orders, look in main categories
        if (!sub && category.slug === "purchase-orders") {
          sub = purchaseOrderMainCategories.find(c => c.slug === subSlug);
        }
        if (sub) categoryId = sub.id;
      }

      const response = await api.get("/ads", {
        params: {
          ...Object.fromEntries(searchParams.entries()),
          categoryId: categoryId,
          adType: adType,
          status: "approved",
          limit: isInitialRestore ? page * currentLimit : currentLimit,
          page: isInitialRestore ? 1 : page
        }
      });

      const responseData = response.data || {};
      const newAds = responseData.items || responseData || [];
      const totalFromResponse = responseData.total || newAds.length;

      if (page === 1 || isInitialRestore) {
        setAds(newAds);
      } else {
        setAds(prev => [...prev, ...newAds]);
      }
      setTotalAds(totalFromResponse);
      
      // Use total ads count from response and current page to determine if more ads are available
      const currentAdsCount = isInitialRestore ? newAds.length : ((page - 1) * currentLimit + newAds.length);
      setHasMore(currentAdsCount < totalFromResponse);
    } catch (error) {
      console.error("Error loading ads:", error);
    } finally {
      setLoading(false);
      setIsFetching(false);
    }
  }, [category, page, subSlug, subSubSlug, api, subSubCategories, searchParams.toString()]);

  const loadMore = useCallback(() => {
    if (hasMore && !isFetching) {
      const next = new URLSearchParams(searchParams);
      next.set("page", (page + 1).toString());
      navigate(`?${next.toString()}`, { replace: true, preventScrollReset: true });
    }
  }, [hasMore, isFetching, page, searchParams.toString(), navigate]);

  useEffect(() => {
    if (category) {
      let activeId = category.id;
      if (subSubSlug && subSubCategories.length > 0) {
        const subSub = subSubCategories.find(s => s.slug === subSubSlug);
        if (subSub) activeId = subSub.id;
      } else if (subSlug) {
        const sub = (category.slug === "purchase-orders" ? purchaseOrderMainCategories : category.children)?.find(s => s.slug === subSlug);
        if (sub) activeId = sub.id;
      }
      loadCategoryAttributes(activeId);
    }
  }, [category, subSlug, subSubSlug, subSubCategories, purchaseOrderMainCategories, loadCategoryAttributes]);

  useEffect(() => {
    loadCategory();
  }, [loadCategory]);

  useEffect(() => {
    if (category) {
      loadAds(isFirstLoad.current);
      isFirstLoad.current = false;
      loadBreadcrumbs();
    }
    // We use searchParams.toString() as a stable dependency for search params
  }, [category, subSlug, subSubSlug, page, searchParams.toString(), loadAds, loadBreadcrumbs]);

  // Infinite Scroll Observer
  useEffect(() => {
    if (loading || !hasMore) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        loadMore();
      }
    }, { threshold: 0.1 });
    if (sentinelRef.current) observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [loading, hasMore, loadMore]);

  const handleSubcategoryClick = (child) => {
    const next = new URLSearchParams(searchParams);
    if (subSlug === child.slug) {
      next.delete("sub");
      next.delete("subSub");
    } else {
      next.set("sub", child.slug);
      next.delete("subSub");
    }
    // Clear all dynamic attribute filters when subcategory changes
    Array.from(next.keys()).forEach(key => {
      if (key.startsWith("attr_")) next.delete(key);
    });
    next.set("page", "1");
    navigate(`?${next.toString()}`, { replace: true, preventScrollReset: true });
  };

  const handleSubSubClick = (subSub) => {
    const next = new URLSearchParams(searchParams);
    if (subSubSlug === subSub.slug) {
      next.delete("subSub");
    } else {
      next.set("subSub", subSub.slug);
    }
    next.set("page", "1");
    navigate(`?${next.toString()}`, { replace: true, preventScrollReset: true });
  };

  const handleAttributeClick = (attributeId, value) => {
    const next = new URLSearchParams(searchParams);
    const attrKey = `attr_${attributeId}`;
    
    if (next.get(attrKey) === String(value)) {
      next.delete(attrKey);
    } else {
      next.set(attrKey, String(value));
    }
    next.set("page", "1");
    navigate(`?${next.toString()}`, { replace: true, preventScrollReset: true });
  };

  // Filter attributes to show only Brand and Type quick filters
  const quickFilters = useMemo(() => {
    if (!categoryAttributes) return [];
    return categoryAttributes.filter(attr => {
      if (!attr.options || attr.options.length === 0) return false;
      const label = (attr.label || "").toLowerCase();
      const name = (attr.name || "").toLowerCase();
      const isBrand = ["ماركة", "الماركة", "البراند", "براند", "brand", "make", "manufacturer", "الشركة المصنعة"].some(k => label.includes(k) || name.includes(k));
      const isType = ["النوع", "نوع", "type", "category", "الفئة", "موديل", "model"].some(k => label.includes(k) || name.includes(k));
      return isBrand || isType;
    });
  }, [categoryAttributes]);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-48"></div>
        <div className="h-48 bg-gray-200 rounded-3xl"></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="aspect-[4/5] bg-gray-200 rounded-3xl"></div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-red-600 mb-4">خطأ</h1>
        <p className="text-gray-600 mb-4">{error}</p>
        <Link to="/" className="text-emerald-600 hover:underline">
          العودة إلى الصفحة الرئيسية
        </Link>
      </div>
    );
  }

  if (!category) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">الفئة غير موجودة</h1>
        <p className="text-gray-600 mb-4">لا يمكن العثور على الفئة المطلوبة</p>
        <Link to="/" className="text-emerald-600 hover:underline">
          العودة إلى الصفحة الرئيسية
        </Link>
      </div>
    );
  }

  const handleGlobalSearch = () => {
    const q = searchQuery.trim();
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    navigate(`/search?${params.toString()}`);
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-2 text-xs text-gray-500 overflow-x-auto whitespace-nowrap pb-1">
        <Link to="/" className="hover:text-blue-600">الرئيسية</Link>
        {breadcrumbs.map((crumb, index) => (
          <Fragment key={crumb.id}>
            <svg className="h-3 w-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            {index === breadcrumbs.length - 1 ? (
              <span className="text-gray-900 font-bold">{crumb.name}</span>
            ) : (
              <Link to={`/category/${crumb.slug}`} className="hover:text-blue-600">
                {crumb.name}
              </Link>
            )}
          </Fragment>
        ))}
      </nav>

      {/* Category Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 to-indigo-700 p-8 text-white shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex-1 text-center md:text-right">
            <h1 className="text-3xl md:text-5xl font-black mb-4 leading-tight">
              {category.name}
            </h1>
            {category.description && (
              <p className="text-blue-50/80 max-w-2xl text-sm md:text-base leading-relaxed mb-6">
                {category.description}
              </p>
            )}
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
              <div className="px-4 py-2 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 text-sm font-bold">
                {totalAds.toLocaleString("ar-EG")} إعلان متاح
              </div>
              <button
                onClick={() => setShowAdvancedModal(true)}
                className="px-4 py-2 rounded-xl bg-white text-blue-600 text-sm font-bold shadow-lg hover:bg-blue-50 transition-all active:scale-95"
              >
                تصفية النتائج
              </button>
            </div>
          </div>
          {category.image && (
            <div className="h-32 w-32 md:h-48 md:w-48 rounded-2xl bg-white/10 backdrop-blur-md p-2 flex-shrink-0">
              <img
                src={uploadsUrl(category.image, "thumb")}
                alt={category.name}
                className="h-full w-full rounded-xl object-cover"
              />
            </div>
          )}
        </div>
        
        {/* Decorative elements */}
        <div className="absolute -bottom-10 -right-10 h-40 w-40 rounded-full bg-white/5 blur-3xl"></div>
        <div className="absolute -top-10 -left-10 h-40 w-40 rounded-full bg-blue-400/10 blur-3xl"></div>
      </div>

      {/* Horizontal Subcategories - Improved design */}
      {(category.slug === "purchase-orders" ? purchaseOrderMainCategories.length > 0 : (category.children && category.children.length > 0)) && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black text-gray-900 uppercase tracking-wider">
              {category.slug === "purchase-orders" ? "اختر نوع الطلب" : "الأقسام الفرعية"}
            </h2>
            {selectedSubcategory && (
              <button
                onClick={() => handleSubcategoryClick(selectedSubcategory)}
                className="text-xs font-bold text-red-600 hover:underline"
              >
                مسح التصفية
              </button>
            )}
          </div>
          <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-blue-200 scrollbar-track-transparent">
            <div className="flex gap-3 min-w-full pb-1">
              {(category.slug === "purchase-orders" ? purchaseOrderMainCategories : category.children).map((child) => (
                <button
                  key={child.id}
                  onClick={() => handleSubcategoryClick(child)}
                  className={`flex flex-col items-center gap-2 min-w-[110px] p-4 rounded-2xl transition-all border shrink-0 ${
                    selectedSubcategory?.id === child.id
                      ? "bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-100 scale-[1.02]"
                      : "bg-white border-gray-100 text-gray-700 hover:border-blue-200 hover:bg-blue-50"
                  }`}
                >
                  <div className={`h-14 w-14 rounded-2xl flex items-center justify-center text-2xl shadow-sm transition-transform group-hover:scale-110 ${
                    selectedSubcategory?.id === child.id ? "bg-white/20" : "bg-blue-50 dark:bg-slate-800"
                  }`}>
                    {getCategoryIcon(child)}
                  </div>
                  <div className="text-center mt-1">
                    <p className="text-[12px] font-black truncate max-w-[90px]">{child.name}</p>
                    <p className={`text-[10px] mt-0.5 ${selectedSubcategory?.id === child.id ? "text-blue-100" : "text-gray-400"}`}>
                      {child.adCount || 0} إعلان
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Third Level Subcategories for Purchase Orders */}
          {category.slug === "purchase-orders" && selectedSubcategory && subSubCategories.length > 0 && (
            <div className="mt-4 animate-in slide-in-from-top-2 duration-300">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">الأقسام التفصيلية</h3>
                {subSubSlug && (
                  <button
                    onClick={() => {
                      const next = new URLSearchParams(searchParams);
                      next.delete("subSub");
                      navigate(`?${next.toString()}`, { replace: true });
                    }}
                    className="text-[9px] font-bold text-red-500 hover:underline"
                  >
                    مسح القسم
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {subSubCategories.map((subSub) => (
                  <button
                    key={subSub.id}
                    className={`px-4 py-2 rounded-full text-[11px] font-bold transition-all border ${
                      subSubSlug === subSub.slug
                        ? "bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-100"
                        : "bg-gray-50 border-gray-100 text-gray-600 hover:bg-blue-50 hover:border-blue-100 hover:text-blue-600"
                    }`}
                    onClick={() => handleSubSubClick(subSub)}
                  >
                    {subSub.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Category Attributes Filters */}
      {quickFilters.length > 0 && (
        <div className="space-y-6 animate-in fade-in duration-700">
          {quickFilters.map((attr) => {
            const attrKey = `attr_${attr.id || attr._id}`;
            const activeValue = searchParams.get(attrKey);
            
            return (
              <div key={attr.id || attr._id} className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-[11px] font-black text-gray-400 uppercase tracking-widest">{attr.label}</h2>
                  {activeValue && (
                    <button
                      onClick={() => {
                        const next = new URLSearchParams(searchParams);
                        next.delete(attrKey);
                        navigate(`?${next.toString()}`, { replace: true, preventScrollReset: true });
                      }}
                      className="text-[10px] font-bold text-red-500 hover:underline"
                    >
                      مسح التصفية
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {attr.options
                    .flatMap(opt => typeof opt === 'string' ? opt.split(/[,،]/).map(s => s.trim()) : opt)
                    .filter(Boolean)
                    .map((option) => {
                      const isActive = activeValue === option;
                      return (
                        <button
                          key={option}
                          onClick={() => handleAttributeClick(attr.id || attr._id, option)}
                          className={`px-5 py-2 rounded-full text-[13px] font-bold transition-all border shadow-sm ${
                            isActive
                              ? "bg-blue-600 border-blue-600 text-white shadow-blue-100 scale-[1.05]"
                              : "bg-white border-gray-100 text-gray-700 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600"
                          }`}
                        >
                          {option}
                        </button>
                      );
                    })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-8 pt-4">
        {/* Sidebar - Desktop Only */}
        <aside className="hidden lg:block w-72 flex-shrink-0 space-y-6">
          <div className="sticky top-24">
            <CategoryTree />
          </div>
        </aside>

        {/* Ads Grid */}
        <div className="flex-1 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-black text-gray-900">
              {selectedSubcategory ? `إعلانات ${selectedSubcategory.name}` : "أحدث الإعلانات"}
            </h3>
            {isFetching && (
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 border-2 border-blue-600/20 border-t-blue-600 rounded-full animate-spin"></div>
                <span className="text-[10px] font-bold text-blue-600">جارٍ التحديث...</span>
              </div>
            )}
          </div>

          {ads.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-3xl border border-dashed border-gray-200">
              <div className="h-16 w-16 bg-gray-50 rounded-full flex items-center justify-center mb-4 text-gray-300">
                <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 01-2-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <p className="text-sm font-bold text-gray-500">لا توجد إعلانات حالياً في هذا القسم</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:gap-6 xl:grid-cols-3">
                {ads.map((ad) => (
                  <ProductCard
                    key={ad._id}
                    product={ad}
                    to={`/ad/${ad._id}`}
                    featured={!!ad.featured}
                  />
                ))}
              </div>

              {/* Infinite Scroll Sentinel & Loading Indicator */}
              <div ref={sentinelRef} className="mt-12 flex flex-col items-center justify-center pb-12 min-h-[100px]">
                {loading && page > 1 && (
                  <div className="flex flex-col items-center gap-3">
                    <div className="h-8 w-8 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin"></div>
                    <span className="text-xs font-black text-blue-600">جارٍ تحميل المزيد...</span>
                  </div>
                )}
                {!loading && hasMore && (
                  <div className="h-4 w-full" />
                )}
                {!hasMore && ads.length > 0 && (
                  <span className="text-xs font-bold text-gray-400">لقد وصلت لنهاية النتائج</span>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <AdvancedSearchModal
        isOpen={showAdvancedModal}
        onClose={() => setShowAdvancedModal(false)}
        initialFilters={{
          categoryId: category?.id,
          subCategoryId: selectedSubcategory?.id
        }}
      />
    </div>
  );
}
