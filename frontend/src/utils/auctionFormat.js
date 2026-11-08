const CURRENCY_LABELS = {
  YER_ADEN: "ريال يمني - عدن",
  YER_SANAA: "ريال يمني - صنعاء",
  SAR: "ريال سعودي",
  USD: "دولار أمريكي"
};

const STATUS_LABELS = {
  draft: "مسودة",
  pending: "بانتظار المراجعة",
  scheduled: "مجدول",
  live: "مباشر",
  ended: "منتهٍ",
  cancelled: "ملغى",
  rejected: "مرفوض",
  approved: "مقبول",
  disputed: "بلاغ/نزاع"
};

const DELIVERY_METHOD_LABELS = {
  delivery: "توصيل",
  pickup: "استلام",
  both: "توصيل أو استلام"
};

const SALE_STATUS_LABELS = {
  not_applicable: "لا توجد صفقة لإتمامها",
  awaiting_confirmation: "بانتظار تأكيد الطرفين",
  completed: "تم تأكيد إتمام الصفقة",
  disputed: "تم تسجيل بلاغ لمتابعة الصفقة"
};

function auctionAmountParts(value) {
  const text = String(value ?? "");
  const match = text.match(/^(0|[1-9]\d*)(?:\.(\d+))?$/);
  if (!match) throw new TypeError("مبلغ المزاد غير صالح.");

  let fraction = match[2] || "";
  let coefficient = BigInt(`${match[1]}${fraction}`);
  while (fraction && coefficient % 10n === 0n) {
    coefficient /= 10n;
    fraction = fraction.slice(0, -1);
  }
  return { coefficient, scale: fraction.length };
}

function auctionAmountString(coefficient, scale) {
  const digits = coefficient.toString().padStart(scale + 1, "0");
  if (scale === 0) return digits;
  const point = digits.length - scale;
  return `${digits.slice(0, point)}.${digits.slice(point)}`;
}

export function compareAuctionAmounts(left, right) {
  const a = auctionAmountParts(left);
  const b = auctionAmountParts(right);
  const scale = Math.max(a.scale, b.scale);
  const leftValue = a.coefficient * 10n ** BigInt(scale - a.scale);
  const rightValue = b.coefficient * 10n ** BigInt(scale - b.scale);
  return leftValue === rightValue ? 0 : leftValue > rightValue ? 1 : -1;
}

export function stepAuctionBidAmount(amount, increment, minimum, direction) {
  const current = auctionAmountParts(amount);
  const step = auctionAmountParts(increment);
  const floor = auctionAmountParts(minimum);
  const scale = Math.max(current.scale, step.scale, floor.scale);
  const currentValue = current.coefficient * 10n ** BigInt(scale - current.scale);
  const stepValue = step.coefficient * 10n ** BigInt(scale - step.scale);
  const floorValue = floor.coefficient * 10n ** BigInt(scale - floor.scale);
  const nextValue = direction > 0
    ? currentValue + stepValue
    : currentValue - stepValue;

  return auctionAmountString(nextValue < floorValue ? floorValue : nextValue, scale);
}

export function formatAuctionMoney(amount, currency) {
  const [whole, fraction] = String(amount ?? "0").split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, "٬");
  const digits = `${grouped}${fraction ? `٫${fraction}` : ""}`;
  const arabicDigits = digits.replace(/[0-9]/g, (digit) => "٠١٢٣٤٥٦٧٨٩"[digit]);
  return `${arabicDigits} ${CURRENCY_LABELS[currency] || currency || ""}`;
}

export function auctionStatusLabel(status) {
  return STATUS_LABELS[status] || status || "غير محدد";
}

export function auctionDeliveryMethodLabel(method) {
  return DELIVERY_METHOD_LABELS[method] || "—";
}

export function auctionSaleStatusLabel(status) {
  return SALE_STATUS_LABELS[status] || "—";
}

export function formatAuctionDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "—";
  return new Intl.DateTimeFormat("ar-YE", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

export function getAuctionError(error) {
  if (["ECONNABORTED", "ETIMEDOUT"].includes(error?.code)) {
    return "استغرق رفع صور المزاد وتجهيزها وقتًا أطول من المتوقع. تحقق من مسوداتك قبل إعادة المحاولة لتجنب إنشاء مسودة مكررة.";
  }
  return error?.response?.data?.error || error?.message || "تعذر إكمال الطلب.";
}

export function unpackList(data) {
  if (Array.isArray(data)) return data;
  return data?.items || data?.categories || data?.data || [];
}
