import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { getStoreProductAvailabilityLabel } from '../src/utils/storeProductDisplay.js';

const root = process.cwd();
const appPath = path.join(root, 'src', 'App.jsx');
const navPath = path.join(root, 'src', 'components', 'NavBar.jsx');
const myStorePagePath = path.join(root, 'src', 'pages', 'MyStore.jsx');
const createStorePagePath = path.join(root, 'src', 'pages', 'CreateStore.jsx');
const addProductPagePath = path.join(root, 'src', 'pages', 'AddProduct.jsx');
const editAdPagePath = path.join(root, 'src', 'pages', 'EditAd.jsx');
const sellerSubscriptionsPagePath = path.join(root, 'src', 'pages', 'SellerSubscriptions.jsx');
const notificationBellPath = path.join(root, 'src', 'components', 'UserNotificationBell.jsx');

test('my-store route and owner page exist for store owners', () => {
  const appSource = fs.readFileSync(appPath, 'utf8');
  assert.match(appSource, /MyStore/);
  assert.match(appSource, /path="\/my-store"/);
  assert.ok(fs.existsSync(myStorePagePath), 'Expected MyStore page to exist');
});

test('account store links survive a failure loading the other store type', () => {
  const accountSource = fs.readFileSync(path.join(root, 'src', 'pages', 'AccountHub.jsx'), 'utf8');
  assert.match(accountSource, /Promise\.allSettled\(\[/);
  assert.match(accountSource, /storeLoadStatus\.store === "loaded"/);
  assert.match(accountSource, /storeLoadStatus\.family === "loaded"/);
  assert.doesNotMatch(accountSource, /storesLoading \|\| storesError \? \[\]/);
});

test('store renewal lets owners choose a paid plan and submit its receipt', () => {
  const source = fs.readFileSync(myStorePagePath, 'utf8');
  assert.ok(source.includes('api.get("/plans", { params: { type: storeType } })'));
  assert.match(source, /Number\(plan\.price \|\| 0\) > 0/);
  assert.match(source, /formData\.append\("planId", selectedPlan\._id\)/);
  assert.match(source, /formData\.append\("paymentReceipt", renewalReceipt\)/);
  assert.match(source, /تجديد أو تغيير الباقة/);
});

test('family-production owners have a separate dashboard and type-specific product flows', () => {
  const appSource = fs.readFileSync(appPath, 'utf8');
  const storeSource = fs.readFileSync(myStorePagePath, 'utf8');
  const addSource = fs.readFileSync(addProductPagePath, 'utf8');
  const editSource = fs.readFileSync(editAdPagePath, 'utf8');
  assert.match(appSource, /path="\/my-family-production"[^]*storeType="family-production"/);
  assert.match(storeSource, /params:\s*\{\s*storeType\s*\}/);
  assert.match(storeSource, /storeProducts:\s*"true",\s*storeType/);
  assert.match(storeSource, /storeType=\$\{storeType\}/);
  for (const source of [addSource, editSource]) {
    assert.match(source, /searchParams\.get\("storeType"\).*family-production/);
    assert.match(source, /form\.append\("storeType", storeType\)/);
    assert.match(source, /my-family-production/);
  }
});

test('family production is available from Souqak Services instead of being marked coming soon', () => {
  const source = fs.readFileSync(sellerSubscriptionsPagePath, 'utf8');
  assert.match(source, /\/stores\/me[\s\S]*storeType:\s*"family-production"/);
  assert.match(source, /familyProductionProfile \? "\/my-family-production" : "\/family-production\/register"/);
  assert.match(source, /التسجيل في صناعات سوقك/);
  assert.doesNotMatch(source.split('{\/\* الأسر المنتجة \*\/}')[1]?.split('{\/\* توصيل \*\/}')[0] || '', /قريبًا/);
});

test('delivery availability is selected per product and follows the active store plan', () => {
  const addSource = fs.readFileSync(addProductPagePath, 'utf8');
  const editSource = fs.readFileSync(editAdPagePath, 'utf8');
  for (const source of [addSource, editSource]) {
    assert.match(source, /subscription\?\.plan\?\.features\?\.delivery === true/);
    assert.match(source, /isAvailableForDelivery/);
    assert.match(source, /متاح للتوصيل/);
    assert.match(source, /subscription\?\.plan\?\.features\?\.discounts === true/);
    assert.match(source, /خصم على المنتج/);
    assert.match(source, /discountValue/);
    assert.match(source, /option value="percentage">نسبة مئوية/);
    assert.match(source, /option value="fixed">مبلغ ثابت/);
  }
  assert.doesNotMatch(fs.readFileSync(createStorePagePath, 'utf8'), /deliveryAvailable/);
  assert.doesNotMatch(fs.readFileSync(myStorePagePath, 'utf8'), /يتوفر توصيل لمنتجات/);
});

test('store inventory controls are plan-gated and validate whole non-negative quantities', () => {
  const addSource = fs.readFileSync(addProductPagePath, 'utf8');
  const editSource = fs.readFileSync(editAdPagePath, 'utf8');
  const myStoreSource = fs.readFileSync(myStorePagePath, 'utf8');
  for (const source of [addSource, editSource]) {
    assert.match(source, /subscription\?\.plan\?\.features\?\.inventory === true/);
    assert.match(source, /Number\.isSafeInteger\(Number\(stockQuantity\)\)/);
    assert.match(source, /الكمية المتوفرة/);
  }
  assert.match(myStoreSource, /المخزون: \{ad\.stockQuantity\}/);
});

test('store order notification badge and links follow the active notifications feature', () => {
  const myStoreSource = fs.readFileSync(myStorePagePath, 'utf8');
  const notificationBellSource = fs.readFileSync(notificationBellPath, 'utf8');
  const notificationsPageSource = fs.readFileSync(path.join(root, 'src', 'pages', 'Notifications.jsx'), 'utf8');
  const storeOrdersSource = fs.readFileSync(path.join(root, 'src', 'pages', 'StoreOrders.jsx'), 'utf8');
  assert.match(myStoreSource, /hasStorePlanFeature\(subscription\?\.plan \|\| subscription\?\.planId, "notifications"\)/);
  assert.match(myStoreSource, /supportsNotifications && newOrderCount > 0/);
  assert.match(notificationBellSource, /case 'store_order':[\s\S]*?\/my-family-production\/orders[\s\S]*?\/my-store\/orders/);
  assert.match(notificationsPageSource, /n\.type === "store_order"[\s\S]*?\/my-family-production\/orders[\s\S]*?\/my-store\/orders/);
  assert.match(storeOrdersSource, /owner\/notifications\/read/);
  assert.match(storeOrdersSource, /notifications:refresh/);
});

test('nav shows a store link for active store owners', () => {
  const navSource = fs.readFileSync(navPath, 'utf8');
  assert.match(navSource, /\/stores\/me|\/stores\/me\)/);
  assert.match(navSource, /عرض متجري|متجري/);
});

test('rejected store and family-production profiles offer reapplication, not public links', () => {
  const accountSource = fs.readFileSync(path.join(root, 'src', 'pages', 'AccountHub.jsx'), 'utf8');
  const navSource = fs.readFileSync(navPath, 'utf8');
  const subscriptionsSource = fs.readFileSync(sellerSubscriptionsPagePath, 'utf8');
  const myStoreSource = fs.readFileSync(myStorePagePath, 'utf8');

  for (const source of [accountSource, navSource, subscriptionsSource]) {
    assert.match(source, /rejected/);
    assert.match(source, /\/seller\/store\/create/);
    assert.match(source, /\/family-production\/register/);
  }
  assert.match(myStoreSource, /store\.status === "rejected"[\s\S]*?إعادة تقديم الطلب/);
  assert.match(myStoreSource, /effectiveStoreStatus === "active" && subscriptionStatus === "active" && store\.slug/);
});

test('public store links are hidden unless the subscription is active', () => {
  const accountSource = fs.readFileSync(path.join(root, 'src', 'pages', 'AccountHub.jsx'), 'utf8');
  const navSource = fs.readFileSync(navPath, 'utf8');
  const myStoreSource = fs.readFileSync(myStorePagePath, 'utf8');

  for (const source of [accountSource, navSource]) {
    assert.match(source, /status === "active" && .*subscriptionStatus === "active".*slug/);
  }
  assert.match(myStoreSource, /effectiveStoreStatus === "active" && subscriptionStatus === "active" && store\.slug/);
});

test('selected store plan exposes the next button on desktop and mobile', () => {
  const source = fs.readFileSync(createStorePagePath, 'utf8');
  assert.match(source, /step === 1 && selectedPlanId[\s\S]*?fixed inset-x-0 bottom-5[\s\S]*?md:block[\s\S]*?التالي/);
  assert.match(source, /step === 1 \? \([\s\S]*?الباقة المختارة[\s\S]*?التالي/);
});

test('store and family-production dashboards expose a shareable public installation link', () => {
  const source = fs.readFileSync(myStorePagePath, 'utf8');
  assert.match(source, /`\$\{window\.location\.origin\}\/store\/\$\{encodeURIComponent\(store\.slug\)\}`/);
  assert.match(source, /aria-label="رابط المتجر العام"/);
  assert.match(source, /navigator\.clipboard\?\.writeText/);
  assert.match(source, /navigator\.clipboard\.writeText\(publicStoreUrl\)/);
  assert.match(source, /document\.execCommand\("copy"\)/);
  assert.match(source, /تم نسخ الرابط/);
  assert.match(source, /تثبيت المتجر كتطبيق يتطلب متجرًا نشطًا/);
  assert.match(source, /to=\{publicUrl\}[\s\S]*?target="_blank"/);
  assert.match(source, /store\.slug && \([\s\S]*?رابط متجرك للتسويق/);
});

test('store creation only shows the custom city field after selecting Other', () => {
  const source = fs.readFileSync(createStorePagePath, 'utf8');
  const stepTwo = source.split('{step === 2 && (')[1]?.split('{step === 3 && (')[0] || '';

  assert.match(stepTwo, /<option value="other">أخرى<\/option>/);
  assert.match(stepTwo, /\{cityIsOther\s*&&\s*\(/);
  assert.match(stepTwo, /اسم المدينة/);
  assert.doesNotMatch(stepTwo, /اسم المدينة الأخرى|latitude|longitude/i);
  assert.match(stepTwo, /governorateId:\s*e\.target\.value,\s*cityId:\s*""/);
});

test('store creation manages separate phone and WhatsApp lists and keeps coordinates internal', () => {
  const source = fs.readFileSync(createStorePagePath, 'utf8');
  const mapPickerSource = fs.readFileSync(path.join(root, 'src', 'components', 'MapLocationPicker.jsx'), 'utf8');
  const stepTwo = source.split('{step === 2 && (')[1]?.split('{step === 3 && (')[0] || '';

  assert.match(stepTwo, /form\.phones\.map\(/);
  assert.match(stepTwo, /form\.whatsapp\.map\(/);
  assert.match(stepTwo, /\+ إضافة رقم آخر/);
  assert.match(stepTwo, /\+ إضافة رقم واتساب آخر/);
  assert.match(stepTwo, /onClick=\{\(\) => removeContact\("phones", index\)\}/);
  assert.match(stepTwo, /onClick=\{\(\) => removeContact\("whatsapp", index\)\}/);
  assert.match(mapPickerSource, /navigator\.geolocation\.getCurrentPosition/);
  assert.match(mapPickerSource, /setMapCenter\(point\)/);
  assert.match(mapPickerSource, /setMarker\(point\)/);
  assert.match(source, /payload\.append\("lat", String\(coordinates\.lat\)\)/);
  assert.match(source, /payload\.append\("lng", String\(coordinates\.lng\)\)/);
  const submitHandler = source.split('const submit = async () => {')[1]?.split('\n  };')[0] || '';
  assert.match(submitHandler, /const coordinates = parseMapCoordinates\(form\.lat, form\.lng\)/);
  assert.match(source, /payload\.append\("phones", JSON\.stringify\(form\.phones\)\)/);
  assert.match(source, /payload\.append\("whatsapp", JSON\.stringify\(form\.whatsapp\)\)/);
  assert.match(source, /api\.post\("\/stores"/);
});

test('store creation selects Registry activities and filters existing categories without sending a template key', () => {
  const source = fs.readFileSync(createStorePagePath, 'utf8');
  const stepTwo = source.split('{step === 2 && (')[1]?.split('{step === 3 && (')[0] || '';
  assert.match(source, /api\.get\("\/stores\/activities",\s*\{\s*params:\s*\{\s*type:\s*storeType\s*\}\s*\}\)/);
  assert.match(source, /payload\.append\("storeType", storeType\)/);
  assert.match(stepTwo, /نوع المتجر/);
  assert.match(stepTwo, /activities\.map\(\(activity\) => <option key=\{activity\.activityKey\} value=\{activity\.activityKey\}>\{activity\.nameAr\}<\/option>\)/);
  assert.match(source, /getStoreActivityCategoryOptions\(categories, selectedActivity\)/);
  assert.match(fs.readFileSync(myStorePagePath, 'utf8'), /getStoreActivityCategoryOptions\(categoryOptions, selectedActivity, form\.selectedCategories\)/);
  assert.match(source, /payload\.append\("activityKey", form\.activityKey\)/);
  assert.doesNotMatch(source, /payload\.append\("templateKey"/);
  assert.doesNotMatch(stepTwo, /value=\{form\.businessActivity\}/);
});

test('store identity and activity are displayed but cannot be edited after request submission', () => {
  const source = fs.readFileSync(myStorePagePath, 'utf8');
  assert.match(source, /activityKey: nextStore\.activityKey \|\| ""/);
  assert.match(source, /نوع النشاط[\s\S]{0,20}ثابت/);
  assert.match(source, /اسم المتجر.*ثابت/);
  assert.doesNotMatch(source, /name="storeName"|name="activityKey"/);
  assert.match(source, /key === "storeName" \|\| key === "activityKey"/);
  assert.match(source, /selectedCategories: \(nextStore\.selectedCategories \|\| \[\]\)/);
});
 
 test('store management explicitly opens add and edit in store product mode', () => {
   const source = fs.readFileSync(myStorePagePath, 'utf8');
   assert.match(source, /to=\{`\/add-product\?storeProduct=1&storeType=\$\{storeType\}`\}/);
   assert.match(source, /`\/edit-ad\/\$\{ad\._id\}\?storeProduct=1&storeType=\$\{storeType\}`/);
 });
 
 test('store product forms are simplified without changing public ad entry points', () => {
   const addSource = fs.readFileSync(addProductPagePath, 'utf8');
   const editSource = fs.readFileSync(editAdPagePath, 'utf8');
 
   for (const source of [addSource, editSource]) {
     assert.match(source, /searchParams\.get\("storeProduct"\) === "1"/);
     assert.match(source, /label="تصنيف المنتج"/);
     assert.match(source, /حالة المنتج/);
     assert.match(source, /متوفر/);
     assert.match(source, /غير متوفر/);
     assert.match(source, /storeProduct"?,\s*"true"/);
     assert.match(source, /!isStoreProduct/);
   }
  assert.match(addSource, /isStoreProduct \? "إضافة منتج"/);
  assert.match(editSource, /isStoreProduct \? "تعديل منتج"/);
   assert.match(addSource, /CategorySelect[\s\S]*isStoreProduct/);
   assert.match(editSource, /CategorySelect[\s\S]*isStoreProduct/);
 });

test('store availability display never substitutes condition and normal ads have no store availability label', () => {
  assert.equal(getStoreProductAvailabilityLabel({ storeProfileId: 'store-1', isAvailable: true, condition: 'used' }), 'متوفر');
  assert.equal(getStoreProductAvailabilityLabel({ storeProfileId: 'store-1', isAvailable: false, condition: 'used' }), 'غير متوفر');
  assert.equal(getStoreProductAvailabilityLabel({ condition: 'used' }), null);

  const cardSource = fs.readFileSync(path.join(root, 'src', 'components', 'ProductCard.jsx'), 'utf8');
  const detailSource = fs.readFileSync(path.join(root, 'src', 'pages', 'ProductDetail.jsx'), 'utf8');
  assert.match(cardSource, /getStoreProductAvailabilityLabel\(product\)/);
  assert.match(detailSource, /getStoreProductAvailabilityLabel\(p\)/);
  assert.match(cardSource, /to=\{`\/store\/\$\{storeProfile\.slug\}`\}/);
  assert.match(detailSource, /to=\{`\/store\/\$\{storeProfile\.slug\}`\}/);
  assert.match(detailSource, /edit-ad\/\$\{id\}\$\{storeProfile \? `\?storeProduct=1&storeType=/);
  assert.match(detailSource, /storeWhatsAppContacts\.map/);
  assert.match(detailSource, /storePhones\.map/);
  assert.match(detailSource, /storeProfile\.businessActivity/);
  assert.match(detailSource, /storeLocation/);
  assert.match(detailSource, /زيارة المتجر/);
  assert.match(detailSource, /تصفح منتجات المتجر/);
});

test('Store Product attributes are category-driven, shared by create and edit, and empty details stay hidden', () => {
  const addSource = fs.readFileSync(addProductPagePath, 'utf8');
  const editSource = fs.readFileSync(editAdPagePath, 'utf8');
  const fieldSource = fs.readFileSync(path.join(root, 'src', 'components', 'CategoryAttributeFields.jsx'), 'utf8');
  const templateSource = fs.readFileSync(path.join(root, 'src', 'utils', 'storeTemplates.js'), 'utf8');
  const detailSource = fs.readFileSync(path.join(root, 'src', 'pages', 'ProductDetail.jsx'), 'utf8');

  for (const source of [addSource, editSource]) {
    assert.match(source, /<CategoryAttributeFields/);
    assert.match(source, /getCategoryAttributes\(categoryId, \{ includeAncestors: !isStoreProduct \}\)/);
  }
  assert.match(addSource, /isStoreProduct \|\| attributes\.length > 0/);
  assert.match(editSource, /adAttrRef\.current = Array\.isArray\(ad\.attributes\)/);
  assert.match(editSource, /adAttrRef\.current = null/);
  assert.match(editSource, /attributesToSave/);
  for (const type of ['"text"', '"number"', '"select"', '"boolean"', '"multiselect"']) {
    assert.ok(fieldSource.includes(type), `Expected the shared field renderer to support ${type}`);
  }
  assert.doesNotMatch(templateSource, /attributeNamesByPresentation|fuel_type|wardrobe|storage/);
  assert.match(detailSource, /const detailAttributes = \(p\.attributes \|\| \[\]\)\.filter\(hasAttributeValue\)/);
  assert.match(detailSource, /detailAttributes\.length > 0/);
});
