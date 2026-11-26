import StoreProfile from "../models/StoreProfile.js";
import StoreSubscription from "../models/StoreSubscription.js";
import { applySeoQueryTimeout } from "../services/seoCache.js";

export function isPublicStoreEligible(storeProfile, subscription, now = new Date()) {
  return Boolean(
    storeProfile?.status === "active"
    && StoreSubscription.getStoreSubscriptionStatus(subscription, now) === "active"
  );
}

export async function getPublicStoreProfileIds(now = new Date(), { maxTimeMS } = {}) {
  let storesQuery = StoreProfile.find({ status: "active" });
  let subscriptionsQuery;
  if (Number.isSafeInteger(maxTimeMS) && maxTimeMS > 0) {
    storesQuery = applySeoQueryTimeout(storesQuery, maxTimeMS);
  }
  const stores = await storesQuery.select("_id status").lean();
  if (!stores.length) return [];

  const storeIds = stores.map((store) => store._id);
  subscriptionsQuery = StoreSubscription.find({ storeId: { $in: storeIds } });
  if (Number.isSafeInteger(maxTimeMS) && maxTimeMS > 0) {
    subscriptionsQuery = applySeoQueryTimeout(subscriptionsQuery, maxTimeMS);
  }
  const subscriptions = await subscriptionsQuery
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
