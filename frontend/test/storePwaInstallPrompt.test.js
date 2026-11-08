import test from "node:test";
import assert from "node:assert/strict";
import { getStorePwaInstallContent } from "../src/utils/storePwaInstallPrompt.js";

test("store PWA install content is personalized to a commercial store and activity", () => {
  assert.deepEqual(getStorePwaInstallContent({
    storeName: "بامسق للأثاث",
    storeType: "store",
    activity: { name: "الأثاث المنزلي" }
  }), {
    title: "تثبيت تطبيق بامسق للأثاث",
    subtitle: "تسوّق من بامسق للأثاث بسهولة",
    description: "تصفّح منتجات الأثاث المنزلي، وتواصل مع بامسق للأثاث واطلب بسهولة من هاتفك."
  });
});

test("family-production PWA install content describes discovering its products", () => {
  assert.deepEqual(getStorePwaInstallContent({
    storeName: "أسرة النور",
    storeType: "family-production",
    businessActivity: "المخبوزات"
  }), {
    title: "تثبيت تطبيق أسرة النور",
    subtitle: "منتجات الأسرة المنتجة أقرب إليك",
    description: "اكتشف منتجات المخبوزات لدى أسرة النور، وتابع جديدهم واطلب بسهولة من هاتفك."
  });
});
