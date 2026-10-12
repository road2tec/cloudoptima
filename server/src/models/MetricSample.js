import mongoose from 'mongoose';

const metricSampleSchema = new mongoose.Schema(
  {
    resource: { type: mongoose.Schema.Types.ObjectId, ref: 'Resource', required: true },
    ts: { type: Date, required: true },
    cpu: Number, // %
    mem: Number, // %
    netIn: Number, // MB in the sample interval
    netOut: Number, // MB in the sample interval
  },
  { versionKey: false }
);

metricSampleSchema.index({ resource: 1, ts: -1 });
metricSampleSchema.index({ ts: -1 });

export default mongoose.model('MetricSample', metricSampleSchema);
