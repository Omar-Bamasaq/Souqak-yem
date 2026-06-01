export const normalizeArabic = (str) => {
  if (!str) return "";
  return str
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/ال/g, "") // Aggressively remove ALL occurrences of "AL"
    .replace(/\s+/g, "") // Remove all spaces
    .trim();
};

export const isConditionEnabled = (catName) => {
  if (!catName) return false;
  const normalizedInput = normalizeArabic(catName);
  
  const whitelist = [
    "السيارات",
    "المركبات",
    "مركبات",
    "شاحنات",
    "دراجات نارية",
    "الالكترونيات",
    "إلكترونيات",
    "أثاث",
    "اثاث",
    "طلبات الشراء",
    "ملابس وأزياء",
    "ملابس وازياء",
    "ألعاب وترفية",
    "ألعاب وترفيه",
    "أدوات ومعدات",
    "الادوات والمعدات",
    "ادوات ومعدات",
    "مركبات خاصة",
    "المركبات الخاصة",
    "أدوات مكتبية",
    "الادوات المكتبية",
    "ادوات مكتبية",
    "مستلزمات رياضية",
    "المستلزمات الرياضية",
    "الصحة والجمال",
    "الكتب والمجلات",
    "آلات موسيقية",
    "أجهزة منزلية",
    "اجهزة منزلية",
    "الأجهزة المنزلية",
    "اجهزه منزليه",
    "الأجهزة المنزلية",
    "أخرى",
    "اخرى"
  ].map(normalizeArabic);

  // Hardcoded check for extra safety
  const problematicOnes = [
    "اجهزهمنزليه",
    "الاجزهالمنزليه",
    "اجهزةمنزلية",
    "مستلزماترياضيه",
    "ادواتمكتبيه",
    "مركباتخاصه",
    "ادواتومعدات",
    "اخري",
    "اخرى"
  ].map(normalizeArabic);

  return whitelist.includes(normalizedInput) || problematicOnes.includes(normalizedInput);
};
