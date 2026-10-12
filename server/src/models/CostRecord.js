import mongoose from 'mongoose';

const costRecordSchema = new mongoose.Schema(
  {
    resource: { type: mongoose.Schema.Types.ObjectId, ref: 'Resource', required: true },
    account: { type: mongoose.Schema.Types.ObjectId, ref: 'CloudAccount', required: true },
    provider: { type: String, enum: ['aws', 'azure', 'gcp'], required: true },
    service: { type: String, required: true }, // unified: Compute, Block Storage, Snapshots, Public IP, Data Transfer
    region: String,
    team: String,
    date: { type: Date, required: true }, // UTC midnight
    cost: { type: Number, required: true }, // USD
  },
  { versionKey: false }
);

costRecordSchema.index({ date: -1, provider: 1 });
costRecordSchema.index({ account: 1, date: -1 });
costRecordSchema.index({ resource: 1, date: -1 });

export default mongoose.model('CostRecord', costRecordSchema);
