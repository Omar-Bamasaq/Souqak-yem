export function getActiveSponsoredCampaigns(campaigns, now = Date.now()) {
  return campaigns.filter((campaign) => {
    const endsAt = Date.parse(campaign.endsAt);
    return Number.isFinite(endsAt) && endsAt > now;
  });
}

export function getSponsoredRotationDelayMs(campaign) {
  const intervalSeconds = Number(campaign?.rotationIntervalSeconds);
  return (Number.isInteger(intervalSeconds) && intervalSeconds >= 1 && intervalSeconds <= 60
    ? intervalSeconds
    : 5) * 1000;
}

export function getNextSponsoredCampaignIndex(currentIndex, campaignCount) {
  if (campaignCount < 1) return 0;
  return ((currentIndex % campaignCount) + campaignCount) % campaignCount;
}
