import mongoose from 'mongoose';

const cloudAccountSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    provider: { type: String, enum: ['aws', 'azure', 'gcp'], required: true, index: true },
    // AWS account number, Azure subscription id or GCP project id.
    externalId: { type: String, required: true },
    defaultRegion: { type: String, required: true },
    status: { type: String, enum: ['connected', 'syncing', 'error'], default: 'connected' },
    lastSyncedAt: Date,
    lastSyncDurationMs: Number,
    lastError: String,
    resourceCount: { type: Number, default: 0 },
    monthlyCost: { type: Number, default: 0 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export default mongoose.model('CloudAccount', cloudAccountSchema);
