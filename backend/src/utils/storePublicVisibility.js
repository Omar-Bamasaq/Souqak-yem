import StoreProfile from "../models/StoreProfile.js";
import StoreSubscription from "../models/StoreSubscription.js";

export function isPublicStoreEligible(storeProfile, subscription, now = new Date()) {
  return Boolean(
    storeProfile?.status === "active"
    && StoreSubscription.getStoreSubscriptionStatus(subscription, now) === "active"
  );
}

export async function getPublicStoreProfileIds(now = new Date()) {
  const stores = await StoreProfile.find({ status: "active" }).select("_id status").lean();
  if (!stores.length) return [];

  const storeIds = stores.map((store) => store._id);
  const subscriptions = await StoreSubscription.find({ storeId: { $in: storeIds } })
    .sort({ createdAt: -1, _id: -1 })
    .select("storeId status endDate")
    .lean();
  const latestByStore = new Map();
  for (const subscription of subscriptions) {
    const id = String(subscription.storeId);
    if (!latestByStore.has(id)) latestByStore.set(id, subscription);
  }

  return stores
    .filter((store) => isPublicStoreEligible(store, latestByStore.get(String(store._id)), now))
    .map((store) => store._id);
}

export function applyPublicStoreFilter(filter, storeProfileIds) {
  const existingAnd = Array.isArray(filter.$and) ? filter.$and : [];
  const withoutAnd = { ...filter };
  delete withoutAnd.$and;

  return {
    ...withoutAnd,
    $and: [
      ...existingAnd,
      {
        $or: [
          { storeProfileId: null },
          { storeProfileId: { $exists: false } },
          {
            storeProfileId: { $in: storeProfileIds },
            isVisible: { $ne: false }
          }
        ]
      }
    ]
  };
}
