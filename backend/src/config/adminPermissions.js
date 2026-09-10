export const ADMIN_PERMISSIONS = [
  { key: "dashboard", label: "الرئيسية" },
  { key: "support_inbox", label: "مراسلات الدعم" },
  { key: "ads", label: "الإعلانات" },
  { key: "sold_ads", label: "الإعلانات المباعة" },
  { key: "archived_ads", label: "الأرشيف" },
  { key: "deleted_ads", label: "الإعلانات المحذوفة" },
  { key: "categories", label: "الفئات" },
  { key: "tags", label: "التاجات" },
  { key: "governorates", label: "المحافظات" },
  { key: "cities", label: "المدن" },
  { key: "reports", label: "البلاغات" },
  { key: "finance_hub", label: "مركز الحسابات المالية" },
  { key: "escrow", label: "الوساطة والمالية" },
  { key: "commissions", label: "المبيعات والعمولات" },
  { key: "withdrawals", label: "المحفظة والسحوبات" },
  { key: "plans", label: "الباقات والحسابات" },
  { key: "managed_seller_ad", label: "تنفيذ إضافة إعلان" },
  { key: "managed_sellers", label: "معلومات البائعين والإعلانات" },
  { key: "users", label: "المستخدمون" },
  { key: "phone_users", label: "مستخدمو الرقم" },
  { key: "password_reset_requests", label: "طلبات استعادة كلمة المرور" },
  { key: "deleted_users", label: "الحسابات المحذوفة" },
  { key: "analytics", label: "إحصائيات المنصة" },
  { key: "platform_reviews", label: "تقييمات المنصة" },
  { key: "brokerage", label: "إدارة التسويق" },
  { key: "referrals", label: "سفراء سوقك" },
  { key: "activity_logs", label: "سجل النشاطات" },
  { key: "recycle_bin", label: "سلة المهملات" },
  { key: "system_health", label: "مراقبة النظام" },
  { key: "welcome_promotion", label: "التمييز الترحيبي" },
  { key: "messaging", label: "المراسلة العامة" },
  { key: "settings", label: "الإعدادات" }
];

const API_PERMISSION_RULES = [
  ["/api/admin/users", "users"],
  ["/api/admin/managed-sellers", "managed_sellers"],
  ["/api/admin/phone-users", "phone_users"],
  ["/api/admin/password-reset-requests", "password_reset_requests"],
  ["/api/admin/deleted-users", "deleted_users"],
  ["/api/admin/ads", "ads"],
  ["/api/admin/sold-ads", "sold_ads"],
  ["/api/admin/archived-ads", "archived_ads"],
  ["/api/admin/deleted-ads", "deleted_ads"],
  ["/api/admin/categories", "categories"],
  ["/api/admin/tags", "tags"],
  ["/api/admin/governorates", "governorates"],
  ["/api/admin/cities", "cities"],
  ["/api/admin/finance-hub", "finance_hub"],
  ["/api/admin/escrow", "escrow"],
  ["/api/admin/plans", "plans"],
  ["/api/admin/analytics", "analytics"],
  ["/api/admin/referrals", "referrals"],
  ["/api/admin/recycle-bin", "recycle_bin"],
  ["/api/support/admin", "support_inbox"],
  ["/api/admin-messages", "messaging"],
  ["/api/admin/settings", "system"],
  ["/api/admin/activity-logs", "activity_logs"],
  ["/api/admin/system-health", "system_health"],
  ["/api/categories", "categories"],
  ["/api/category-attributes", "categories"],
  ["/api/tags", "tags"],
  ["/api/governorates", "governorates"],
  ["/api/cities", "cities"],
  ["/api/bank-accounts", "finance_hub"],
  ["/api/plans", "plans"],
  ["/api/purchase-requests", "finance_hub"],
  ["/api/verification-requests", "users"],
  ["/api/platform-reviews", "platform_reviews"],
  ["/api/brokerage", "brokerage"],
  ["/api/comments", "reports"]
];

export function permissionForRequest(req) {
  const path = req.originalUrl.split("?")[0];
  const match = API_PERMISSION_RULES.find(([prefix]) => path.startsWith(prefix));
  if (match) return match[1];
  return path === "/api/admin/stats" ? "dashboard" : null;
}

export function hasAdminPermission(user, permission) {
  const legacyGroups = {
    dashboard: ["dashboard"],
    ads: ["ads", "sold_ads", "archived_ads", "deleted_ads"],
    market: ["categories", "tags", "governorates", "cities"],
    finance: ["finance_hub", "escrow", "plans", "commissions", "withdrawals"],
    users: ["users", "phone_users", "password_reset_requests", "deleted_users", "managed_sellers"],
    support: ["support_inbox", "messaging"],
    reports: ["reports", "analytics", "platform_reviews", "brokerage", "referrals", "activity_logs", "recycle_bin"],
    system: ["system_health", "welcome_promotion", "settings"]
  };
  const selected = Array.isArray(user?.permissions) ? user.permissions : [];
  return user?.role === "admin" || (
    user?.role === "supervisor" && permission && selected.some((value) => value === permission || legacyGroups[value]?.includes(permission))
  );
}