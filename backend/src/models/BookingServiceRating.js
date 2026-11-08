import mongoose from "mongoose";

const bookingServiceRatingSchema = new mongoose.Schema(
  {
    bookingServiceId: { type: mongoose.Schema.Types.ObjectId, ref: "BookingService", required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    stars: { type: Number, required: true, min: 1, max: 5 }
  },
  { timestamps: true }
);

bookingServiceRatingSchema.index({ bookingServiceId: 1, userId: 1 }, { unique: true });

export default mongoose.models.BookingServiceRating || mongoose.model("BookingServiceRating", bookingServiceRatingSchema);
