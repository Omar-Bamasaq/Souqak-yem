import mongoose from "mongoose";

const commentSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    text: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    reports: { type: Number, default: 0 }
  },
  { timestamps: false }
);

export default mongoose.model("Comment", commentSchema);
