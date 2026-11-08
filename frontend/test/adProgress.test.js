import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateAdProgress,
  countAdImages,
  getAdProgressMessage
} from "../src/utils/adProgress.js";

const completeSale = {
  mode: "add",
  title: "عنوان مناسب",
  categoryId: "category-1",
  files: [{ type: "image/jpeg" }],
  price: "2500",
  governorateId: "governorate-1",
  cityId: "city-1"
};

test("empty forms start at zero with an instruction to enter the title", () => {
  const blank = calculateAdProgress({ mode: "add" });
  assert.equal(blank.percent, 0);
  assert.equal(getAdProgressMessage(blank), "ابدأ بإدخال عنوان الإعلان");

  const blankProduct = calculateAdProgress({ mode: "add", isStoreProduct: true });
  assert.equal(blankProduct.percent, 0);
  assert.equal(getAdProgressMessage(blankProduct), "ابدأ بإدخال اسم المنتج");
});

test("sale ad requirements follow title, category, image, price, and location completion", () => {
  const titleOnly = calculateAdProgress({ mode: "add", title: "عنوان مناسب" });
  assert.ok(titleOnly.percent > 0 && titleOnly.percent < 100);
  assert.equal(titleOnly.nextLabel, "فئة الإعلان");
  assert.equal(getAdProgressMessage(titleOnly), "الخطوة التالية: أكمل فئة الإعلان");

  const noCategory = calculateAdProgress({ ...completeSale, categoryId: "" });
  assert.ok(noCategory.percent < 100);
  const noImage = calculateAdProgress({ ...completeSale, files: [] });
  assert.equal(noImage.nextLabel, "صورة الإعلان");
  assert.ok(noImage.percent < 100);
  const invalidImage = calculateAdProgress({
    ...completeSale,
    files: [{ type: "application/pdf" }]
  });
  assert.ok(invalidImage.percent < 100);

  assert.equal(calculateAdProgress(completeSale).percent, 100);
  assert.equal(
    getAdProgressMessage(calculateAdProgress(completeSale)),
    "أحسنت! اكتملت البيانات المطلوبة. أضف وصفًا واضحًا يشرح حالة المنتج وتفاصيله. فعّل عرض الهاتف أو واتساب لتسهيل التواصل."
  );
});

test("price must be positive unless a regular ad selects price on contact", () => {
  assert.ok(calculateAdProgress({ ...completeSale, price: "0" }).percent < 100);
  assert.ok(calculateAdProgress({ ...completeSale, price: "invalid" }).percent < 100);
  assert.equal(calculateAdProgress({
    ...completeSale,
    price: "",
    priceOnContact: true
  }).percent, 100);
});

test("purchase requests require title, selected request category, and location but not price or images", () => {
  const request = calculateAdProgress({
    mode: "add",
    adType: "order",
    title: "طلب شراء",
    orderMainCategoryId: "category-1",
    price: "",
    files: [],
    governorateId: "governorate-1",
    cityId: "city-1"
  });
  assert.equal(request.percent, 100);
  assert.ok(calculateAdProgress({
    mode: "add",
    adType: "order",
    title: "طلب شراء",
    orderMainCategoryId: "",
    governorateId: "governorate-1",
    cityId: "city-1"
  }).percent < 100);
  assert.ok(calculateAdProgress({
    mode: "add",
    adType: "order",
    title: "طلب شراء",
    orderMainCategoryId: "category-1",
    governorateId: "",
    cityId: "city-1"
  }).percent < 100);
});

test("store product waits for selected-category requirements and recalculates them from the new category", () => {
  const baseProduct = {
    mode: "add",
    isStoreProduct: true,
    title: "منتج",
    categoryId: "category-1",
    price: "500"
  };
  const waiting = calculateAdProgress({
    ...baseProduct,
    categoryAttributesReady: false
  });
  assert.ok(waiting.percent < 100);
  assert.equal(waiting.missing, "attributesPending");
  assert.equal(getAdProgressMessage(waiting), "جارٍ تحميل مواصفات التصنيف");

  const firstCategory = [
    { _id: "size", label: "المقاس", type: "select", options: ["S", "M"], required: true }
  ];
  const first = calculateAdProgress({
    ...baseProduct,
    categoryAttributes: firstCategory,
    attributeValues: { size: "M" }
  });
  assert.equal(first.percent, 100);

  const secondCategory = [
    { _id: "material", label: "الخامة", type: "text", required: true }
  ];
  const changedCategory = calculateAdProgress({
    ...baseProduct,
    categoryId: "category-2",
    categoryAttributes: secondCategory,
    attributeValues: { size: "M" }
  });
  assert.ok(changedCategory.percent < 100);
  assert.equal(changedCategory.nextLabel, "الخامة");
});

test("required dynamic attributes follow required flags and their actual constraints", () => {
  const categoryAttributes = [
    { _id: "weight", label: "الوزن", type: "number", validation: { min: 1, max: 10 }, required: true },
    { _id: "colors", label: "الألوان", type: "multiselect", options: ["أحمر", "أزرق"], required: true },
    { _id: "code", label: "الرمز", type: "text", validation: { pattern: "^[A-Z]{2}$" }, required: true },
    { _id: "note", label: "ملاحظة", type: "text", required: false }
  ];
  const product = {
    mode: "add",
    isStoreProduct: true,
    title: "منتج",
    categoryId: "category-1",
    price: "500",
    categoryAttributes,
    attributeValues: { weight: "4", colors: ["أزرق"], code: "AB" }
  };
  assert.equal(calculateAdProgress(product).percent, 100);
  assert.ok(calculateAdProgress({
    ...product,
    attributeValues: { ...product.attributeValues, weight: "12" }
  }).percent < 100);
  assert.ok(calculateAdProgress({
    ...product,
    attributeValues: { ...product.attributeValues, colors: ["أخضر"] }
  }).percent < 100);
  assert.ok(calculateAdProgress({
    ...product,
    attributeValues: { ...product.attributeValues, code: "A1" }
  }).percent < 100);
  assert.equal(calculateAdProgress({
    ...product,
    categoryAttributes: categoryAttributes.filter((attribute) => attribute._id === "note")
  }).percent, 100);
});

test("conditional discount and inventory count only when their supported controls are enabled", () => {
  const product = {
    mode: "add",
    isStoreProduct: true,
    title: "منتج",
    categoryId: "category-1",
    price: "100",
    supportsDiscounts: true,
    discountEnabled: true,
    discountType: "fixed",
    discountValue: "120",
    supportsInventory: true,
    inventoryEnabled: true,
    stockQuantity: "2"
  };
  assert.ok(calculateAdProgress(product).percent < 100);
  assert.equal(calculateAdProgress({
    ...product,
    discountEnabled: false,
    inventoryEnabled: false
  }).percent, 100);
  assert.equal(calculateAdProgress({
    ...product,
    discountValue: "20",
    stockQuantity: ""
  }).nextLabel, "كمية المخزون");
});

test("optional phone/WhatsApp, description, condition, and marketplace attributes do not become required steps", () => {
  const progress = calculateAdProgress({
    ...completeSale,
    showPhone: true,
    phone: "",
    showWhatsApp: true,
    whatsapp: "",
    description: "",
    condition: "",
    categoryAttributes: [{ _id: "color", required: true }],
    attributeValues: {}
  });
  assert.equal(progress.percent, 100);
});

test("completion suggestions follow missing optional description, contact, attributes, and images", () => {
  const withOptionalAttributes = {
    ...completeSale,
    categoryAttributes: [
      { _id: "color", label: "اللون", type: "select", options: ["أحمر", "أزرق"] }
    ],
    attributeValues: {}
  };
  const initial = calculateAdProgress(withOptionalAttributes);
  assert.equal(initial.percent, 100);
  assert.deepEqual(initial.suggestions, [
    "أضف وصفًا واضحًا يشرح حالة المنتج وتفاصيله.",
    "فعّل عرض الهاتف أو واتساب لتسهيل التواصل."
  ]);

  const improved = calculateAdProgress({
    ...withOptionalAttributes,
    description: "منتج بحالة ممتازة ومواصفات واضحة.",
    showPhone: true,
    phone: "777123456",
    categoryAttributesReady: true,
    attributeValues: { color: "أحمر" },
    files: [{ type: "image/jpeg" }, { type: "image/png" }, { type: "image/webp" }]
  });
  assert.equal(improved.percent, 100);
  assert.deepEqual(improved.suggestions, []);
  assert.equal(
    getAdProgressMessage(improved),
    "أحسنت! اكتملت البيانات المطلوبة، يمكنك مراجعة الإعلان"
  );
});

test("edit suggestions consider existing and new images without making images mandatory", () => {
  const edit = calculateAdProgress({
    ...completeSale,
    mode: "edit",
    files: [],
    currentImages: ["existing-1.jpg"],
    description: "وصف المنتج",
    showWhatsApp: true,
    whatsapp: "967777123456"
  });
  assert.equal(edit.percent, 100);
  assert.deepEqual(edit.suggestions, [
    "أضف صورًا من زوايا مختلفة لتحسين جاذبية الإعلان."
  ]);

  const noImages = calculateAdProgress({
    ...completeSale,
    mode: "edit",
    files: [],
    currentImages: [],
    description: "وصف المنتج",
    showWhatsApp: true,
    whatsapp: "967777123456"
  });
  assert.equal(noImages.percent, 100);
  assert.match(noImages.suggestions[0], /أضف صورًا واضحة/);
});

test("purchase requests do not receive ad suggestions and store products receive only supported ones", () => {
  const request = calculateAdProgress({
    mode: "add",
    adType: "order",
    title: "طلب شراء",
    orderMainCategoryId: "category-1",
    governorateId: "governorate-1",
    cityId: "city-1"
  });
  assert.equal(request.percent, 100);
  assert.deepEqual(request.suggestions, []);

  const storeProduct = calculateAdProgress({
    mode: "add",
    isStoreProduct: true,
    title: "منتج",
    categoryId: "category-1",
    price: "2500",
    categoryAttributesReady: true,
    categoryAttributes: [{ _id: "color", type: "text", required: false }],
    attributeValues: {}
  });
  assert.equal(storeProduct.percent, 100);
  assert.deepEqual(storeProduct.suggestions, [
    "أضف وصفًا واضحًا يشرح حالة المنتج وتفاصيله.",
    "أكمل الخصائص الاختيارية لتوضيح مواصفات المنتج."
  ]);
  assert.ok(storeProduct.suggestions.every((suggestion) => !suggestion.includes("الهاتف")));
});

test("edit ad does not require images and counts existing plus valid new images separately", () => {
  assert.equal(countAdImages(["old-1.jpg", "old-2.jpg"], [{ type: "image/png" }]), 3);
  assert.equal(countAdImages([], [{ type: "image/webp" }]), 1);
  assert.equal(countAdImages([], [{ type: "image/heic" }]), 1);
  assert.equal(countAdImages([], [{ type: "application/pdf" }]), 0);
  const edit = calculateAdProgress({
    ...completeSale,
    mode: "edit",
    files: [],
    currentImages: []
  });
  assert.equal(edit.percent, 100);

  const editWithImages = calculateAdProgress({
    ...completeSale,
    mode: "edit",
    currentImages: ["old.jpg"],
    files: [{ type: "image/jpeg" }]
  });
  assert.equal(editWithImages.imageCount, 2);
  assert.equal(editWithImages.percent, 100);
});

test("every incomplete applicable requirement keeps the percentage below 100", () => {
  for (const key of ["title", "categoryId", "price", "governorateId", "cityId"]) {
    assert.ok(calculateAdProgress({ ...completeSale, [key]: "" }).percent < 100);
  }
  assert.ok(calculateAdProgress({ ...completeSale, files: [] }).percent < 100);
});
