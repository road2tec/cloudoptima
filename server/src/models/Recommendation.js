import mongoose from 'mongoose';

export const CATEGORIES = ['rightsize', 'idle-vm', 'unattached-disk', 'unused-ip', 'old-snapshot', 'stopped-vm'];

const recommendationSchema = new mongoose.Schema(
  {
    resource: { type: mongoose.Schema.Types.ObjectId, ref: 'Resource', required: true, index: true },
    account: { type: mongoose.Schema.Types.ObjectId, ref: 'CloudAccount' },
    provider: { type: String, enum: ['aws', 'azure', 'gcp'] },
    category: { type: String, enum: CATEGORIES, required: true, index: true },
    title: { type: String, required: true },
    reason: { type: String, required: true },
    currentConfig: mongoose.Schema.Types.Mixed,
    proposedConfig: mongoose.Schema.Types.Mixed,
    action: mongoose.Schema.Types.Mixed, // what the connector will execute
    evidence: mongoose.Schema.Types.Mixed, // numbers behind the decision
    monthlySaving: { type: Number, required: true },
    risk: { type: String, enum: ['low', 'medium', 'high'], default: 'low' },
    confidence: { type: Number, min: 0, max: 1, default: 0.8 },
    status: { type: String, enum: ['open', 'approved', 'rejected', 'executed'], default: 'open', index: true },
    decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    decidedAt: Date,
    executedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    executedAt: Date,
    note: String,
  },
  { timestamps: true }
);

export default mongoose.model('Recommendation', recommendationSchema);
