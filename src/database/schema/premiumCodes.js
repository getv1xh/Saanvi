import mongoose from 'mongoose';

const premiumCodeSchema = new mongoose.Schema(
        {
                _id: { type: String },
                durationMs: { type: Number, required: true },
                durationLabel: { type: String, required: true },
                createdBy: { type: String, required: true },
                expiresAt: { type: Date, required: true },
                redeemedBy: { type: String, default: null },
                redeemedAt: { type: Date, default: null },
        },
        {
                timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
        },
);

premiumCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const PremiumCode =
        mongoose.models.PremiumCode || mongoose.model('PremiumCode', premiumCodeSchema);
