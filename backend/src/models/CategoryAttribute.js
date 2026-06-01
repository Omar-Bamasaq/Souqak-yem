import mongoose from "mongoose";

const CategoryAttributeSchema = new mongoose.Schema(
  {
    categoryId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "Category", 
      required: true,
      index: true 
    },
    name: { 
      type: String, 
      required: true, 
      trim: true 
    },
    label: { 
      type: String, 
      required: true, 
      trim: true 
    },
    type: { 
      type: String, 
      enum: ["text", "number", "select", "boolean", "multiselect"], 
      required: true,
      default: "text"
    },
    options: [{ 
      type: String 
    }],
    required: { 
      type: Boolean, 
      default: false 
    },
    sortOrder: { 
      type: Number, 
      default: 0 
    },
    placeholder: { 
      type: String, 
      default: "" 
    },
    helpText: { 
      type: String, 
      default: "" 
    },
    validation: {
      min: Number,
      max: Number,
      pattern: String
    }
  },
  { timestamps: true }
);

// Index for efficient queries
CategoryAttributeSchema.index({ categoryId: 1, sortOrder: 1 });
CategoryAttributeSchema.index({ categoryId: 1, name: 1 });

const CategoryAttribute = mongoose.model("CategoryAttribute", CategoryAttributeSchema);

export default CategoryAttribute;
