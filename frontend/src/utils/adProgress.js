const validImageTypes = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);

function isValidAttributeValue(attribute, value) {
  if (value === undefined || value === null) return false;

  if (attribute.type === "boolean") {
    return value === true || value === false || value === "true" || value === "false";
  }

  if (attribute.type === "number") {
    const number = Number(value);
    return String(value).trim() !== ""
      && Number.isFinite(number)
      && (attribute.validation?.min == null || number >= attribute.validation.min)
      && (attribute.validation?.max == null || number <= attribute.validation.max);
  }

  if (attribute.type === "multiselect") {
    const values = Array.isArray(value)
      ? value
      : String(value).split(",").map((entry) => entry.trim()).filter(Boolean);
    return values.length > 0 && values.every((entry) => attribute.options?.includes(entry));
  }

  const text = String(value).trim();
  if (!text) return false;
  if (attribute.type === "select") return attribute.options?.includes(text) === true;
  if (attribute.type === "text" && attribute.validation?.pattern) {
    try {
      return new RegExp(attribute.validation.pattern).test(text);
    } catch {
      return false;
    }
  }
  return true;
}

export function countAdImages(existingImages = [], newFiles = []) {
  const validNewFiles = newFiles.filter((file) =>
    validImageTypes.has(file.type) || /heic|heif/i.test(file.type || "")
  );
  return existingImages.length + validNewFiles.length;
}

function addRequirement(requirements, key, label, complete) {
  requirements.push({ key, label, complete: Boolean(complete) });
}

export function calculateAdProgress({
  mode,
  isStoreProduct = false,
  adType = "sell",
  title = "",
  categoryId = "",
  orderMainCategoryId = "",
  governorateId = "",
  cityId = "",
  price = "",
  priceOnContact = false,
  files = [],
  currentImages = [],
  description = "",
  showPhone = false,
  phone = "",
  showWhatsApp = false,
  whatsapp = "",
  categoryAttributes = [],
  categoryAttributesReady = true,
  attributeValues = {},
  supportsDiscounts = false,
  discountEnabled = false,
  discountType = "percentage",
  discountValue = "",
  supportsInventory = false,
  inventoryEnabled = false,
  stockQuantity = ""
}) {
  const requirements = [];
  const isPurchaseRequest = adType === "order" && !isStoreProduct;
  const requiresPrice = !isPurchaseRequest;

  if (isStoreProduct && supportsDiscounts && discountEnabled) {
    const discount = Number(discountValue);
    const validDiscount = discountType === "percentage"
      ? Number.isInteger(discount) && discount >= 1 && discount <= 99
      : Number.isFinite(discount) && discount > 0 && discount <= Number(price);
    addRequirement(requirements, "discount", "قيمة الخصم", validDiscount);
  }

  if (isStoreProduct && supportsInventory && inventoryEnabled) {
    const quantity = Number(stockQuantity);
    addRequirement(
      requirements,
      "inventory",
      "كمية المخزون",
      String(stockQuantity).trim() !== "" && Number.isSafeInteger(quantity) && quantity >= 0
    );
  }

  addRequirement(
    requirements,
    "title",
    isStoreProduct ? "اسم المنتج" : isPurchaseRequest ? "عنوان طلب الشراء" : "عنوان الإعلان",
    Boolean(title.trim())
  );

  const categoryComplete = isPurchaseRequest ? Boolean(orderMainCategoryId) : Boolean(categoryId);
  addRequirement(
    requirements,
    "category",
    isPurchaseRequest ? "الفئة التي تطلب فيها" : isStoreProduct ? "تصنيف المنتج" : "فئة الإعلان",
    categoryComplete
  );

  if (mode === "add" && !isStoreProduct && !isPurchaseRequest) {
    addRequirement(
      requirements,
      "images",
      "صورة الإعلان",
      countAdImages([], files) > 0
    );
  }

  if (requiresPrice) {
    addRequirement(
      requirements,
      "price",
      priceOnContact && !isStoreProduct ? "طريقة تحديد السعر" : "السعر",
      priceOnContact && !isStoreProduct
        ? true
        : String(price).trim() !== "" && Number.isFinite(Number(price)) && Number(price) > 0
    );
  }

  if (!isStoreProduct) {
    addRequirement(requirements, "governorate", "المحافظة", Boolean(governorateId));
    addRequirement(requirements, "city", "المدينة", Boolean(cityId));
  }

  if (isStoreProduct && categoryId && !categoryAttributesReady) {
    addRequirement(requirements, "attributesPending", "تحميل مواصفات تصنيف المنتج", false);
  } else if (isStoreProduct && categoryAttributesReady) {
    for (const attribute of categoryAttributes.filter((item) => item.required)) {
      const id = String(attribute.id || attribute._id);
      addRequirement(
        requirements,
        `attribute:${id}`,
        attribute.label || "مواصفة المنتج",
        isValidAttributeValue(attribute, attributeValues[id])
      );
    }
  }

  const completed = requirements.filter((requirement) => requirement.complete).length;
  const missingRequirement = requirements.find((requirement) => !requirement.complete) || null;
  const imageCount = countAdImages(currentImages, files);
  const suggestions = [];

  if (requirements.length && completed === requirements.length && !isPurchaseRequest) {
    if (!description.trim()) {
      suggestions.push("أضف وصفًا واضحًا يشرح حالة المنتج وتفاصيله.");
    }

    if (!isStoreProduct) {
      const hasVisibleContact = (showPhone && phone.trim()) || (showWhatsApp && whatsapp.trim());
      if (!hasVisibleContact) {
        suggestions.push(
          !showPhone && !showWhatsApp
            ? "فعّل عرض الهاتف أو واتساب لتسهيل التواصل."
            : "أدخل رقم التواصل الذي اخترت عرضه."
        );
      }
    }

    if (categoryAttributesReady && categoryAttributes.some((attribute) =>
      !attribute.required
      && !isValidAttributeValue(attribute, attributeValues[String(attribute.id || attribute._id)])
    )) {
      suggestions.push("أكمل الخصائص الاختيارية لتوضيح مواصفات المنتج.");
    }

    if (imageCount < 3) {
      suggestions.push(
        imageCount > 0
          ? "أضف صورًا من زوايا مختلفة لتحسين جاذبية الإعلان."
          : "أضف صورًا واضحة لتوضيح المنتج."
      );
    }
  }

  return {
    percent: requirements.length ? Math.floor((completed / requirements.length) * 100) : 0,
    completed,
    total: requirements.length,
    missing: missingRequirement?.key || null,
    nextLabel: missingRequirement?.label || null,
    isStoreProduct,
    isPurchaseRequest,
    imageCount,
    suggestions: suggestions.slice(0, 2)
  };
}

export function getAdProgressMessage(progress) {
  if (progress.percent === 100) {
    const suggestions = progress.suggestions || [];
    if (suggestions.length) {
      return `أحسنت! اكتملت البيانات المطلوبة. ${suggestions.join(" ")}`;
    }
    return "أحسنت! اكتملت البيانات المطلوبة، يمكنك مراجعة الإعلان";
  }
  if (progress.percent === 0) {
    if (progress.isStoreProduct) return "ابدأ بإدخال اسم المنتج";
    if (progress.isPurchaseRequest) return "ابدأ بإدخال عنوان طلب الشراء";
    return "ابدأ بإدخال عنوان الإعلان";
  }
  if (progress.missing === "attributesPending") return "جارٍ تحميل مواصفات التصنيف";
  return progress.nextLabel ? `الخطوة التالية: أكمل ${progress.nextLabel}` : "أكمل البيانات المطلوبة للمتابعة";
}
