export function getWalletServiceOrderSteps(service) {
  const hasSelectionStep = service?.pricingType === "PACKAGE"
    || (service?.pricingType === "UNIT" && service.sections?.length > 0);
  return hasSelectionStep
    ? ["selection", "details", "review"]
    : ["details", "review"];
}

export function canAdvanceWalletServiceOrderStep(step, { selectionComplete, detailsComplete }) {
  if (step === "selection") return selectionComplete;
  if (step === "details") return detailsComplete;
  return false;
}
