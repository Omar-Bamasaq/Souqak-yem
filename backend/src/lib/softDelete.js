/**
 * Mongoose Soft Delete Plugin
 * Standardizes isDeleted filtering across models.
 */
export const softDeletePlugin = (schema) => {
  // Common fields already added to models manually as per request for better control
  
  // Middleware to filter out deleted items by default
  const excludeDeletedItems = function (next) {
    // If the query explicitly asks for deleted items, don't override
    const filter = this.getFilter();
    if (filter.isDeleted === undefined) {
      this.where({ isDeleted: { $ne: true } });
    }
    next();
  };

  schema.pre("find", excludeDeletedItems);
  schema.pre("findOne", excludeDeletedItems);
  schema.pre("countDocuments", excludeDeletedItems);
  schema.pre("estimatedDocumentCount", excludeDeletedItems);
  schema.pre("findOneAndUpdate", excludeDeletedItems);
  schema.pre("updateMany", excludeDeletedItems);

  // Add instance method for soft delete
  schema.methods.softDelete = async function (userId, reason = null) {
    this.isDeleted = true;
    this.deletedAt = new Date();
    this.deletedBy = userId;
    this.deleteReason = reason;
    return this.save();
  };

  // Add static method for soft delete
  schema.statics.softDeleteById = async function (id, userId, reason = null) {
    return this.findByIdAndUpdate(id, {
      isDeleted: true,
      deletedAt: new Date(),
      deletedBy: userId,
      deleteReason: reason
    }, { new: true });
  };

  // Method to restore
  schema.methods.restore = async function () {
    this.isDeleted = false;
    this.deletedAt = null;
    this.deletedBy = null;
    this.deleteReason = null;
    return this.save();
  };
};
