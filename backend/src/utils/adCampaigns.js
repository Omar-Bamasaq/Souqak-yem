const DAY_MS = 24 * 60 * 60 * 1000;

export function isCampaignAvailable(campaign, now = new Date()) {
  const startsAt = new Date(campaign?.campaign?.startsAt).getTime();
  const endsAt = new Date(campaign?.campaign?.endsAt).getTime();
  const serviceType = campaign?.campaign?.serviceType || campaign?.plan?.adServiceType;
  return campaign?.status === "Approved"
    && campaign?.campaign?.isActive === true
    && campaign?.plan?.type === "featured"
    && ["placement", "interstitial"].includes(serviceType)
    && Number.isFinite(startsAt)
    && startsAt <= now.getTime()
    && Number.isFinite(endsAt)
    && endsAt > now.getTime();
}

export function getCampaignServiceType(campaign) {
  return campaign?.campaign?.serviceType || campaign?.plan?.adServiceType || "featured";
}

export function getCampaignPositions(campaign) {
  return campaign?.campaign?.positions?.length
    ? campaign.campaign.positions
    : campaign?.plan?.adPositions || [];
}

export function getCampaignWindow(start, durationInDays) {
  const startsAt = new Date(start);
  const duration = Number(durationInDays);
  if (!Number.isFinite(startsAt.getTime()) || !Number.isFinite(duration) || duration <= 0) {
    throw new Error("Invalid campaign schedule");
  }
  return {
    startsAt,
    endsAt: new Date(startsAt.getTime() + duration * DAY_MS)
  };
}

export function isValidCampaignWindow(start, end, durationInDays) {
  const startsAt = new Date(start).getTime();
  const endsAt = new Date(end).getTime();
  const maxDuration = Number(durationInDays) * DAY_MS;
  return Number.isFinite(startsAt)
    && Number.isFinite(endsAt)
    && endsAt > startsAt
    && Number.isFinite(maxDuration)
    && maxDuration > 0
    && endsAt - startsAt <= maxDuration;
}

export function isImpressionEligible(nextEligibleAt, now = new Date()) {
  return !nextEligibleAt || new Date(nextEligibleAt).getTime() <= now.getTime();
}
