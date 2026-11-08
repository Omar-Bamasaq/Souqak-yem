export function getStorePwaInstallContent(store) {
  const storeName = String(store?.storeName || "").trim() || "المتجر";
  const activity = String(store?.activity?.name || store?.businessActivity || "").trim();

  if (store?.storeType === "family-production") {
    return {
      title: `تثبيت تطبيق ${storeName}`,
      subtitle: "منتجات الأسرة المنتجة أقرب إليك",
      description: `اكتشف منتجات ${activity ? `${activity} لدى ` : ""}${storeName}، وتابع جديدهم واطلب بسهولة من هاتفك.`
    };
  }

  return {
    title: `تثبيت تطبيق ${storeName}`,
    subtitle: `تسوّق من ${storeName} بسهولة`,
    description: `تصفّح ${activity ? `منتجات ${activity}` : "منتجات المتجر"}، وتواصل مع ${storeName} واطلب بسهولة من هاتفك.`
  };
}
