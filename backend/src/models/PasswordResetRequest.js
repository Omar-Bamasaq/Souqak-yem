import mongoose from 'mongoose';

const passwordResetRequestSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    },
    temporaryPassword: { type: String, default: null },
    requestedAt: { type: Date, default: Date.now },
    reviewedAt: { type: Date, default: null },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    adminNote: { type: String, default: '' }
  },
  { timestamps: true }
);

passwordResetRequestSchema.index({ username: 1, phone: 1, status: 1 });

export default mongoose.model('PasswordResetRequest', passwordResetRequestSchema);
