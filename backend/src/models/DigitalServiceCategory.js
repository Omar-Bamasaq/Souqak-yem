import mongoose from "mongoose";

const digitalServiceCategorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      maxlength: 80
    },
    description: { type: String, default: "", maxlength: 1000 },
    image: { type: String, default: "", maxlength: 500 },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true, index: true },
    isArchived: { type: Boolean, default: false, index: true }
  },
  { timestamps: true }
);

digitalServiceCategorySchema.index({ slug: 1 }, { unique: true });
digitalServiceCategorySchema.index({ isActive: 1, isArchived: 1, sortOrder: 1 });

export default mongoose.model("DigitalServiceCategory", digitalServiceCategorySchema);
