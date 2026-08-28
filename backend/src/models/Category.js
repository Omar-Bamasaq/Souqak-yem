import mongoose from "mongoose";

const CategorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true },
    image: { type: String },
    parentId: { type: mongoose.Schema.Types.ObjectId, ref: "Category", default: null, index: true },
    description: { type: String },
    sortOrder: { type: Number, default: 0 },
    status: { type: String, enum: ["active", "hidden"], default: "active", index: true },
    adCount: { type: Number, default: 0 },
    icon: { type: String },
  },
  { timestamps: true }
);

CategorySchema.index({ parentId: 1, sortOrder: 1 });
CategorySchema.index({ status: 1, parentId: 1 });
CategorySchema.index({ slug: 1, status: 1 });

CategorySchema.virtual("children", {
  ref: "Category",
  localField: "_id",
  foreignField: "parentId"
});

CategorySchema.set("toJSON", { virtuals: true });
CategorySchema.set("toObject", { virtuals: true });

export default mongoose.models.Category || mongoose.model("Category", CategorySchema);
