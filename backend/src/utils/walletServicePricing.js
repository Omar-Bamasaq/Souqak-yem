export const WALLET_SERVICE_CURRENCIES = ["USD", "SAR", "YER_ADEN", "YER_SANAA"];

function isCentAmount(amount) {
  return Math.abs(amount * 100 - Math.round(amount * 100)) < 1e-7;
}

export function normalizeFeeBands(value) {
  if (!Array.isArray(value)) throw new Error("يجب إدخال شرائح الرسوم بصيغة قائمة.");

  const bands = value.map((band) => {
    const currency = String(band?.currency || "");
    const minimumAmount = Number(band?.minimumAmount);
    const maximumAmount = Number(band?.maximumAmount);
    const feeAmount = Number(band?.feeAmount);
    if (!WALLET_SERVICE_CURRENCIES.includes(currency)) throw new Error("عملة شريحة الرسوم غير مدعومة.");
    if (![minimumAmount, maximumAmount, feeAmount].every(Number.isFinite)
      || [minimumAmount, maximumAmount, feeAmount].some((amount) => amount > Number.MAX_SAFE_INTEGER)
      || [minimumAmount, maximumAmount, feeAmount].some((amount) => !isCentAmount(amount))
      || minimumAmount < 0 || maximumAmount < minimumAmount || feeAmount < 0) {
      throw new Error("قيم شريحة الرسوم غير صالحة.");
    }
    return {
      currency,
      minimumAmount: Math.round(minimumAmount * 100) / 100,
      maximumAmount: Math.round(maximumAmount * 100) / 100,
      feeAmount: Math.round(feeAmount * 100) / 100
    };
  }).sort((a, b) => a.currency.localeCompare(b.currency) || a.minimumAmount - b.minimumAmount);

  for (let index = 1; index < bands.length; index += 1) {
    const previous = bands[index - 1];
    const current = bands[index];
    if (previous.currency === current.currency) {
      const expectedMinimum = Math.round((previous.maximumAmount + 0.01) * 100) / 100;
      if (current.minimumAmount < expectedMinimum) {
        throw new Error("شرائح الرسوم للعملة الواحدة لا يجوز أن تتداخل.");
      }
      if (current.minimumAmount > expectedMinimum) {
        throw new Error("يجب أن تكون شرائح الرسوم متصلة دون فجوات؛ اجعل بداية كل شريحة تساوي نهاية السابقة + 0.01.");
      }
    }
  }
  return bands;
}

export function upgradeLegacyFeeBands(value) {
  if (!Array.isArray(value)) throw new Error("إعدادات شرائح الرسوم القديمة غير صالحة.");
  const bands = value.map((band) => ({ ...band }));
  const sorted = [...bands].sort((a, b) =>
    String(a.currency).localeCompare(String(b.currency))
    || Number(a.minimumAmount) - Number(b.minimumAmount)
  );

  for (let index = 0; index < sorted.length - 1; index += 1) {
    const current = sorted[index];
    const next = sorted[index + 1];
    if (current.currency !== next.currency) continue;
    const nextMinimum = Number(next.minimumAmount);
    const currentMaximum = Number(current.maximumAmount);
    if (nextMinimum <= currentMaximum) {
      throw new Error("تحتوي شرائح الرسوم القديمة على تداخل؛ راجعها يدويًا قبل التحديث.");
    }
    current.maximumAmount = Math.round((nextMinimum - 0.01) * 100) / 100;
  }

  return bands;
}

export function calculateWalletServiceTotals(serviceAmount, currency, feeBands) {
  const rawAmount = Number(serviceAmount);
  if (!Number.isFinite(rawAmount) || rawAmount < 0 || rawAmount > Number.MAX_SAFE_INTEGER) {
    throw new Error("سعر الخدمة غير صالح.");
  }
  const amount = Math.round((rawAmount + Number.EPSILON) * 100) / 100;
  const band = feeBands.find((item) =>
    item.currency === currency
    && amount >= item.minimumAmount
    && amount <= item.maximumAmount
  );
  if (!band) throw new Error(`لا توجد شريحة رسوم مضبوطة للمبلغ والعملة (${currency}).`);

  const platformFee = Math.round((band.feeAmount + Number.EPSILON) * 100) / 100;
  const totalAmount = Math.round((amount + platformFee + Number.EPSILON) * 100) / 100;
  return { serviceAmount: amount, platformFee, totalAmount };
}

export function isWalletServiceQuantityAllowed(quantity, service) {
  return Number.isSafeInteger(quantity)
    && quantity > 0
    && (service.minimumQuantityEnabled === false || quantity >= service.minimumQuantity)
    && (service.maximumQuantityEnabled === false || quantity <= service.maximumQuantity);
}
