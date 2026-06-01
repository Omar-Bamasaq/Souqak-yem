import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    seller: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    price: { type: Number, required: true },
    category: { type: String, required: true },
    governorateId: { type: mongoose.Schema.Types.ObjectId, ref: "Governorate" },
    cityId: { type: mongoose.Schema.Types.ObjectId, ref: "City" },
    attributes: { type: mongoose.Schema.Types.Mixed },
    images: [{ type: String }],
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
    isFeatured: { type: Boolean, default: false },
    featuredUntil: { type: Date }
  },
  { timestamps: true }
);

export default mongoose.model("Product", productSchema);
