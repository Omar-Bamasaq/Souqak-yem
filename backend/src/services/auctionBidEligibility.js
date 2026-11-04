import { isUserVerificationCurrent } from "./userVerification.js";

export function createAuctionBidEligibilityChecker({ UserModel }) {
  if (!UserModel || typeof UserModel.findOne !== "function") {
    throw new TypeError("The User model is required.");
  }

  return async function isAuctionBidderEligible({ bidderId, session, now }) {
    if (!session) throw new TypeError("A MongoDB session is required.");
    const user = await UserModel.findOne({
      _id: bidderId
    })
      .select("_id isDisabled isDeleted verificationStatus verificationExpiryDate")
      .session(session)
      .lean();

    if (!user || user.isDisabled || user.isDeleted) return "inactive";
    return isUserVerificationCurrent(user, now) ? "eligible" : "verification-required";
  };
}
