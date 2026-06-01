import mongoose from "mongoose";

const TagSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    slug: { type: String, required: true, unique: true },
    description: { type: String },
    icon: { type: String },
    color: { type: String, default: "#6366f1" },
    categoryIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Category" }],
    isPopular: { type: Boolean, default: false },
    order: { type: Number, default: 0 }
  },
  { timestamps: true }
);

TagSchema.index({ slug: 1 });
TagSchema.index({ categoryIds: 1 });
TagSchema.index({ isPopular: 1, order: 1 });

export default mongoose.models.Tag || mongoose.model("Tag", TagSchema);
