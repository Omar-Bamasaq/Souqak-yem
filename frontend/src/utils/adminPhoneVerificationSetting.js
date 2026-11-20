export function getConfirmedPhoneVerificationSetting(settings) {
  const value = settings?.requirePhoneVerificationForAds !== false;
  return {
    status: "confirmed",
    savedValue: value,
    draftValue: value
  };
}

export function getUnknownPhoneVerificationSetting() {
  return {
    status: "unknown",
    savedValue: null,
    draftValue: null
  };
}

export function getPhoneVerificationSettingUpdate(settingState, userRole) {
  if (settingState?.status !== "confirmed") return null;
  if (userRole !== "admin") return {};

  const { savedValue, draftValue } = settingState;
  if (typeof savedValue !== "boolean" || typeof draftValue !== "boolean") return null;
  if (savedValue === draftValue) return {};

  return { requirePhoneVerificationForAds: draftValue };
}
