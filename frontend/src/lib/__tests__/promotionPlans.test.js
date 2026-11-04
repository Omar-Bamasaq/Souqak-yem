import test from "node:test";
import assert from "node:assert/strict";
import {
  getPromotionPlanCardData,
  groupPromotionPlans
} from "../promotionPlans.js";

const activePlan = (id, adServiceType, extra = {}) => ({
  _id: id,
  type: "featured",
  adServiceType,
  isActive: true,
  name: `باقة ${id}`,
  price: 2000,
  currency: "YER_ADEN",
  durationInDays: 1,
  ...extra
});

test("promotion sections group nine active plans into three service types", () => {
  const plans = [
    ...Array.from({ length: 3 }, (_, index) => activePlan(`featured-${index}`, "featured")),
    ...Array.from({ length: 3 }, (_, index) => activePlan(`interstitial-${index}`, "interstitial")),
    ...Array.from({ length: 3 }, (_, index) => activePlan(`placement-${index}`, "placement"))
  ];
  const groups = groupPromotionPlans(plans);

  assert.deepEqual(groups.map(({ key, plans: grouped }) => [key, grouped.length]), [
    ["featured", 3],
    ["interstitial", 3],
    ["placement", 3]
  ]);
  assert.equal(new Set(groups.map(({ theme }) => theme.section)).size, 3);
  assert.equal(groups.flatMap(({ plans: grouped }) => grouped).length, 9);
});

test("promotion sections support fewer and more than three active plans and exclude inactive plans", () => {
  const groups = groupPromotionPlans([
    activePlan("featured-a", "featured"),
    activePlan("featured-b", "featured"),
    activePlan("placement-a", "placement"),
    activePlan("interstitial-a", "interstitial"),
    activePlan("placement-off", "placement", { isActive: false }),
    { ...activePlan("wrong-type", "featured"), type: "store" }
  ]);

  assert.deepEqual(groups.map(({ plans }) => plans.length), [2, 1, 1]);
  const expanded = groupPromotionPlans([
    ...Array.from({ length: 5 }, (_, index) => activePlan(`featured-${index}`, "featured"))
  ]);
  assert.equal(expanded[0].plans.length, 5);
  assert.equal(expanded[1].plans.length, 0);
});

test("promotion card uses server price, duration, description, discount, and configured features", () => {
  const data = getPromotionPlanCardData(activePlan("one-day", "featured", {
    description: "تمييز الإعلان لمدة يوم",
    price: 2000,
    isSaleRunning: true,
    originalPrice: 2000,
    finalPrice: 1500,
    durationInDays: 1,
    features: ["ميزة مضافة من لوحة الإدارة"]
  }));

  assert.deepEqual(data, {
    name: "باقة one-day",
    description: "تمييز الإعلان لمدة يوم",
    price: 1500,
    originalPrice: 2000,
    durationInDays: 1,
    currency: "ريال يمني (عدن)",
    features: ["شارة «مميز» وإبراز بصري للإعلان", "ميزة مضافة من لوحة الإدارة"]
  });
});

test("placement and interstitial cards describe only configured delivery options", () => {
  const placement = getPromotionPlanCardData(activePlan("placement", "placement", {
    adPositions: ["home", "between_ads", "unknown"],
    socialPromotionIncluded: true
  }));
  const interstitial = getPromotionPlanCardData(activePlan("interstitial", "interstitial", {
    interstitialDelaySeconds: 12,
    frequencyCapHours: 48
  }));

  assert.deepEqual(placement.features, [
    "ظهور ممول في: الصفحة الرئيسية، بين بطاقات الإعلانات",
    "النقر يفتح صفحة الإعلان الأصلية",
    "طلب ترويج يدوي عبر حسابات سوقك الرسمية مشمول"
  ]);
  assert.deepEqual(interstitial.features, [
    "يبدأ العرض بعد انتظار 12 ثوانٍ",
    "حد إعادة العرض: مرة كل 48 ساعة"
  ]);
});
