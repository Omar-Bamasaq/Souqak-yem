export function normalizeStoreSlug(input) {
  const raw = String(input || "").trim().toLowerCase();
  const normalized = raw
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9\u0600-\u06FF\-]+/g, "")
    .replace(/\-+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || "store";
}

const RESERVED_STORE_SLUGS = new Set([
  "admin", "api", "assets", "family-production", "login", "my-family-production",
  "my-store", "register", "seller", "store", "stores", "uploads"
]);

export function validateStoreSlug(input) {
  const slug = String(input || "").trim().toLowerCase();
  if (slug.length < 3 || slug.length > 60 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return { valid: false, message: "يجب أن يتكون النطاق من 3 إلى 60 حرفًا إنجليزيًا صغيرًا أو رقمًا، وتُستخدم الشرطة بين الكلمات فقط." };
  }
  if (RESERVED_STORE_SLUGS.has(slug)) {
    return { valid: false, message: "هذا النطاق محجوز. اختر نطاقًا آخر." };
  }
  return { valid: true, slug };
}

export function validateCoordinates(latitude, longitude) {
  const hasLatitude = latitude !== undefined && latitude !== null && String(latitude).trim() !== "";
  const hasLongitude = longitude !== undefined && longitude !== null && String(longitude).trim() !== "";
  if (!hasLatitude && !hasLongitude) return { valid: true, lat: null, lng: null };
  if (!hasLatitude || !hasLongitude) {
    return { valid: false, message: "يجب إدخال خط العرض والطول معًا." };
  }

  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    return { valid: false, message: "Latitude must be between -90 and 90" };
  }
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
    return { valid: false, message: "Longitude must be between -180 and 180" };
  }
  return { valid: true, lat, lng };
}

export function sanitizeStoreText(value, { maxLength = 2000, allowEmpty = true } = {}) {
  if (value === null || value === undefined) {
    return allowEmpty ? "" : "";
  }

  const text = String(value)
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/javascript\s*:/gi, "")
    .replace(/on\w+\s*=/gi, "")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .trim();

  const safeText = text.length > Number(maxLength || 0) ? text.slice(0, Number(maxLength || text.length)).trim() : text;
  return safeText;
}

export function validateStoreEmail(value, { required = false } = {}) {
  const rawEmail = value === null || value === undefined ? "" : String(value).trim();
  if (rawEmail.length > 200) {
    return { valid: false, message: "البريد الإلكتروني طويل جدًا." };
  }
  const email = sanitizeStoreText(rawEmail, { maxLength: 200, allowEmpty: !required }).toLowerCase();
  if (required && !email) {
    return { valid: false, message: "بريد إشعارات الطلبات مطلوب." };
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { valid: false, message: "صيغة البريد الإلكتروني غير صحيحة." };
  }
  return { valid: true, email };
}

export function validateSelectedCategories(categoryIds, maxCategories) {
  if (!Array.isArray(categoryIds)) {
    return { valid: false, message: "selectedCategories must be an array" };
  }

  if (categoryIds.length === 0) {
    return { valid: false, message: "selectedCategories must contain at least one category" };
  }

  const seen = new Set();
  for (const id of categoryIds) {
    const value = String(id || "").trim();
    if (!value) {
      return { valid: false, message: "selectedCategories contains an empty value" };
    }
    if (seen.has(value)) {
      return { valid: false, message: "Duplicate categories are not allowed" };
    }
    seen.add(value);
  }

  const categoryLimit = Number(maxCategories || 0);
  if (categoryLimit > 0 && categoryIds.length > categoryLimit) {
    return { valid: false, message: `Maximum allowed categories for this plan is ${maxCategories}` };
  }

  return { valid: true };
}

export function validateStoreCustomization({ storeName, businessActivity, description, location, phone, email }) {
  const safeName = sanitizeStoreText(storeName, { maxLength: 80, allowEmpty: false });
  if (!safeName || safeName.length < 2 || safeName.length > 80) {
    return { valid: false, message: "storeName is required and must be between 2 and 80 characters" };
  }

  const safeBusiness = sanitizeStoreText(businessActivity, { maxLength: 200, allowEmpty: false });
  if (!safeBusiness || safeBusiness.length < 2 || safeBusiness.length > 200) {
    return { valid: false, message: "businessActivity is required" };
  }

  const safeDescription = sanitizeStoreText(description || "", { maxLength: 1000, allowEmpty: true });
  if (safeDescription.length > 1000) {
    return { valid: false, message: "description is too long" };
  }

  const safeLocation = sanitizeStoreText(location || "", { maxLength: 200, allowEmpty: true });
  if (safeLocation.length > 200) {
    return { valid: false, message: "location is too long" };
  }

  const safePhone = sanitizeStoreText(phone || "", { maxLength: 30, allowEmpty: true });
  if (safePhone && !/^\+?[0-9\s\-()]+$/.test(safePhone)) {
    return { valid: false, message: "phone contains invalid characters" };
  }

  const emailResult = validateStoreEmail(email);
  if (!emailResult.valid) return { valid: false, message: "email is invalid" };

  return { valid: true };
}

export function validateStoreSubmission({ storeName, businessActivity, selectedCategories, plan }) {
  const trimmedName = String(storeName || "").trim();
  const trimmedBusiness = String(businessActivity || "").trim();

  if (!trimmedName || trimmedName.length < 2 || trimmedName.length > 80) {
    return { valid: false, message: "storeName is required and must be between 2 and 80 characters" };
  }

  if (!trimmedBusiness || trimmedBusiness.length < 2 || trimmedBusiness.length > 200) {
    return { valid: false, message: "businessActivity is required" };
  }

  const planLimit = Number(plan?.maxCategories ?? plan?.limits?.maxCategories ?? 0);
  const categoryResult = validateSelectedCategories(selectedCategories, planLimit);
  if (!categoryResult.valid) {
    return { valid: false, message: categoryResult.message };
  }

  return { valid: true };
}

export function validateStoreLocation({ governorateId, cityId, customCityName, cityMap = {} }) {
  const trimmedGov = String(governorateId || "").trim();
  const trimmedCity = String(cityId || "").trim();
  const customName = String(customCityName || "").trim();

  if (trimmedCity) {
    const city = cityMap?.[trimmedCity] || null;
    if (!city) return { valid: false, message: "مدينة غير صالحة أو لا تتبع المحافظة المختارة" };
    if (trimmedGov && String(city.governorateId) !== String(trimmedGov)) {
      return { valid: false, message: "المدينة لا تتبع المحافظة المختارة" };
    }
    return { valid: true, normalizedCityName: city.name || "" };
  }

  if (customName) {
    return { valid: true, normalizedCityName: customName };
  }

  return { valid: true, normalizedCityName: "" };
}

export function getStorePlanSnapshot(plan) {
  if (!plan) return { price: 0, currency: "YER_ADEN", duration: 0 };
  return {
    price: Number(plan.price || 0),
    currency: plan.currency || "YER_ADEN",
    duration: Number(plan.durationInDays || 0)
  };
}
