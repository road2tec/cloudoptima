import mongoose from 'mongoose';

// Unified, provider-neutral resource produced by the normalization layer.
const resourceSchema = new mongoose.Schema(
  {
    resourceId: { type: String, required: true, unique: true }, // e.g. "aws:i-0abc..."
    nativeId: { type: String, required: true },
    account: { type: mongoose.Schema.Types.ObjectId, ref: 'CloudAccount', required: true, index: true },
    provider: { type: String, enum: ['aws', 'azure', 'gcp'], required: true, index: true },
    type: { type: String, enum: ['vm', 'disk', 'ip', 'snapshot'], required: true, index: true },
    name: { type: String, required: true, index: true },
    region: { type: String, index: true },
    zone: String,
    instanceType: String,
    family: String,
    vcpu: Number,
    memoryGb: Number,
    sizeGb: Number,
    hourlyPrice: { type: Number, default: 0 },
    monthlyCost: { type: Number, default: 0 },
    state: { type: String, enum: ['running', 'stopped', 'available', 'in-use', 'terminated'], index: true },
    attachedTo: String, // unified resourceId of the parent VM
    tags: { type: Map, of: String, default: {} },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
    // Workload pattern used by the simulator only; never returned by the API.
    pattern: { type: String, select: false },
    createdAt: Date,
    stoppedAt: Date,
    terminatedAt: Date,
    lastSeenAt: Date,
  },
  { timestamps: { createdAt: false, updatedAt: true } }
);

resourceSchema.index({ provider: 1, type: 1, state: 1 });
resourceSchema.index({ monthlyCost: -1 });

export default mongoose.model('Resource', resourceSchema);
