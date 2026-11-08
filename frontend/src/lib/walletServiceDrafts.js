export function findWalletServiceDrafts(drafts, serviceId) {
  const matchingDraft = (Array.isArray(drafts) ? drafts : []).find(
    (draft) => draft.type === "wallet_service_catalog"
      && String(draft.serviceId || "") === String(serviceId)
  ) || null;
  return { matchingDraft };
}
