import mongoose from "mongoose";

const CitySchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    governorateId: { type: mongoose.Schema.Types.ObjectId, ref: "Governorate", required: true },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

export default mongoose.models.City || mongoose.model("City", CitySchema);
