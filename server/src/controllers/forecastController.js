import mongoose from 'mongoose';
import { Forecast, MetricSample, Resource } from '../models/index.js';
import { runForecasts } from '../engines/forecaster.js';
import { ApiError, asyncHandler, ok } from '../utils/http.js';
import { audit } from '../utils/audit.js';
import { DAY, round } from '../utils/stats.js';

const roundPts = (rows) => rows.map((r) => ({ ts: r._id, value: round(r.value), lower: round(r.lower), upper: round(r.upper) }));

// GET /forecasts — fleet-level demand forecast + model accuracy table
export const fleetForecast = asyncHandler(async (_req, res) => {
  const [fleet, backtest, history, accuracy] = await Promise.all([
    Forecast.aggregate([
      { $match: { metric: 'cpu' } },
      { $unwind: '$points' },
      { $group: { _id: '$points.ts', value: { $avg: '$points.value' }, lower: { $avg: '$points.lower' }, upper: { $avg: '$points.upper' } } },
      { $sort: { _id: 1 } },
    ]),
    Forecast.aggregate([
      { $match: { metric: 'cpu' } },
      { $unwind: '$backtest' },
      { $group: { _id: '$backtest.ts', actual: { $avg: '$backtest.actual' }, predicted: { $avg: '$backtest.predicted' } } },
      { $sort: { _id: 1 } },
    ]),
    MetricSample.aggregate([
      { $match: { ts: { $gte: new Date(Date.now() - 7 * DAY) } } },
      { $group: { _id: { $dateTrunc: { date: '$ts', unit: 'hour' } }, value: { $avg: '$cpu' } } },
      { $sort: { _id: 1 } },
    ]),
    Forecast.find({ metric: 'cpu' })
      .select('resource model mape rmse predictedPeak createdAt params trainedOn')
      .populate('resource', 'name provider instanceType region')
      .sort({ mape: 1 })
      .lean(),
  ]);
  const memPeaks = await Forecast.find({ metric: 'mem' }).select('resource predictedPeak mape').lean();
  const memBy = new Map(memPeaks.map((m) => [String(m.resource), m]));
  const rows = accuracy.filter((a) => a.resource).map((a) => ({
    ...a,
    memPeak: memBy.get(String(a.resource._id))?.predictedPeak ?? null,
    memMape: memBy.get(String(a.resource._id))?.mape ?? null,
  }));
  const avg = (k) => (rows.length ? round(rows.reduce((s, r) => s + r[k], 0) / rows.length) : null);

  ok(res, {
    fleet: roundPts(fleet),
    backtest: backtest.map((b) => ({ ts: b._id, actual: round(b.actual), predicted: round(b.predicted) })),
    history: history.map((h) => ({ ts: h._id, value: round(h.value) })),
    accuracy: rows,
    summary: {
      count: rows.length,
      avgMape: avg('mape'),
      avgRmse: avg('rmse'),
      peak: fleet.length ? round(Math.max(...fleet.map((f) => f.value))) : null,
      lastRun: rows[0]?.createdAt || null,
      models: rows.reduce((m, r) => ({ ...m, [r.model]: (m[r.model] || 0) + 1 }), {}),
    },
  });
});

// GET /forecasts/:resourceId
export const resourceForecast = asyncHandler(async (req, res) => {
  const { resourceId } = req.params;
  if (!mongoose.isValidObjectId(resourceId)) throw new ApiError(400, 'Invalid resource id');
  const [forecasts, history] = await Promise.all([
    Forecast.find({ resource: resourceId }).lean(),
    MetricSample.aggregate([
      { $match: { resource: new mongoose.Types.ObjectId(resourceId), ts: { $gte: new Date(Date.now() - 7 * DAY) } } },
      { $group: { _id: { $dateTrunc: { date: '$ts', unit: 'hour' } }, cpu: { $avg: '$cpu' }, mem: { $avg: '$mem' } } },
      { $sort: { _id: 1 } },
    ]),
  ]);
  ok(res, {
    cpu: forecasts.find((f) => f.metric === 'cpu') || null,
    mem: forecasts.find((f) => f.metric === 'mem') || null,
    history: history.map((h) => ({ ts: h._id, cpu: round(h.cpu), mem: round(h.mem) })),
  });
});

// POST /forecasts/run  { resourceId? }
export const runForecast = asyncHandler(async (req, res) => {
  const { resourceId } = req.body || {};
  if (resourceId && !(await Resource.exists({ _id: resourceId }))) throw new ApiError(404, 'Resource not found');
  const result = await runForecasts(resourceId ? { resourceIds: [new mongoose.Types.ObjectId(resourceId)] } : {});
  await audit(req, 'forecast.run', resourceId ? 'resource' : 'fleet', resourceId, result);
  ok(res, result, `Forecasted ${result.resources} resource(s)`);
});
