export function normalizeCommissionStatus(status, commissionStatus) {
  const normalizedStatus = String(status || "").trim().toLowerCase();
  const normalizedCommissionStatus = String(commissionStatus || "").trim().toLowerCase();

  return {
    status: normalizedStatus,
    commissionStatus: normalizedCommissionStatus
  };
}

export function isBlockingCommission(item = {}) {
  const { status, commissionStatus } = normalizeCommissionStatus(
    item?.status,
    item?.commissionStatus
  );

  const blockingValues = new Set([
    "unpaid",
    "overdue",
    "pending_payment",
    "pending_review",
    "pending",
    "rejected"
  ]);

  return blockingValues.has(status) || blockingValues.has(commissionStatus);
}

export function getBlockingCommissionSummary(items = []) {
  const safeItems = Array.isArray(items) ? items : [];

  const blockingItems = safeItems.filter((item) => isBlockingCommission(item));
  const unpaidCount = safeItems.filter((item) => normalizeCommissionStatus(item?.status, item?.commissionStatus).status === "unpaid").length;
  const overdueCount = safeItems.filter((item) => normalizeCommissionStatus(item?.status, item?.commissionStatus).status === "overdue").length;
  const pendingReviewCount = safeItems.filter((item) => {
    const { status, commissionStatus } = normalizeCommissionStatus(item?.status, item?.commissionStatus);
    return ["pending", "pending_payment", "pending_review", "rejected"].includes(status) || ["pending", "pending_payment", "pending_review", "rejected"].includes(commissionStatus);
  }).length;

  const totalAmount = blockingItems.reduce((sum, item) => sum + Number(item?.commissionAmount || 0), 0);
  const firstUnpaidAdId = safeItems.find((item) => {
    const { status, commissionStatus } = normalizeCommissionStatus(item?.status, item?.commissionStatus);
    const isOutstanding = ["unpaid", "overdue"].includes(status) || ["pending_payment", "pending_review", "rejected"].includes(commissionStatus);
    return isOutstanding && item?.adId;
  })?.adId || null;

  return {
    hasOutstanding: blockingItems.length > 0,
    blockingCount: blockingItems.length,
    unpaidCount,
    overdueCount,
    pendingReviewCount,
    totalAmount,
    firstUnpaidAdId
  };
}

export function hasOutstandingCommission(items = []) {
  return getBlockingCommissionSummary(items).hasOutstanding;
}
