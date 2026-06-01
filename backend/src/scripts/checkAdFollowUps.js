import mongoose from "mongoose";
import dotenv from "dotenv";
import Ad from "../models/Ad.js";
import { createNotification } from "../services/notificationService.js";

dotenv.config();

/**
 * سكربت ذكي لفحص الإعلانات وإرسال تذكيرات الحالة للبائعين
 * يتم إرسال تذكير بعد 7 أيام من النشر إذا لم يتم البيع أو التمييز
 */
async function checkAdFollowUps() {
  try {
    console.log("Starting Ad Follow-up Check...");
    await mongoose.connect(process.env.MONGODB_URI);

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // 1. البحث عن الإعلانات النشطة التي مر عليها 7 أيام ولم يتم إرسال تذكير لها
    const adsToRemind = await Ad.find({
      status: "approved",
      sold: false,
      isArchived: false,
      featured: false, 
      publishedAt: { $lte: sevenDaysAgo },
      followUpStatus: "none"
    }).limit(100); 

    console.log(`Found ${adsToRemind.length} ads needing follow-up.`);

    for (const ad of adsToRemind) {
      try {
        await createNotification(null, {
          userId: ad.userId,
          type: "ad_status_followup",
          title: "هل تم بيع إعلانك؟ 🤔",
          body: `مرت 7 أيام على نشر إعلانك "${ad.title}". هل تم بيعه؟ أخبرنا الآن!`,
          data: { adId: ad._id, action: "check_status" }
        });

        // تحديث حالة التذكير في الإعلان
        ad.followUpStatus = "sent";
        ad.lastFollowUpAt = now;
        await ad.save();
        
        console.log(`Follow-up sent for ad: ${ad._id}`);
      } catch (err) {
        console.error(`Error processing ad ${ad._id}:`, err);
      }
    }

    console.log("Ad Follow-up Check Completed.");
    process.exit(0);
  } catch (err) {
    console.error("Critical error in Ad Follow-up Check:", err);
    process.exit(1);
  }
}

checkAdFollowUps();
