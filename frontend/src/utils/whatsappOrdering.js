export function normalizeWhatsAppNumber(rawValue) {
  if (rawValue === null || rawValue === undefined || rawValue === "") return null;
  const digits = String(rawValue).replace(/\D/g, "");
  if (!digits) return null;
  const compact = digits.startsWith("00") ? digits.slice(2) : digits;
  return compact && compact.length >= 8 ? compact : null;
}

export function getStoreWhatsAppContacts(storeProfile) {
  if (!storeProfile) return [];
  const contacts = Array.isArray(storeProfile.whatsapp) ? storeProfile.whatsapp : [];
  return contacts
    .map((contact) => {
      const rawNumber = typeof contact === "string" ? contact : contact?.value;
      const normalized = normalizeWhatsAppNumber(rawNumber);
      if (!normalized) return null;
      return {
        ...((typeof contact === "object" && contact) || {}),
        value: rawNumber,
        normalized
      };
    })
    .filter(Boolean);
}

export function buildSingleProductWhatsAppMessage({ storeName, productName, quantity = 1, price, currency, productUrl }) {
  const lines = [
    "السلام عليكم، أريد طلب:",
    `المتجر: ${storeName || "المتجر"}`,
    `المنتج: ${productName || "المنتج"}`,
    `الكمية: ${quantity}`,
    `السعر: ${Number(price || 0).toLocaleString("ar-EG")} ${currency || "ر.ي"}`,
    productUrl ? `رابط المنتج: ${productUrl}` : ""
  ].filter(Boolean);
  return lines.join("\n");
}

export function buildCartWhatsAppMessage({ storeName, items = [], total, currency, storeUrl }) {
  const lines = [
    "السلام عليكم، أريد طلب المنتجات التالية:",
    `المتجر: ${storeName || "المتجر"}`
  ];

  items.forEach((item, index) => {
    const quantity = Number(item.quantity || 0);
    const unitPrice = Number(item.unitPrice ?? item.price ?? 0);
    const itemTitle = item.title || `منتج ${index + 1}`;
    lines.push(`${index + 1}. ${itemTitle} × ${quantity} — ${unitPrice.toLocaleString("ar-EG")} ${currency || "ر.ي"}`);
  });

  lines.push(`\nالإجمالي: ${Number(total || 0).toLocaleString("ar-EG")} ${currency || "ر.ي"}`);
  if (storeUrl) lines.push(`\nرابط المتجر: ${storeUrl}`);

  return lines.join("\n");
}

export function buildWhatsAppLink(phone, text) {
  const normalized = normalizeWhatsAppNumber(phone);
  if (!normalized) return "";
  return `https://wa.me/${normalized}?text=${encodeURIComponent(text || "")}`;
}
