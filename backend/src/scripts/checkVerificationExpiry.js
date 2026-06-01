import User from "../models/User.js";
import { createNotification } from "../services/notificationService.js";
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

/**
 * فحص انتهاء صلاحية التوثيق وإرسال التنبيهات
 */
async function checkVerificationExpiry() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("Checking verification expiry status...");

        const now = new Date();
        const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

        // 1. تحويل الحسابات المنتهية إلى expired
        const expiredUsers = await User.find({
            verificationStatus: "verified",
            verificationExpiryDate: { $lte: now }
        });

        for (const user of expiredUsers) {
            user.verificationStatus = "expired";
            user.verified = false; // backward compatibility
            user.isVerifiedSeller = false; // optional: restrict seller features on expiry?
            await user.save();

            await createNotification(null, {
                userId: user._id,
                title: "انتهت صلاحية توثيق حسابك",
                body: "لقد انتهت صلاحية توثيق حسابك اليوم. يرجى إعادة التوثيق لاستعادة كافة الميزات.",
                type: "verification_expired",
                data: { status: "expired" }
            });
            console.log(`User ${user.name} verification expired.`);
        }

        // 2. تنبيه قبل 7 أيام
        const warning7Days = await User.find({
            verificationStatus: "verified",
            verificationExpiryDate: { 
                $gt: now, 
                $lte: sevenDaysFromNow 
            }
        });

        for (const user of warning7Days) {
            await createNotification(null, {
                userId: user._id,
                title: "تنبيه: اقترب انتهاء توثيق حسابك",
                body: `بقي 7 أيام فقط على انتهاء صلاحية توثيق حسابك (${new Date(user.verificationExpiryDate).toLocaleDateString('ar-YE')}). يرجى الاستعداد لإعادة التوثيق.`,
                type: "verification_warning",
                data: { daysLeft: 7 }
            });
        }

        // 3. تنبيه قبل 30 يوم
        const warning30Days = await User.find({
            verificationStatus: "verified",
            verificationExpiryDate: { 
                $gt: sevenDaysFromNow, 
                $lte: thirtyDaysFromNow 
            }
        });

        for (const user of warning30Days) {
            await createNotification(null, {
                userId: user._id,
                title: "تذكير: موعد تجديد التوثيق",
                body: `تذكير بأن توثيق حسابك سينتهي خلال 30 يوم (${new Date(user.verificationExpiryDate).toLocaleDateString('ar-YE')}). التوثيق الآن مجاني 100%.`,
                type: "verification_warning",
                data: { daysLeft: 30 }
            });
        }

        console.log("Verification expiry check done.");
        process.exit(0);
    } catch (err) {
        console.error("Verification check error:", err);
        process.exit(1);
    }
}

checkVerificationExpiry();
