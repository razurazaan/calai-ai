import mongoose from "mongoose";
import { PAID_PERIODS, PAYMENT_PROVIDERS } from "./User.js";

// One row per Pro payment (or refund). An admin records them by hand today; a payment-provider
// webhook (Razorpay, Google Play, App Store, Stripe) can write the same rows later.
const paymentSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    amount: { type: Number, required: true, min: 0 }, // major units: 199 = ₹199
    currency: { type: String, default: "INR", uppercase: true, trim: true, minlength: 3, maxlength: 3 },
    period: { type: String, enum: PAID_PERIODS, required: true },
    provider: { type: String, enum: PAYMENT_PROVIDERS, default: "manual" },
    status: { type: String, enum: ["paid", "refunded"], default: "paid", index: true },
    reference: { type: String, trim: true, maxlength: 200 }, // provider transaction / order id
    note: { type: String, trim: true, maxlength: 500 },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // admin who entered it
  },
  { timestamps: true }
);
paymentSchema.index({ createdAt: -1 });

export default mongoose.model("Payment", paymentSchema);
