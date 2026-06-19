import mongoose from "mongoose";
import { softDeletePlugin } from "../lib/softDelete.js";

const REVIEW_SUBJECT_TYPES = ["BROKER", "SELLER"];
const REVIEW_STATES = ["DRAFT", "SUBMITTED", "APPROVED", "REJECTED", "ARCHIVED"];

const BrokerageReviewSchema = new mongoose.Schema(
  {
    dealId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "BrokerageDeal", 
      required: true, 
      unique: true 
    },
    authorId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "User", 
      required: true 
    },
    subjectId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "User", 
      required: true 
    },
    subjectType: { 
      type: String, 
      enum: REVIEW_SUBJECT_TYPES, 
      required: true 
    },

    rating: { type: Number, required: true, min: 1, max: 5 },
    title: { type: String, maxLength: 100, default: null },
    text: { type: String, maxLength: 1000, required: true },

    state: { 
      type: String, 
      enum: REVIEW_STATES, 
      default: "SUBMITTED" 
    },
    moderationNotes: { type: String, default: null },
    approvedAt: { type: Date, default: null },
    approvedBy: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "User", 
      default: null 
    },
    
    // Soft Delete
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    deleteReason: { type: String, default: null }
  },
  { timestamps: true }
);

BrokerageReviewSchema.index({ subjectId: 1, subjectType: 1, state: 1 });
BrokerageReviewSchema.index({ dealId: 1 }, { unique: true });
BrokerageReviewSchema.plugin(softDeletePlugin);

export default mongoose.models.BrokerageReview || mongoose.model("BrokerageReview", BrokerageReviewSchema);
