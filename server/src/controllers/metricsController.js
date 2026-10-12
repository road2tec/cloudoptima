import mongoose from 'mongoose';
import { MetricSample, Resource } from '../models/index.js';
import { ApiError, asyncHandler, ok } from '../utils/http.js';
import { DAY, percentile, round } from '../utils/stats.js';

// GET /metrics/:resourceId?from&to&interval=hour|day
export const getMetrics = asyncHandler(async (req, res) => {
  const { resourceId } = req.params;
  if (!mongoose.isValidObjectId(resourceId)) throw new ApiError(400, 'Invalid resource id');
  if (!(await Resource.exists({ _id: resourceId }))) throw new ApiError(404, 'Resource not found');

  const to = req.query.to ? new Date(req.query.to) : new Date();
  const from = req.query.from ? new Date(req.query.from) : new Date(to.getTime() - 30 * DAY);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) throw new ApiError(400, 'Invalid from/to date');
  const unit = req.query.interval === 'day' ? 'day' : 'hour';

  const points = await MetricSample.aggregate([
    { $match: { resource: new mongoose.Types.ObjectId(resourceId), ts: { $gte: from, $lte: to } } },
    {
      $group: {
        _id: { $dateTrunc: { date: '$ts', unit } },
        cpu: { $avg: '$cpu' },
        cpuMax: { $max: '$cpu' },
        mem: { $avg: '$mem' },
        netIn: { $sum: '$netIn' },
        netOut: { $sum: '$netOut' },
      },
    },
    { $sort: { _id: 1 } },
  ]);
  const cpu = points.map((p) => p.cpu);
  const mem = points.map((p) => p.mem);
  ok(res, {
    interval: unit,
    from,
    to,
    points: points.map((p) => ({ ts: p._id, cpu: round(p.cpu), cpuMax: round(p.cpuMax), mem: round(p.mem), netIn: round(p.netIn), netOut: round(p.netOut) })),
    stats: {
      cpuP95: round(percentile(cpu, 95)),
      memP95: round(percentile(mem, 95)),
      cpuAvg: round(cpu.reduce((s, v) => s + v, 0) / (cpu.length || 1)),
      cpuMax: round(Math.max(0, ...points.map((p) => p.cpuMax))),
      memAvg: round(mem.reduce((s, v) => s + v, 0) / (mem.length || 1)),
    },
  });
});
