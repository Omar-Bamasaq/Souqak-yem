import mongoose from "mongoose";
import dotenv from "dotenv";
import Ad from "../models/Ad.js";
import { createNotification } from "../services/notificationService.js";

dotenv.config();

/**
 * Script to expire welcome promotions that have passed their end date.
 */
async function expireWelcomePromotions() {
  try {
    console.log("Starting Welcome Promotion Expiration Check...");
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI);
    }

    const now = new Date();

    // Find promoted ads that have expired
    const expiredAds = await Ad.find({
      isWelcomePromoted: true,
      welcomePromotionEndDate: { $lte: now }
    });

    console.log(`Found ${expiredAds.length} expired welcome promotions.`);

    for (const ad of expiredAds) {
      try {
        // Prepare stats for the notification/summary
        const stats = ad.promotionStats || {};
        
        // Notify the user about the results
        await createNotification(null, {
          userId: ad.userId,
          type: "welcome_promotion_expired",
          title: "🎁 انتهى التمييز المجاني",
          body: `حقق إعلانك "${ad.title}" نتائج ممتازة خلال فترة التمييز الترحيبي. شاهد الملخص الآن!`,
          data: { 
            adId: ad._id, 
            action: "show_welcome_summary",
            stats: stats
          }
        });

        // Update ad status
        ad.featured = false;
        ad.isWelcomePromoted = false;
        // Note: we keep welcomePromotionEndDate and promotionStats for historical tracking
        await ad.save();
        
        console.log(`Expired promotion for ad: ${ad._id}`);
      } catch (err) {
        console.error(`Failed to expire promotion for ad ${ad._id}:`, err);
      }
    }

    console.log("Welcome Promotion Expiration Check completed.");
  } catch (error) {
    console.error("Error in expireWelcomePromotions script:", error);
  }
}

// If running directly
if (import.meta.url === `file://${process.argv[1]}`) {
  expireWelcomePromotions().then(() => mongoose.connection.close());
}

export default expireWelcomePromotions;
