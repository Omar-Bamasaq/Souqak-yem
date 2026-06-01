import mongoose from "mongoose";

const AttributeSchema = new mongoose.Schema(
  {
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: "Category", required: true },
    name: { type: String, required: true },
    type: { type: String, enum: ["text", "number", "select"], required: true },
    options: [{ type: String }]
  },
  { timestamps: true }
);

export default mongoose.models.Attribute || mongoose.model("Attribute", AttributeSchema);
