import mongoose from "mongoose";

const supportFaqSchema = new mongoose.Schema(
  {
    key: { type: String, unique: true, sparse: true, index: true },
    question: { type: String, required: true, trim: true, maxlength: 180 },
    answer: { type: String, required: true, trim: true, maxlength: 2000 },
    keywords: { type: [String], default: [] },
    category: { type: String, default: "عام", trim: true, maxlength: 60 },
    sortOrder: { type: Number, default: 0 },
    active: { type: Boolean, default: true }
  },
  { timestamps: true }
);

supportFaqSchema.index({ active: 1, sortOrder: 1 });

export default mongoose.model("SupportFaq", supportFaqSchema);
