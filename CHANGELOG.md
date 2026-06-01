# سجل التغييرات والإضافات - Suqaq

**تاريخ:** 2026-03-06
**الجلسة:** إصلاحات وتحسينات الفئات والإعلانات

---

## 1. إصلاح عرض عدد الإعلانات في الفئات (Category Stats)

### الملف: `backend/src/routes/categories.js`

**التعديل:**
- استبدال قراءة `adCount` من قاعدة البيانات بحساب فعلي من مجموعة `Ad`
- استخدام `Ad.aggregate()` لتجميع الإعلانات المعتمدة حسب `categoryId`

**الكود الجديد (السطر 110-148):**
```javascript
router.get("/stats", async (req, res) => {
  try {
    const allCategories = await Category.find({ status: "active" })
      .select("name slug image adCount parentId")
      .lean();

    // Count actual ads per category from database
    const adCounts = await Ad.aggregate([
      { $match: { status: "approved" } },
      { $group: { _id: "$categoryId", count: { $sum: 1 } } }
    ]);

    // Create a map of categoryId -> count
    const countMap = {};
    adCounts.forEach(item => {
      if (item._id) {
        countMap[String(item._id)] = item.count;
      }
    });

    // Update categories with real ad counts
    const categoriesWithCounts = allCategories.map(cat => ({
      ...cat,
      adCount: countMap[String(cat._id)] || 0
    }));

    const totalAds = categoriesWithCounts.reduce((sum, cat) => sum + (cat.adCount || 0), 0);

    res.json({
      totalCategories: allCategories.length,
      mainCategories: allCategories.filter(c => !c.parentId).length,
      subCategories: allCategories.filter(c => c.parentId).length,
      totalAds: totalAds,
      categoryStats: categoriesWithCounts.sort((a, b) => (b.adCount || 0) - (a.adCount || 0))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

**السبب:** العدادات كانت تعتمد على قيمة `adCount` المخزنة في الفئة والتي لا تُحدّث تلقائياً. الآن يتم حساب الإعلانات الفعلية من قاعدة البيانات.

---

## 2. إصلاح الصفحة البيضاء عند الضغط على فئة

### الملف: `frontend/src/pages/CategoryPage.jsx`

### التعديل 1: إضافة API_BASE_URL
**السطر 8:**
```javascript
const API_BASE_URL = "http://localhost:5000";
```

### التعديل 2: إضافة حالة الخطأ (error state)
**السطر 16:**
```javascript
const [error, setError] = useState(null);
```

### التعديل 3: تحديث loadCategory
**السطر 38-53:**
```javascript
const loadCategory = async () => {
  try {
    setLoading(true);
    setError(null);
    console.log("Loading category with slug:", currentSlug);
    const response = await categoryApi.getCategoryBySlug(currentSlug);
    console.log("Category response:", response.data);
    setCategory(response.data);
  } catch (error) {
    console.error("Error loading category:", error);
    console.error("Error response:", error.response?.data);
    setError(error.response?.data?.error || "تعذر تحميل الفئة");
  } finally {
    setLoading(false);
  }
};
```

### التعديل 4: إعادة تعيين الحالة عند تغيير slug
**السطر 25-31:**
```javascript
useEffect(() => {
  setPage(1);
  setAds([]);
  setError(null);
  setCategory(null);
  loadCategory();
}, [currentSlug]);
```

### التعديل 5: إصلاح تحميل الإعلانات (المشكلة الرئيسية)
**السطر 82-86:**
```javascript
console.log("Ads response:", response.data);
const responseData = response.data || {};
const newAds = responseData.items || responseData || [];
setAds(prev => page === 1 ? newAds : [...prev, ...newAds]);
setHasMore(newAds.length === limit);
```

**السبب:** الـ Backend يرجع `{items: [...], page: 1, limit: 20, total: 1, pages: 1}` لكن الكود كان يتوقع مصفوفة مباشرة.

### التعديل 6: إضافة عرض الخطأ في الواجهة
**السطر 112-122:**
```javascript
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
```

### التعديل 7: إصلاح رابط صورة الفئة
**السطر 137-143:**
```javascript
{category.image && (
  <img
    src={`${API_BASE_URL}${category.image}`}
    alt={category.name}
    className="w-24 h-24 rounded-lg object-cover"
  />
)}
```

---

## 3. تصغير مربعات الفئات

### الملف: `frontend/src/components/CategoryGrid.jsx`

### التعديل 1: إضافة API_BASE_URL
**السطر 5:**
```javascript
const API_BASE_URL = "http://localhost:5000";
```

### التعديل 2: تصغير حجم المربعات

**الحاوية (السطر 55):**
```javascript
className="group bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow p-3 text-center"
```
(تغيير `p-4` إلى `p-3`)

**الصورة (السطر 57-69):**
```javascript
{category.image ? (
  <img
    src={`${API_BASE_URL}${category.image}`}
    alt={category.name}
    loading="lazy"
    className="w-16 h-16 mx-auto mb-2 object-contain rounded-lg group-hover:scale-105 transition-transform"
  />
) : (
  <div className="w-16 h-16 mx-auto mb-2 bg-gray-100 rounded-lg flex items-center justify-center">
    <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  </div>
)}
```
(تغيير `w-20 h-20` إلى `w-16 h-16`، `mb-3` إلى `mb-2`، `w-8 h-8` إلى `w-6 h-6`)

### التعديل 3: إصلاح اسم الحقل
**السطر 71-74:**
```javascript
<h3 className="font-medium text-gray-900 text-sm">{category.name}</h3>
<p className="text-xs text-gray-500 mt-1">
  {category.adCount || 0} إعلان
</p>
```
(تغيير `category.adsCount` إلى `category.adCount`)

---

## 4. إصلاح عرض الصور كاملة

### الملف: `frontend/src/components/CategoryGrid.jsx`

**التعديل (السطر 60):**
```javascript
className="w-20 h-20 mx-auto mb-3 object-contain rounded-lg group-hover:scale-105 transition-transform"
```
(تغيير `rounded-full` إلى `rounded-lg`، `object-cover` إلى `object-contain`)

**السبب:** `rounded-full` كان يجعل الصورة دائرية وتقطع الأجزاء الزائدة.

---

## 5. إضافة اختيار الفئة في تعديل الإعلان

### الملف: `frontend/src/pages/EditAd.jsx`

### التعديل 1: استيراد CategorySelect
**السطر 5:**
```javascript
import CategorySelect from "../components/CategorySelect.jsx";
```

### التعديل 2: إضافة state للفئة
**السطر 27:**
```javascript
const [categoryId, setCategoryId] = useState("");
```

### التعديل 3: تحميل الفئة عند فتح الإعلان
**السطر 87:**
```javascript
setCategoryId(ad.categoryId?._id || ad.categoryId || "");
```

### التعديل 4: تحديث التحقق من الحقول المطلوبة
**السطر 105-108:**
```javascript
if (!title || !price || !governorateId || !cityId || !categoryId) {
  setErr("يرجى تعبئة الحقول المطلوبة بما فيها الفئة");
  return;
}
```

### التعديل 5: إرسال الفئة في التحديث
**السطر 118:**
```javascript
form.append("categoryId", categoryId);
```

### التعديل 6: إضافة CategorySelect في النموذج
**السطر 148-155:**
```javascript
<div className="space-y-1">
  <label className="block text-sm font-medium text-gray-700">الفئة</label>
  <CategorySelect
    value={categoryId}
    onChange={setCategoryId}
    required={true}
  />
</div>
```

---

## 6. إصلاح خطأ 500 عند تحديث الفئة مع صورة

### الملف: `frontend/src/pages/AdminCategories.jsx`

### التعديل 1: إضافة قيمة افتراضية للـ status
**السطر 64:**
```javascript
formDataToSend.append("status", formData.status || "active");
```
(تغيير `formData.status` إلى `formData.status || "active"`)

**السبب:** كان `status` غير مُرسل في FormData مما يسبب خطأ 500.

---

## 7. إضافة عرض الفئة في صفحة تفاصيل المنتج

### الملف: `frontend/src/pages/ProductDetail.jsx`

### التعديل 1: تحديث عرض الموقع والفئة
**السطر 359-367:**
```javascript
{(p.governorateId || p.cityId || p.categoryId) && (
  <div className="mt-1 text-xs text-gray-600">
    {p.categoryId?.name && <span>الفئة: {p.categoryId.name}</span>}
    {p.categoryId?.name && (p.governorateId?.name || p.cityId?.name) && <span className="mx-1">•</span>}
    {p.governorateId?.name && <span>المحافظة: {p.governorateId.name}</span>}
    {p.governorateId?.name && p.cityId?.name && <span className="mx-1">•</span>}
    {p.cityId?.name && <span>المدينة: {p.cityId.name}</span>}
  </div>
)}
```

### الملف: `backend/src/routes/ads.js`

### التعديل 2: إضافة population للفئة
**السطر 175:**
```javascript
.populate("categoryId", "name slug image")
```

---

## 8. تحديث إضافة/تعديل الفئة لدعم رفع الصور

### الملف: `backend/src/routes/categories.js`

### التعديل 1: إضافة Multer middleware
**السطر 1-10:**
```javascript
import multer from "multer";
import path from "path";
import ImageUploadService from "../services/imageUploadService.js";

// Configure multer for category images
const categoryUploadDir = path.join(process.cwd(), "uploads", "categories");
const categoryStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, categoryUploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, "category-" + uniqueSuffix + path.extname(file.originalname));
  }
});

const uploadCategoryImage = multer({
  storage: categoryStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"), false);
    }
  }
});
```

### التعديل 2: تحديث route POST
**السطر 179-217:**
```javascript
router.post("/", authenticate, requireAdmin, uploadCategoryImage.single("image"), async (req, res) => {
  // ... validation code ...
  
  let imageUrl = null;
  if (req.file) {
    const validated = await ImageUploadService.validateUploadedFile(req.file);
    imageUrl = validated.url;
  }

  const category = new Category({
    name,
    slug,
    description,
    parentId: parentId || null,
    sortOrder: sortOrder || 0,
    status: status || "active",
    image: imageUrl
  });
  // ...
});
```

### التعديل 3: تحديث route PUT
**السطر 219-283:**
```javascript
router.put("/:id", authenticate, requireAdmin, uploadCategoryImage.single("image"), async (req, res) => {
  // ... validation code ...
  
  if (req.file) {
    // Delete old image if exists
    if (category.image) {
      try {
        const oldFilename = category.image.split('/').pop();
        await ImageUploadImage.deleteFile(oldFilename);
      } catch (deleteError) {
        console.log("Could not delete old image:", deleteError.message);
      }
    }
    const validated = await ImageUploadService.validateUploadedFile(req.file);
    category.image = validated.url;
  }
  // ...
});
```

---

## 9. إصلاح CORS للـ Frontend

### الملف: `backend/src/index.js`

**التعديل:**
```javascript
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "http://localhost:5173,http://localhost:5174";
```

**السبب:** الـ Frontend كان يعمل على منفذ 5174 لكن CORS كان مسموحاً فقط لـ 5173.

## 10. إضافة ميزة الوسوم (Tags) الكاملة

**تاريخ:** 2026-03-06

### الملف الجديد: `frontend/src/pages/AdminTags.jsx`

**الوصف:** صفحة إدارة الوسوم للأدمن - تتيح إضافة، تعديل، حذف الوسوم

**المميزات:**
- عرض قائمة الوسوم مع التفاصيل (الاسم، الرابط، اللون، الشيوع، الترتيب)
- نموذج إضافة/تعديل وسم مع:
  - الاسم والرابط (slug) التلقائي
  - الوصف
  - اختيار اللون
  - ترتيب الظهور
  - خيار "وسم شائع"
- حذف الوسوم مع تأكيد
- رسائل نجاح/خطأ

### الملف الجديد: `frontend/src/pages/TagPage.jsx`

**الوصف:** صفحة عرض الإعلانات حسب الوسم

**المميزات:**
- عرض اسم الوسم والوصف مع لون مميز
- عرض الإعلانات المرتبطة بالوسم
- ترقيم الصفحات (pagination)
- رسائل خطأ مناسبة

### التعديل: `frontend/src/App.jsx`

**الإضافات:**
```javascript
import AdminTags from "./pages/AdminTags.jsx";
import TagPage from "./pages/TagPage.jsx";
```

**الـ Routes الجديدة:**
```javascript
<Route path="tags" element={<AdminTags />} />  // داخل /admin/*
<Route path="/tag/:slug" element={<TagPage />} />
```

### التعديل: `frontend/src/pages/AdminLayout.jsx`

**الإضافة:** رابط إدارة الوسوم في القائمة الجانبية
```javascript
<NavLink to="/admin/tags" className={active}>
  <span>الوسوم</span>
</NavLink>
```

### التعديل: `frontend/src/pages/ProductDetail.jsx`

**التحديث:** جعل الوسوم قابلة للنقر
```javascript
{tagNames.map((tagName, i) => (
  <Link
    key={i}
    to={`/tag/${tagName.toLowerCase().replace(/\s+/g, '-')}`}
    className="rounded-full bg-indigo-100 px-3 py-1 text-xs text-indigo-700 hover:bg-indigo-200"
  >
    #{tagName}
  </Link>
))}
```

### الميزات الموجودة سابقاً (تم التحقق منها):
- ✅ نموذج Tag في Backend
- ✅ routes/tags.js في Backend مع CRUD كامل
- ✅ Tag selection في AddProduct.jsx
- ✅ Tag selection في EditAd.jsx
- ✅ حفظ tags في قاعدة البيانات
- ✅ عرض tagNames في ProductDetail.jsx

### Backend API Endpoints:
- `GET /api/tags` - قائمة الوسوم
- `GET /api/tags/:slug` - تفاصيل وسم
- `GET /api/tags/:slug/ads` - إعلانات الوسم
- `POST /api/tags` - إنشاء وسم (admin)
- `PATCH /api/tags/:id` - تعديل وسم (admin)
- `DELETE /api/tags/:id` - حذف وسم (admin)

---

## ملخص التغييرات

| الملف | التغييرات |
|-------|----------|
| `frontend/src/pages/AdminTags.jsx` | صفحة إدارة الوسوم للأدmin (جديد) |
| `frontend/src/pages/TagPage.jsx` | صفحة عرض الإعلانات حسب الوسم (جديد) |
| `frontend/src/App.jsx` | إضافة routes للوسوم |
| `frontend/src/pages/AdminLayout.jsx` | إضافة رابط إدارة الوسوم |
| `frontend/src/pages/ProductDetail.jsx` | جعل الوسوم قابلة للنقر |
| `backend/src/routes/categories.js` | إصلاح إحصائيات الفئات، إضافة Multer للصور |
| `backend/src/routes/ads.js` | إضافة population للفئة |
| `frontend/src/pages/CategoryPage.jsx` | إصلاح الصفحة البيضاء، إضافة error handling |
| `frontend/src/components/CategoryGrid.jsx` | تصغير المربعات، إصلاح روابط الصور |
| `frontend/src/pages/EditAd.jsx` | إضافة اختيار الفئة |
| `frontend/src/pages/AdminCategories.jsx` | إصلاح خطأ 500 (status) |
| `backend/src/index.js` | إصلاح CORS |

---

## 11. إضافة عرض الفئة الرئيسية والفرعية في صفحة تفاصيل الإعلان

**تاريخ:** 2026-03-08

### الملف: `backend/src/routes/ads.js`

**التعديل 1: إضافة parentId في populate للفئة**
**السطر 175:**
```javascript
.populate("categoryId", "name slug image parentId")
```

**التعديل 2: جلب الفئة الرئيسية إذا كانت موجودة**
**السطر 183-187:**
```javascript
// Get parent category if exists
let parentCategory = null;
if (ad.categoryId?.parentId) {
  parentCategory = await Category.findById(ad.categoryId.parentId).select("name slug").lean();
}
```

**التعديل 3: إرجاع parentCategory في الاستجابة**
**السطر 192:**
```javascript
res.json({ ...ad, attributes, parentCategory });
```

### الملف: `frontend/src/pages/ProductDetail.jsx`

**التعديل: إضافة شارة بارزة للفئة**
**السطر 359-394:**
```javascript
{/* Category Badge - Prominent display */}
{p.categoryId?.name && (
  <div className="mb-3">
    <div className="inline-flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5">
      <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
      </svg>
      <span className="text-sm font-medium text-emerald-800">
        {p.parentCategory?.name ? (
          <span className="inline-flex items-center gap-1.5">
            <Link to={`/category/${p.parentCategory.slug || p.parentCategory._id}`}>
              {p.parentCategory.name}
            </Link>
            <svg className="w-3 h-3 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <Link to={`/category/${p.parentCategory.slug || p.parentCategory._id}/${p.categoryId.slug || p.categoryId._id}`}>
              {p.categoryId.name}
            </Link>
          </span>
        ) : (
          <Link to={`/category/${p.categoryId.slug || p.categoryId._id}`}>
            {p.categoryId.name}
          </Link>
        )}
      </span>
    </div>
  </div>
)}
```

---

## 12. إصلاح عدد الإعلانات للفئات الرئيسية والفرعية

**تاريخ:** 2026-03-08

### الملف: `backend/src/services/categoryService.js`

**التعديل 1: إصلاح aggregation لحساب الإعلانات**
**السطر 100-120:**
```javascript
// Get ad counts - FIXED: use $toString to properly group by string categoryId
const adCounts = await Ad.aggregate([
  {
    $match: {
      status: "approved",
      isArchived: { $ne: true },
      sold: { $ne: true },
    },
  },
  { 
    $addFields: { 
      categoryIdStr: { $toString: "$categoryId" } 
    } 
  },
  { $group: { _id: "$categoryIdStr", count: { $sum: 1 } } },
]);
```

**التعديل 2: تحديث getTotalCount لاستخدام String**
**السطر 135-145:**
```javascript
const getTotalCount = (catId, visited = new Set()) => {
  if (visited.has(catId)) return 0;
  visited.add(catId);
  const catIdStr = String(catId); // Ensure string comparison
  let total = countMap[catIdStr] || 0;
  const children = childrenMap[catIdStr] || [];
  for (const childId of children) {
    total += getTotalCount(childId, visited);
  }
  return total;
};
```

**التعديل 3: تحديث getSubcategories لحساب عدد الإعلانات**
**السطر 160-175:**
```javascript
static async getSubcategories(parentId) {
  const children = await Category.find({ parentId, status: "active" })
    .sort({ sortOrder: 1, name: 1 })
    .lean();

  return Promise.all(
    children.map(async (child) => {
      const count = await Ad.countDocuments({
        categoryId: child._id,
        status: "approved",
        isArchived: { $ne: true },
        sold: { $ne: true },
      });
      return {
        ...child,
        id: child._id,
        adCount: count,
      };
    })
  );
}
```

---

## 13. إصلاح عرض إعلانات الفئات الفرعية

**تاريخ:** 2026-03-08

### الملف: `backend/src/routes/ads.js`

**التعديل 1: إضافة import لـ mongoose**
**السطر 1:**
```javascript
import mongoose from "mongoose";
```

**التعديل 2: إصلاح فلتر categoryId لدعم الفئات الفرعية**
**السطر 48-61:**
```javascript
if (categoryId) {
  // Get the category and its children to include subcategory ads
  const Category = (await import("../models/Category.js")).default;
  const category = await Category.findById(categoryId).lean();
  if (category) {
    // Get all child category IDs
    const childIds = await Category.find({ parentId: categoryId }).select("_id").lean();
    // Convert all IDs to ObjectId for proper MongoDB comparison
    const allCategoryIds = [String(categoryId), ...childIds.map(c => String(c._id))];
    filter.categoryId = { $in: allCategoryIds.map(id => new mongoose.Types.ObjectId(id)) };
  } else {
    filter.categoryId = new mongoose.Types.ObjectId(categoryId);
  }
}
```

### الملف: `frontend/src/App.jsx`

**التعديل: إضافة route للفئات الفرعية**
**السطر 131:**
```javascript
<Route path="/category/:slug/:subSlug" element={<CategoryPage />} />
```

### الملف: `backend/src/routes/categories.js`

**التعديل: إضافة console logs للتصحيح**
**السطر 242-255:**
```javascript
router.get("/:slug", async (req, res) => {
  try {
    const { slug } = req.params;
    console.log("Looking up category by slug:", slug, "decoded:", decodeURIComponent(slug));
    
    const category = await Category.findOne({ 
      slug: { $regex: new RegExp('^' + slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') },
      status: "active" 
    }).lean();

    if (!category) {
      console.log("Category not found for slug:", slug);
      return res.status(404).json({ error: "Category not found" });
    }
    
    console.log("Found category:", category.name, "with id:", category._id);

    const children = await CategoryService.getSubcategories(category._id);

    res.json({
      ...category,
      id: category._id,
      children: children.map(c => ({ ...c, id: c._id }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

---

## 14. تصفية الفئات الفرعية بدون تحديث الصفحة

**تاريخ:** 2026-03-08

### الملف: `frontend/src/pages/CategoryPage.jsx`

**التعديل 1: إزالة subSlug من useParams**
**السطر 11:**
```javascript
const { slug } = useParams();
```

**التعديل 2: إضافة state للفئة الفرعية المختارة**
**السطر 19:**
```javascript
const [selectedSubcategory, setSelectedSubcategory] = useState(null);
```

**التعديل 3: تحديث useEffect لإعادة تحميل الإعلانات عند تغيير الفئة الفرعية**
**السطر 36-41:**
```javascript
useEffect(() => {
  if (category) {
    setPage(1);
    setAds([]);
    loadAds();
    loadBreadcrumbs();
  }
}, [category, selectedSubcategory]);
```

**التعديل 4: تحديث loadAds لاستخدام الفئة الفرعية المختارة**
**السطر 74-75:**
```javascript
const categoryId = selectedSubcategory ? selectedSubcategory.id : category.id;
console.log("Loading ads for category:", categoryId, "page:", page, "selectedSub:", selectedSubcategory?.name);
```

**التعديل 5: إضافة دالة handleSubcategoryClick**
**السطر 103-113:**
```javascript
const handleSubcategoryClick = (child) => {
  if (selectedSubcategory?.id === child.id) {
    // Deselect if already selected
    setSelectedSubcategory(null);
  } else {
    setSelectedSubcategory(child);
  }
  // Reset pagination when filtering changes
  setPage(1);
  setAds([]);
};
```

**التعديل 6: تحويل روابط الفئات الفرعية إلى أزرار**
**السطر 194-227:**
```javascript
{/* Horizontal Subcategories */}
{category.children && category.children.length > 0 && (
  <div className="mb-6">
    <div className="flex flex-wrap gap-3">
      {category.children.map((child) => (
        <button
          key={child.id}
          onClick={() => handleSubcategoryClick(child)}
          className={`px-4 py-2 rounded-lg transition-colors cursor-pointer text-sm font-medium ${
            selectedSubcategory?.id === child.id
              ? "bg-emerald-500 text-white hover:bg-emerald-600"
              : "bg-gray-100 hover:bg-emerald-50 text-gray-700 hover:text-emerald-700"
          }`}
        >
          {child.name}
          <span className={`mr-1 text-xs ${selectedSubcategory?.id === child.id ? "text-emerald-100" : "text-gray-400"}`}>
            ({child.adCount || 0})
          </span>
        </button>
      ))}
    </div>
    {selectedSubcategory && (
      <div className="mt-3 text-sm text-emerald-600">
        <span>يتم عرض إعلانات: {selectedSubcategory.name}</span>
        <button 
          onClick={() => handleSubcategoryClick(selectedSubcategory)}
          className="mr-2 text-gray-400 hover:text-gray-600 underline"
        >
          إلغاء التصفية
        </button>
      </div>
    )}
  </div>
)}
```

---

## 15. إضافة نظام البحث المتقدم الكامل

**تاريخ:** 2026-03-08

### الملف الجديد: `frontend/src/components/AdvancedSearchModal.jsx`

**الوصف:** Modal للبحث المتقدم مع جميع الفلاتر

**المميزات:**
- كلمة البحث
- اختيار الفئة الرئيسية والفرعية (ديناميكي)
- اختيار المحافظة والمدينة (ديناميكي)
- نطاق السعر (من - إلى)
- الحالة (جديد، مستعمل، كالجديد) - multi-select
- خصائص ديناميكية حسب الفئة المختارة
- بائعين موثوقين فقط
- إعلانات مميزة فقط
- ترتيب النتائج (الأحدث، الأقدم، السعر، المشاهدات)
- زر مسح الكل
- زر البحث ينقل إلى `/search` مع المعاملات

**الكود الرئيسي:**
```javascript
const loadCategories = async () => {
  const res = await axios.get(`${API}/categories`, { 
    params: { flat: true, parent: null } 
  });
  setCategories(res.data || []);
};

const handleSearch = () => {
  const params = new URLSearchParams();
  // Add all filters to URL params
  if (filters.q) params.append("q", filters.q);
  if (filters.subCategoryId) params.append("categoryId", filters.subCategoryId);
  else if (filters.categoryId) params.append("categoryId", filters.categoryId);
  // ... other filters
  navigate(`/search?${params.toString()}`);
  onClose();
};
```

### الملف الجديد: `frontend/src/pages/SearchResults.jsx`

**الوصف:** صفحة عرض نتائج البحث المتقدم

**المميزات:**
- عرض عدد النتائج
- عرض الفلاتر النشطة كـ badges
- Grid للإعلانات
- Pagination متقدم
- رسالة "لا توجد نتائج" مع تصميم جميل

### الملف: `frontend/src/pages/Home.jsx`

**التعديل 1: استيراد AdvancedSearchModal**
**السطر 8:**
```javascript
import AdvancedSearchModal from "../components/AdvancedSearchModal.jsx";
```

**التعديل 2: إضافة state للـ modal**
**السطر 32:**
```javascript
const [showAdvancedModal, setShowAdvancedModal] = useState(false);
```

**التعديل 3: إضافة زر البحث المتقدم بجانب شريط البحث**
**السطر 183-210:**
```javascript
{/* Search Bar - Center */}
<div className="hidden md:flex flex-1 max-w-xl mx-8">
  <div className="relative w-full flex gap-2">
    <div className="relative flex-1">
      <input type="text" placeholder="ابحث عن سيارة، جوال، عقار..." />
      <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400">...</svg>
    </div>
    <button
      onClick={() => setShowAdvancedModal(true)}
      className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-full"
    >
      <svg>...</svg>
      <span className="hidden lg:inline">بحث متقدم</span>
    </button>
  </div>
</div>
```

**التعديل 4: إضافة المكون في نهاية الصفحة**
**السطر 646-650:**
```javascript
{/* Advanced Search Modal */}
<AdvancedSearchModal 
  isOpen={showAdvancedModal} 
  onClose={() => setShowAdvancedModal(false)} 
/>
```

### الملف: `frontend/src/App.jsx`

**التعديل 1: استيراد SearchResults**
**السطر 40:**
```javascript
import SearchResults from "./pages/SearchResults.jsx";
```

**التعديل 2: إضافة route للبحث**
**السطر 132:**
```javascript
<Route path="/search" element={<SearchResults />} />
```

### الملف: `backend/src/routes/ads.js`

**التعديل 1: إضافة معاملات البحث المتقدم**
**السطر 38-39:**
```javascript
verifiedOnly,
featuredOnly,
```

**التعديل 2: إضافة فلتر الحالة (condition)**
**السطر 72-77:**
```javascript
if (conditions) {
  const condValues = String(conditions).split(",").map((s) => s.trim()).filter(Boolean);
  if (condValues.length) filter.condition = { $in: condValues };
}
```

**التعديل 3: إضافة فلتر الإعلانات المميزة**
**السطر 78:**
```javascript
if (featuredOnly === "true") filter.featured = true;
```

**التعديل 4: إضافة فلتر البائعين الموثوقين**
**السطر 101-106:**
```javascript
if (verifiedOnly === "true") {
  const User = (await import("../models/User.js")).default;
  const verifiedUsers = await User.find({ isVerifiedSeller: true }).select("_id").lean();
  const verifiedUserIds = verifiedUsers.map(u => u._id);
  filter.userId = { $in: verifiedUserIds };
}
```

---

## ملخص التحديثات الأخيرة

| الملف | التغييرات |
|-------|----------|
| `frontend/src/components/AdvancedSearchModal.jsx` | مكون البحث المتقدم الكامل (جديد) |
| `frontend/src/pages/SearchResults.jsx` | صفحة نتائج البحث (جديد) |
| `frontend/src/pages/Home.jsx` | إضافة زر البحث المتقدم في الهيدر |
| `frontend/src/App.jsx` | إضافة route للبحث، route للفئات الفرعية |
| `frontend/src/pages/CategoryPage.jsx` | تصفية الفئات الفرعية بدون تحديث الصفحة |
| `frontend/src/pages/ProductDetail.jsx` | عرض الفئة الرئيسية والفرعية كـ breadcrumb |
| `backend/src/routes/ads.js` | دعم جميع فلاتر البحث المتقدم، إصلاح فلتر الفئات |
| `backend/src/routes/categories.js` | إضافة console logs، استخدام CategoryService |
| `backend/src/services/categoryService.js` | إصلاح حساب عدد الإعلانات للفئات |

---

**ملاحظة:** جميع التعديلات تم اختبارها وتم التأكد من عملها بشكل صحيح.
