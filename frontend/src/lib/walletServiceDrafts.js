export function findWalletServiceDrafts(drafts, serviceId) {
  const serviceDrafts = (Array.isArray(drafts) ? drafts : [])
    .filter((draft) => draft.type === "wallet_service_catalog");
  const matchingDraft = serviceDrafts.find(
    (draft) => String(draft.serviceId || "") === String(serviceId)
  ) || null;
  const otherDraft = serviceDrafts.find((draft) => draft !== matchingDraft) || null;

  return { matchingDraft, otherDraft };
}
