import SystemSettings from "../models/SystemSettings.js";
import WalletServiceOrder from "../models/WalletServiceOrder.js";

export const WALLET_SERVICE_COMPLETED_ORDER_BASELINE = 3;

export async function getWalletServiceCompletedOrderCount({
  SettingsModel = SystemSettings,
  OrderModel = WalletServiceOrder,
  now = () => new Date()
} = {}) {
  const historicalCompletedCount = await OrderModel.countDocuments({
    status: "COMPLETED",
    completionCounted: { $ne: true }
  });

  let settings = await SettingsModel.getSettings();
  if (!Number.isSafeInteger(settings.walletServiceCompletionBaseline?.historicalCompletedCount)) {
    const initializedAt = now();
    const initialized = await SettingsModel.findOneAndUpdate(
      {
        _id: settings._id,
        "walletServiceCompletionBaseline.historicalCompletedCount": { $exists: false }
      },
      {
        $set: {
          walletServiceCompletionBaseline: {
            initialCount: Math.max(WALLET_SERVICE_COMPLETED_ORDER_BASELINE, historicalCompletedCount),
            historicalCompletedCount,
            initializedAt
          }
        }
      },
      { new: true, runValidators: true }
    );
    settings = initialized || await SettingsModel.getSettings();
  }

  const baseline = settings.walletServiceCompletionBaseline;
  if (!Number.isSafeInteger(baseline?.initialCount)
    || baseline.initialCount < WALLET_SERVICE_COMPLETED_ORDER_BASELINE
    || !Number.isSafeInteger(baseline?.historicalCompletedCount)
    || baseline.historicalCompletedCount < 0
    || !(baseline?.initializedAt instanceof Date)
    || Number.isNaN(baseline.initializedAt.getTime())) {
    throw new Error("Wallet service completion baseline is missing or invalid.");
  }

  const newlyCountedCompletions = await OrderModel.countDocuments({
    status: "COMPLETED",
    completionCounted: true
  });
  return baseline.initialCount + newlyCountedCompletions;
}
