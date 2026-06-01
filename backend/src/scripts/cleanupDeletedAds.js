import mongoose from "mongoose";
import dotenv from "dotenv";
import Ad from "../models/Ad.js";
import Commission from "../models/Commission.js";
import fs from "fs/promises";
import path from "path";

dotenv.config();

const cleanup = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/suqaq";
    await mongoose.connect(mongoUri);
    console.log("Connected to MongoDB for cleanup...");

    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    // 1. Find ads that are deleted and older than 90 days
    // and if they were sold, commission must be paid.
    const adsToCleanup = await Ad.find({
      isDeleted: true,
      deletedAt: { $lte: ninetyDaysAgo },
      images: { $exists: true, $not: { $size: 0 } }
    });

    console.log(`Found ${adsToCleanup.length} ads to check for image cleanup.`);

    let cleanedCount = 0;
    const uploadDir = path.join(process.cwd(), "uploads");

    for (const ad of adsToCleanup) {
      // If sold, check commission
      if (ad.sold || ad.status === "sold") {
        const commission = await Commission.findOne({ adId: ad._id });
        if (commission && commission.status !== "paid") {
          console.log(`Skipping ad ${ad._id} - commission not paid.`);
          continue;
        }
      }

      // Delete images from disk
      for (const img of ad.images) {
        try {
          const imgPath = path.join(uploadDir, img);
          const thumbPath = path.join(uploadDir, img.replace(/\.webp$/i, ".thumb.webp"));
          
          await fs.unlink(imgPath).catch(() => {});
          await fs.unlink(thumbPath).catch(() => {});
        } catch (err) {
          // Ignore unlink errors
        }
      }

      // Clear images array in DB but keep the ad record
      ad.images = [];
      ad.metadata = { ...ad.metadata, imagesCleanedAt: new Date() };
      await ad.save();
      cleanedCount++;
    }

    console.log(`Successfully cleaned images for ${cleanedCount} ads.`);
    process.exit(0);
  } catch (error) {
    console.error("Cleanup failed:", error);
    process.exit(1);
  }
};

cleanup();
