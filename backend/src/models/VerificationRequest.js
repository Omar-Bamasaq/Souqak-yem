import mongoose from "mongoose";
import { softDeletePlugin } from "../lib/softDelete.js";

const verificationRequestSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    fullName: { type: String, required: true },
    idNumber: { type: String, required: true },
    dateOfBirth: { type: Date, required: true },
    country: { type: String, required: true },
    phone: { type: String, required: true },
    idFrontImage: { type: String, required: true },
    idBackImage: { type: String }, // Optional but recommended
    selfieImage: { type: String }, // Optional but preferred
    address: { type: String },
    occupation: { type: String },
    docType: { type: String, enum: ["passport", "id_card"], default: "id_card" },
    status: { type: String, enum: ["pending", "approved", "rejected", "deleted"], default: "pending", index: true },
    rejectionReason: { type: String },

    // Soft Delete Fields (Phase 1)
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    deleteReason: { type: String, default: null }
  },
  { timestamps: true }
);

verificationRequestSchema.index({ createdAt: 1 });

verificationRequestSchema.plugin(softDeletePlugin);

export default mongoose.model("VerificationRequest", verificationRequestSchema);
