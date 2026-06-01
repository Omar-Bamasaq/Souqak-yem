import mongoose from "mongoose";
import dotenv from "dotenv";
import Ad from "../models/Ad.js";
import Commission from "../models/Commission.js";
import SoldListing from "../models/SoldListing.js";
import Category from "../models/Category.js";

dotenv.config();

const migrate = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/suqaq";
    await mongoose.connect(mongoUri);
    console.log("Connected to MongoDB...");

    const commissions = await Commission.find({}).lean();
    console.log(`Found ${commissions.length} commissions to process.`);

    let count = 0;
    for (const comm of commissions) {
      if (!comm.adId) continue;

      // Check if SoldListing already exists
      const existing = await SoldListing.findOne({ adId: comm.adId });
      if (existing) continue;

      const ad = await Ad.findById(comm.adId).populate("categoryId", "name").lean();
      if (!ad) {
        console.log(`Ad ${comm.adId} not found for commission ${comm._id}. Skipping.`);
        continue;
      }

      await SoldListing.create({
        adId: ad._id,
        sellerId: comm.sellerId,
        buyerId: comm.buyerId || null,
        title: ad.title,
        price: comm.price || ad.price,
        currency: comm.currency || ad.currency || "YER_ADEN",
        categoryName: ad.categoryId?.name || "N/A",
        images: ad.images || [],
        commissionId: comm._id,
        commissionAmount: comm.commissionAmount,
        commissionStatus: comm.status,
        soldAt: comm.soldAt || ad.soldAt || ad.updatedAt,
        buyerType: ad.buyerType || "DIRECT",
        isOriginalAdDeleted: ad.isDeleted || false
      });
      count++;
    }

    console.log(`Successfully migrated ${count} sold listings.`);
    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
};

migrate();
