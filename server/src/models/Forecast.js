import mongoose from 'mongoose';

const pointSchema = new mongoose.Schema({ ts: Date, value: Number, lower: Number, upper: Number }, { _id: false });
const backtestSchema = new mongoose.Schema({ ts: Date, actual: Number, predicted: Number }, { _id: false });

const forecastSchema = new mongoose.Schema(
  {
    resource: { type: mongoose.Schema.Types.ObjectId, ref: 'Resource', required: true, index: true },
    account: { type: mongoose.Schema.Types.ObjectId, ref: 'CloudAccount' },
    provider: String,
    metric: { type: String, enum: ['cpu', 'mem'], required: true },
    model: { type: String, enum: ['holt-winters', 'linear-trend'], default: 'holt-winters' },
    params: mongoose.Schema.Types.Mixed,
    horizonDays: { type: Number, default: 14 },
    points: [pointSchema],
    backtest: [backtestSchema], // hold-out window used for MAPE / RMSE
    mape: Number,
    rmse: Number,
    predictedPeak: Number,
    trainedOn: Number,
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export default mongoose.model('Forecast', forecastSchema);
