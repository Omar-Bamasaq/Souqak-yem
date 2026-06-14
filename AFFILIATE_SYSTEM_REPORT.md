# تقرير تفصيلي لنظام التسويق بالعمولة (نظام Resell)

## 1. الصفحات المتعلقة بالنظام (Frontend Pages)
| الملف | المسار الكامل | الوصف |
|-------|----------------|--------|
| ResellerDashboard.jsx | `frontend/src/pages/ResellerDashboard.jsx` | لوحة تحكم المسوقين بالعمولة |
| ResellRequests.jsx | `frontend/src/pages/ResellRequests.jsx` | صفحة طلبات التسويق للمنتجات |
| HowToEarn.jsx | `frontend/src/pages/HowToEarn.jsx` | صفحة توضيح كيفية كسب المال من التسويق بالعمولة |

---

## 2. صفحات تحتاج تعديل فقط (لا تحذف)
| الملف | المسار الكامل | ما يحتاج تعديله |
|-------|----------------|-----------------|
| ProductDetail.jsx | `frontend/src/pages/ProductDetail.jsx` | ازالة زر "ابدأ التسويق" |
| AddProduct.jsx | `frontend/src/pages/AddProduct.jsx` | ازالة خيارات تفعيل/تعطيل التسويق للمنتج |
| EditAd.jsx | `frontend/src/pages/EditAd.jsx` | ازالة خيارات تفعيل/تعطيل التسويق للمنتج |
| HowItWorks.jsx | `frontend/src/pages/HowItWorks.jsx` | ازالة المحتوى المتعلق بالتسويق بالعمولة |
| SellerDashboard.jsx | `frontend/src/pages/SellerDashboard.jsx` | ازالة روابط/قسائم التسويق بالعمولة |
| Chat.jsx | `frontend/src/pages/Chat.jsx` | ازالة أي ميزات مرتبطة بالتسويق |
| Notifications.jsx | `frontend/src/pages/Notifications.jsx` | ازالة أنواع الإشعارات المرتبطة بالتسويق |
| SearchResults.jsx | `frontend/src/pages/SearchResults.jsx` | ازالة أي مراجع للتسويق في عرض المنتجات |
| ProductCard.jsx | `frontend/src/components/ProductCard.jsx` | ازالة أي أجزاء مرتبطة بالتسويق في بطاقة المنتج |
| AdvancedSearchModal.jsx | `frontend/src/components/AdvancedSearchModal.jsx` | ازالة مراجع للتسويق في البحث المتقدم |
| AdminLayout.jsx | `frontend/src/pages/AdminLayout.jsx` | ازالة أي روابط للتسويق في القائمة |
| Login.jsx | `frontend/src/pages/Login.jsx` | ازالة أي مراجع للتسويق |

---

## 3. ملفات وحدات البرمجة (Backend Models)
| الملف | المسار الكامل | الوصف |
|-------|----------------|--------|
| ResellAd.js | `backend/src/models/ResellAd.js` | نموذج بيانات الإعلانات المسوقة |
| ResellRequest.js | `backend/src/models/ResellRequest.js` | نموذج بيانات طلبات التسويق |
| ResellTransaction.js | `backend/src/models/ResellTransaction.js` | نموذج بيانات المعاملات للمسوقين |

---

## 4. ملفات وحدات البرمجة (Backend Routes)
| الملف | المسار الكامل | الوصف |
|-------|----------------|--------|
| resell.js | `backend/src/routes/resell.js` | مسارات الـ API الخاصة بنظام التسويق |

---

## 5. ملفات تحتاج تعديل فقط (Backend)
| الملف | المسار الكامل | ما يحتاج تعديله |
|-------|----------------|-----------------|
| index.js | `backend/src/index.js` | ازالة تعريف مسار `/api/resell` |
| User.js | `backend/src/models/User.js` | ازالة أي حقول مرتبطة بالتسويق بالعمولة |
| Order.js | `backend/src/models/Order.js` | ازالة حقول `reseller` أو أي مراجع للتسويق |
| Notification.js | `backend/src/models/Notification.js` | ازالة أنواع الإشعارات للتسويق |
| ads.js | `backend/src/routes/ads.js` | ازالة منطق التسويق في عرض/إضافة المنتجات |
| orders.js | `backend/src/routes/orders.js` | ازالة منطق حساب العمولات للمسوقين |
| conversations.js | `backend/src/routes/conversations.js` | ازالة أي منطق مرتبط بالتسويق |
| favorites.js | `backend/src/routes/favorites.js` | ازالة مراجع للتسويق |
| smartSearchService.js | `backend/src/services/smartSearchService.js` | ازالة أي منطق للتسويق في البحث |
| smartSearchService.sort.test.js | `backend/src/services/__tests__/smartSearchService.sort.test.js` | ازالة اختبارات مرتبطة بالتسويق |

---

## 6. ملفات الترجمة
| الملف | المسار الكامل | ما يحتاج تعديله |
|-------|----------------|-----------------|
| index.js | `frontend/src/i18n/index.js` | ازالة المفاتيح الترجمية للنظام التسويق |

---

## 7. صفحات التوجيه (Routes) تحتاج تعديل
| الملف | المسار الكامل | ما يحتاج تعديله |
|-------|----------------|-----------------|
| App.jsx | `frontend/src/App.jsx` | ازالة التوجيهات لصفحات ResellerDashboard, ResellRequests, HowToEarn |

---

## 8. التحقق من عدم تعارض مع أنظمة أخرى
✅ جميع الملفات المحددة للتعليق أو الحذف مرتبطة فقط بنظام التسويق بالعمولة، ولن تؤثر على باقي أجزاء النظام بعد الحذف.
