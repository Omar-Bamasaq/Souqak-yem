import { WALLET_SERVICE_CURRENCIES } from "./walletServicePricing.js";

export const WALLET_SERVICE_TYPES = Object.freeze([
  "AI_TOOL",
  "GAME_TOPUP",
  "SOFTWARE",
  "ENTERTAINMENT",
  "DIGITAL_CARD",
  "OTHER"
]);

export const WALLET_SERVICE_PRICING_TYPES = Object.freeze(["FIXED", "UNIT", "PACKAGE"]);
export const DYNAMIC_FORM_FIELD_TYPES = Object.freeze([
  "TEXT",
  "NUMBER",
  "EMAIL",
  "URL",
  "SELECT",
  "MULTI_SELECT",
  "TEXTAREA",
  "BOOLEAN"
]);

const MAX_FORM_FIELDS = 50;
const MAX_FIELD_OPTIONS = 100;
const MAX_FIELD_TEXT_LENGTH = 2000;
const FIELD_ID_PATTERN = /^[A-Za-z][A-Za-z0-9_-]{0,49}$/;
const FORM_VALIDATION_FORMATS = Object.freeze({
  YE_MOBILE_73_77: /^7[37]\d{7}$/
});

function assertKnownKeys(value, allowedKeys, description) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${description} غير صالح.`);
  }
  const unknownKey = Object.keys(value).find((key) => !allowedKeys.includes(key));
  if (unknownKey) throw new Error(`الحقل ${unknownKey} غير معروف في ${description}.`);
}

function boundedText(value, label, maximum, allowEmpty = true) {
  if (typeof value !== "string") throw new Error(`${label} غير صالح.`);
  const text = value.trim();
  if ((!allowEmpty && !text) || text.length > maximum) {
    throw new Error(`${label} مطلوب وبحد أقصى ${maximum} حرفًا.`);
  }
  return text;
}

function normalizeCondition(condition, priorFields) {
  if (condition == null) return undefined;
  assertKnownKeys(condition, ["fieldId", "operator", "value"], "شرط الظهور");
  if (typeof condition.fieldId !== "string" || !FIELD_ID_PATTERN.test(condition.fieldId)) {
    throw new Error("معرف الحقل المرجعي في شرط الظهور غير صالح.");
  }
  const referencedField = priorFields.get(condition.fieldId);
  if (!referencedField) throw new Error("يجب أن يشير شرط الظهور إلى حقل سابق في ترتيب النموذج.");

  const operators = ["EQUALS", "NOT_EQUALS", "CONTAINS", "NOT_CONTAINS"];
  if (!operators.includes(condition.operator)) throw new Error("عامل شرط الظهور غير مدعوم.");
  if ((condition.operator === "CONTAINS" || condition.operator === "NOT_CONTAINS")
    && !["TEXT", "TEXTAREA", "MULTI_SELECT"].includes(referencedField.type)) {
    throw new Error("عامل الاحتواء غير صالح لنوع الحقل المرجعي.");
  }

  const value = condition.value;
  if (referencedField.type === "BOOLEAN") {
    if (typeof value !== "boolean") throw new Error("قيمة شرط الظهور غير صالحة.");
  } else if (referencedField.type === "NUMBER") {
    if (typeof value !== "number" || !Number.isFinite(value)) throw new Error("قيمة شرط الظهور غير صالحة.");
  } else if (["SELECT", "MULTI_SELECT"].includes(referencedField.type)) {
    if (typeof value !== "string"
      || !referencedField.options.some((option) => option.value === value && option.isActive)) {
      throw new Error("قيمة شرط الظهور يجب أن تكون من خيارات الحقل المرجعي.");
    }
  } else if (typeof value !== "string" || value.length > MAX_FIELD_TEXT_LENGTH) {
    throw new Error("قيمة شرط الظهور غير صالحة.");
  }

  return { fieldId: condition.fieldId, operator: condition.operator, value };
}

function validateValue(field, value, label = field.label) {
  if (field.type === "BOOLEAN") {
    if (typeof value !== "boolean") throw new Error(`قيمة ${label} يجب أن تكون نعم أو لا.`);
    return value;
  }

  if (field.type === "NUMBER") {
    if (typeof value !== "number" || !Number.isFinite(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER) {
      throw new Error(`قيمة ${label} يجب أن تكون رقمًا صالحًا.`);
    }
    const { min, max } = field.validation || {};
    if ((min !== undefined && value < min) || (max !== undefined && value > max)) {
      throw new Error(`قيمة ${label} خارج الحدود المسموحة.`);
    }
    return value;
  }

  if (field.type === "MULTI_SELECT") {
    if (!Array.isArray(value) || value.length > MAX_FIELD_OPTIONS
      || value.some((entry) => typeof entry !== "string")) {
      throw new Error(`قيمة ${label} يجب أن تكون قائمة خيارات صالحة.`);
    }
    const selected = [...new Set(value)];
    if (selected.length !== value.length
      || selected.some((entry) => !field.options.some((option) => option.value === entry && option.isActive))) {
      throw new Error(`تحتوي ${label} على خيار غير مسموح.`);
    }
    return selected;
  }

  if (typeof value !== "string") throw new Error(`قيمة ${label} يجب أن تكون نصًا.`);
  const text = value.trim();
  const { minLength, maxLength } = field.validation || {};
  if (text.length > (maxLength ?? MAX_FIELD_TEXT_LENGTH)
    || (minLength !== undefined && text.length < minLength)) {
    throw new Error(`طول ${label} خارج الحدود المسموحة.`);
  }
  if (field.validation?.format === "YE_MOBILE_73_77"
    && !FORM_VALIDATION_FORMATS.YE_MOBILE_73_77.test(text)) {
    throw new Error(`يجب أن يبدأ ${label} بـ73 أو 77 وأن يتكون من 9 أرقام.`);
  }
  if (field.type === "EMAIL" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) {
    throw new Error(`البريد الإلكتروني في ${label} غير صالح.`);
  }
  if (field.type === "URL") {
    let url;
    try {
      url = new URL(text);
    } catch {
      throw new Error(`الرابط في ${label} غير صالح.`);
    }
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
      throw new Error(`الرابط في ${label} يجب أن يكون HTTP أو HTTPS دون بيانات دخول.`);
    }
  }
  if (["SELECT"].includes(field.type)
    && !field.options.some((option) => option.value === text && option.isActive)) {
    throw new Error(`قيمة ${label} تتضمن خيارًا غير مسموح.`);
  }
  return text;
}

function normalizeValidation(value, type) {
  if (value === undefined) return undefined;
  const allowed = type === "NUMBER"
    ? ["min", "max"]
    : type === "TEXT"
      ? ["minLength", "maxLength", "format"]
      : ["EMAIL", "URL", "TEXTAREA"].includes(type)
      ? ["minLength", "maxLength"]
      : [];
  assertKnownKeys(value, allowed, "قواعد التحقق");
  const normalized = {};
  for (const key of allowed) {
    if (value[key] === undefined) continue;
    const number = value[key];
    if (key === "format") {
      if (typeof number !== "string" || !Object.hasOwn(FORM_VALIDATION_FORMATS, number)) {
        throw new Error("صيغة التحقق غير مدعومة.");
      }
      normalized[key] = number;
      continue;
    }
    if (typeof number !== "number" || !Number.isFinite(number)
      || (key.endsWith("Length") && !Number.isSafeInteger(number))) {
      throw new Error("قاعدة التحقق غير صالحة.");
    }
    if (key.endsWith("Length") && (number < 0 || number > MAX_FIELD_TEXT_LENGTH)) {
      throw new Error("حد طول النص خارج النطاق المسموح.");
    }
    normalized[key] = number;
  }
  if (normalized.min !== undefined && normalized.max !== undefined && normalized.min > normalized.max) {
    throw new Error("الحد الأدنى أكبر من الحد الأعلى.");
  }
  if (normalized.minLength !== undefined && normalized.maxLength !== undefined
    && normalized.minLength > normalized.maxLength) {
    throw new Error("الحد الأدنى للطول أكبر من الحد الأعلى.");
  }
  return normalized;
}

function normalizeOptions(value, type) {
  if (!["SELECT", "MULTI_SELECT"].includes(type)) {
    if (value !== undefined && value !== null && (!Array.isArray(value) || value.length)) {
      throw new Error("لا تقبل الخيارات إلا مع حقول الاختيار.");
    }
    return [];
  }
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_FIELD_OPTIONS) {
    throw new Error("يجب إدخال قائمة خيارات صالحة.");
  }
  const ids = new Set();
  const values = new Set();
  return value.map((option, index) => {
    assertKnownKeys(option, ["id", "label", "value", "isActive", "sortOrder"], "الخيار");
    const id = boundedText(option.id, "معرف الخيار", 50, false);
    const label = boundedText(option.label, "اسم الخيار", 120, false);
    const optionValue = boundedText(option.value, "قيمة الخيار", 120, false);
    if (!FIELD_ID_PATTERN.test(id) || ids.has(id) || values.has(optionValue)) {
      throw new Error("معرفات وقيم الخيارات يجب أن تكون فريدة وصالحة.");
    }
    ids.add(id);
    values.add(optionValue);
    const isActive = option.isActive === undefined ? true : option.isActive;
    if (typeof isActive !== "boolean") throw new Error("حالة الخيار غير صالحة.");
    const sortOrder = option.sortOrder === undefined ? index : Number(option.sortOrder);
    if (!Number.isSafeInteger(sortOrder)) throw new Error("ترتيب الخيار غير صالح.");
    return { id, label, value: optionValue, isActive, sortOrder };
  }).sort((left, right) => left.sortOrder - right.sortOrder);
}

export function normalizeFormSchema(value) {
  if (!Array.isArray(value) || value.length > MAX_FORM_FIELDS) {
    throw new Error("مخطط النموذج يجب أن يكون قائمة لا تتجاوز 50 حقلًا.");
  }
  const ids = new Set();
  const priorFields = new Map();
  const orderedFields = value.map((rawField, index) => ({
    rawField,
    index,
    sortOrder: rawField?.sortOrder === undefined ? index : Number(rawField.sortOrder)
  })).sort((left, right) => left.sortOrder - right.sortOrder || left.index - right.index);
  const fields = orderedFields.map(({ rawField, index, sortOrder: orderedSort }) => {
    assertKnownKeys(rawField, [
      "id", "name", "label", "type", "required", "placeholder", "helpText",
      "sortOrder", "defaultValue", "validation", "options", "when"
    ], "تعريف الحقل");
    const id = boundedText(rawField.id, "معرف الحقل", 50, false);
    if (!FIELD_ID_PATTERN.test(id) || ids.has(id)) throw new Error("معرفات الحقول يجب أن تكون فريدة وصالحة.");
    ids.add(id);
    if (!DYNAMIC_FORM_FIELD_TYPES.includes(rawField.type)) throw new Error("نوع حقل النموذج غير مدعوم.");
    const type = rawField.type;
    const label = boundedText(rawField.label, "اسم الحقل", 120, false);
    const name = rawField.name === undefined ? id : boundedText(rawField.name, "اسم الحقل", 80, false);
    const required = rawField.required === undefined ? false : rawField.required;
    if (typeof required !== "boolean") throw new Error("إعداد الحقل المطلوب غير صالح.");
    const sortOrder = orderedSort;
    if (!Number.isSafeInteger(sortOrder)) throw new Error("ترتيب الحقل غير صالح.");
    const field = {
      id,
      name,
      label,
      type,
      required,
      sortOrder,
      options: normalizeOptions(rawField.options, type)
    };
    if (required && ["SELECT", "MULTI_SELECT"].includes(type)
      && !field.options.some((option) => option.isActive)) {
      throw new Error(`يجب أن يحتوي الحقل ${label} على خيار متاح.`);
    }
    if (rawField.placeholder !== undefined) field.placeholder = boundedText(rawField.placeholder, "النص الإرشادي", 160);
    if (rawField.helpText !== undefined) field.helpText = boundedText(rawField.helpText, "تعليمات الحقل", 500);
    if (rawField.validation !== undefined) field.validation = normalizeValidation(rawField.validation, type);
    if (rawField.defaultValue !== undefined) field.defaultValue = validateValue(field, rawField.defaultValue);
    if (required && typeof field.defaultValue === "string" && !field.defaultValue) {
      throw new Error(`القيمة الافتراضية للحقل ${label} لا تحقق كونه مطلوبًا.`);
    }
    if (required && Array.isArray(field.defaultValue) && field.defaultValue.length === 0) {
      throw new Error(`القيمة الافتراضية للحقل ${label} لا تحقق كونه مطلوبًا.`);
    }
    if (rawField.when !== undefined) field.when = normalizeCondition(rawField.when, priorFields);
    priorFields.set(id, field);
    return field;
  });
  return fields.sort((left, right) => left.sortOrder - right.sortOrder);
}

function matchesCondition(condition, answers) {
  if (!Object.hasOwn(answers, condition.fieldId)) return false;
  const actual = answers[condition.fieldId];
  if (condition.operator === "EQUALS") return actual === condition.value;
  if (condition.operator === "NOT_EQUALS") return actual !== condition.value;
  const contains = Array.isArray(actual)
    ? actual.includes(condition.value)
    : typeof actual === "string" && actual.includes(condition.value);
  return condition.operator === "CONTAINS" ? contains : !contains;
}

export function validateFormAnswers(schema, input, { allowIncomplete = false } = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("إجابات النموذج غير صالحة.");
  }
  const fields = normalizeFormSchema(schema || []);
  const fieldIds = new Set(fields.map((field) => field.id));
  const unknownKey = Object.keys(input).find((key) => !fieldIds.has(key));
  if (unknownKey) throw new Error(`إجابة الحقل ${unknownKey} غير معروفة.`);

  const answers = {};
  for (const field of fields) {
    const visible = !field.when || matchesCondition(field.when, answers);
    const supplied = Object.hasOwn(input, field.id);
    if (!visible) {
      if (supplied) throw new Error(`لا يجوز إرسال إجابة الحقل المخفي ${field.label}.`);
      continue;
    }
    if (!supplied && field.defaultValue !== undefined) {
      answers[field.id] = field.defaultValue;
      continue;
    }
    if (!supplied) {
      if (field.required && !allowIncomplete) throw new Error(`يرجى إدخال ${field.label}.`);
      continue;
    }
    const value = validateValue(field, input[field.id]);
    if (field.required && typeof value === "string" && !value) {
      throw new Error(`يرجى إدخال ${field.label}.`);
    }
    if (field.required && Array.isArray(value) && value.length === 0) {
      throw new Error(`يرجى اختيار قيمة لـ ${field.label}.`);
    }
    answers[field.id] = value;
  }
  return answers;
}

export function normalizeWalletServicePackages(value, currency) {
  if (!Array.isArray(value) || value.length > MAX_FIELD_OPTIONS) {
    throw new Error("قائمة الباقات غير صالحة.");
  }
  const ids = new Set();
  return value.map((item, index) => {
    assertKnownKeys(item, ["id", "name", "description", "price", "currency", "isActive", "sortOrder"], "الباقة");
    const id = boundedText(item.id, "معرف الباقة", 50, false);
    const name = boundedText(item.name, "اسم الباقة", 120, false);
    const description = boundedText(item.description ?? "", "وصف الباقة", 500);
    const price = Number(item.price);
    const packageCurrency = String(item.currency || currency);
    const isActive = item.isActive === undefined ? true : item.isActive;
    const sortOrder = item.sortOrder === undefined ? index : Number(item.sortOrder);
    if (!FIELD_ID_PATTERN.test(id) || ids.has(id) || !Number.isFinite(price)
      || price < 0 || price > Number.MAX_SAFE_INTEGER
      || Math.abs(price * 100 - Math.round(price * 100)) >= 1e-7
      || !WALLET_SERVICE_CURRENCIES.includes(packageCurrency) || packageCurrency !== currency
      || typeof isActive !== "boolean" || !Number.isSafeInteger(sortOrder)) {
      throw new Error("بيانات الباقة أو عملتها غير صالحة.");
    }
    ids.add(id);
    return { id, name, description, price: Math.round(price * 100) / 100, currency: packageCurrency, isActive, sortOrder };
  }).sort((left, right) => left.sortOrder - right.sortOrder);
}

export function getWalletServiceVersion(service, version) {
  const currentVersion = Number(service.serviceVersion || 1);
  const requestedVersion = version == null ? currentVersion : Number(version);
  if (!Number.isSafeInteger(requestedVersion) || requestedVersion < 1) return null;
  if (requestedVersion === currentVersion) return service;
  const historical = (service.versionHistory || []).find((entry) => Number(entry.version) === requestedVersion);
  return historical?.snapshot || null;
}

export function isWalletServiceVersionValidAt(service, version, timestamp) {
  const requestedVersion = Number(version);
  const currentVersion = Number(service.serviceVersion || 1);
  const createdAt = new Date(timestamp).getTime();
  const serviceCreatedAt = new Date(service.createdAt).getTime();
  if (!Number.isSafeInteger(requestedVersion) || requestedVersion < 1
    || !Number.isFinite(createdAt) || !Number.isFinite(serviceCreatedAt)) {
    return false;
  }

  const history = [...(service.versionHistory || [])]
    .filter((entry) => Number.isSafeInteger(Number(entry.version)) && entry.createdAt)
    .sort((left, right) => Number(left.version) - Number(right.version));
  if (requestedVersion > currentVersion) return false;

  const previousBoundary = history.find((entry) => Number(entry.version) === requestedVersion - 1);
  const nextBoundary = history.find((entry) => Number(entry.version) === requestedVersion);
  const start = requestedVersion === 1
    ? serviceCreatedAt
    : previousBoundary ? new Date(previousBoundary.createdAt).getTime() : Number.NaN;
  const end = requestedVersion === currentVersion
    ? Number.POSITIVE_INFINITY
    : nextBoundary ? new Date(nextBoundary.createdAt).getTime() : Number.NaN;

  return Number.isFinite(start) && !Number.isNaN(end)
    && createdAt >= start && createdAt < end;
}

export function getWalletServiceVersionAt(service, timestamp) {
  const currentVersion = Number(service.serviceVersion || 1);
  for (let version = currentVersion; version >= 1; version -= 1) {
    if (isWalletServiceVersionValidAt(service, version, timestamp)) return version;
  }
  return null;
}
