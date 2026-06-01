import mongoose from "mongoose";

const ListingAttributeValueSchema = new mongoose.Schema(
  {
    listingId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "Ad", 
      required: true,
      index: true 
    },
    attributeId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "CategoryAttribute", 
      required: true,
      index: true 
    },
    value: { 
      type: mongoose.Schema.Types.Mixed, 
      required: true 
    }
  },
  { timestamps: true }
);

// Compound indexes for efficient queries
ListingAttributeValueSchema.index({ listingId: 1, attributeId: 1 }, { unique: true });
ListingAttributeValueSchema.index({ attributeId: 1 });

const ListingAttributeValue = mongoose.model("ListingAttributeValue", ListingAttributeValueSchema);

export default ListingAttributeValue;
