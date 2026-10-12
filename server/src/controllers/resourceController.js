import mongoose from 'mongoose';
import { CostRecord, Forecast, MetricSample, Recommendation, Resource } from '../models/index.js';
import { ApiError, asyncHandler, ok, paginate } from '../utils/http.js';
import { DAY, percentile, round, startOfUtcDay } from '../utils/stats.js';

const SORTABLE = ['name', 'provider', 'type', 'region', 'state', 'monthlyCost', 'instanceType', 'createdAt', 'sizeGb'];
const escapeRx = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const list = (v) => (v ? String(v).split(',').filter(Boolean) : null);

export function buildResourceFilter(q) {
  const f = {};
  if (list(q.provider)) f.provider = { $in: list(q.provider) };
  if (list(q.region)) f.region = { $in: list(q.region) };
  if (list(q.type)) f.type = { $in: list(q.type) };
  f.state = list(q.state) ? { $in: list(q.state) } : { $ne: 'terminated' };
  if (q.account && mongoose.isValidObjectId(q.account)) f.account = q.account;
  // tag=env:prod  (several separated by ",")
  for (const t of list(q.tag) || []) {
    const [k, v] = t.split(':');
    if (k && v) f[`tags.${k}`] = v;
  }
  if (q.search) {
    const rx = new RegExp(escapeRx(String(q.search).trim()), 'i');
    f.$or = [{ name: rx }, { resourceId: rx }, { instanceType: rx }, { region: rx }];
  }
  return f;
}

export const listResources = asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate(req.query);
  const filter = buildResourceFilter(req.query);
  let sortKey = String(req.query.sort || '-monthlyCost');
  const dir = sortKey.startsWith('-') ? -1 : 1;
  sortKey = sortKey.replace(/^-/, '');
  if (!SORTABLE.includes(sortKey)) sortKey = 'monthlyCost';

  const [items, total] = await Promise.all([
    Resource.find(filter).sort({ [sortKey]: dir, _id: 1 }).skip(skip).limit(limit).populate('account', 'name provider').lean(),
    Resource.countDocuments(filter),
  ]);
  ok(res, { items, page, limit, total });
});

export const facets = asyncHandler(async (_req, res) => {
  const [result] = await Resource.aggregate([
    { $match: { state: { $ne: 'terminated' } } },
    {
      $facet: {
        regions: [{ $group: { _id: { r: '$region', p: '$provider' }, n: { $sum: 1 } } }, { $sort: { '_id.p': 1, '_id.r': 1 } }],
        types: [{ $group: { _id: '$type', n: { $sum: 1 } } }],
        states: [{ $group: { _id: '$state', n: { $sum: 1 } } }],
        envs: [{ $group: { _id: '$tags.env', n: { $sum: 1 } } }],
        teams: [{ $group: { _id: '$tags.team', n: { $sum: 1 } } }, { $sort: { _id: 1 } }],
      },
    },
  ]);
  const flat = (rows) => rows.filter((r) => r._id).map((r) => ({ value: r._id, count: r.n }));
  ok(res, {
    regions: result.regions.map((r) => ({ value: r._id.r, provider: r._id.p, count: r.n })),
    types: flat(result.types),
    states: flat(result.states),
    envs: flat(result.envs),
    teams: flat(result.teams),
  });
});

export const getResource = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new ApiError(400, 'Invalid resource id');
  const resource = await Resource.findById(req.params.id).populate('account', 'name provider externalId').lean();
  if (!resource) throw new ApiError(404, 'Resource not found');

  const now = Date.now();
  const [attached, parent, metrics7d, metrics30d, costs, recommendations, forecasts] = await Promise.all([
    Resource.find({ attachedTo: resource.resourceId, state: { $ne: 'terminated' } }).select('name type sizeGb monthlyCost state meta').lean(),
    resource.attachedTo ? Resource.findOne({ resourceId: resource.attachedTo }).select('name type instanceType state').lean() : null,
    MetricSample.aggregate([
      { $match: { resource: resource._id, ts: { $gte: new Date(now - 7 * DAY) } } },
      { $group: { _id: { $dateTrunc: { date: '$ts', unit: 'hour' } }, cpu: { $avg: '$cpu' }, mem: { $avg: '$mem' } } },
      { $sort: { _id: 1 } },
    ]),
    MetricSample.find({ resource: resource._id, ts: { $gte: new Date(now - 30 * DAY) } }).select('cpu mem -_id').lean(),
    CostRecord.aggregate([
      { $match: { resource: resource._id, date: { $gte: new Date(startOfUtcDay(now - 89 * DAY)) } } },
      { $group: { _id: { d: '$date', s: '$service' }, cost: { $sum: '$cost' } } },
      { $sort: { '_id.d': 1 } },
    ]),
    Recommendation.find({ resource: resource._id }).sort({ createdAt: -1 }).populate('decidedBy', 'name').lean(),
    Forecast.find({ resource: resource._id }).select('metric model mape rmse predictedPeak createdAt').lean(),
  ]);

  const byDay = new Map();
  const services = new Set();
  for (const c of costs) {
    const d = c._id.d.toISOString().slice(0, 10);
    services.add(c._id.s);
    const row = byDay.get(d) || { date: d, total: 0 };
    row[c._id.s] = round(c.cost, 4);
    row.total = round(row.total + c.cost, 4);
    byDay.set(d, row);
  }
  const costHistory = [...byDay.values()];
  const last30 = costHistory.slice(-30).reduce((s, r) => s + r.total, 0);

  ok(res, {
    resource,
    attached,
    parent,
    metrics: metrics7d.map((m) => ({ ts: m._id, cpu: round(m.cpu), mem: round(m.mem) })),
    stats: metrics30d.length
      ? {
          cpuP95: round(percentile(metrics30d.map((m) => m.cpu), 95)),
          memP95: round(percentile(metrics30d.map((m) => m.mem), 95)),
          cpuAvg: round(metrics30d.reduce((s, m) => s + m.cpu, 0) / metrics30d.length),
          samples: metrics30d.length,
        }
      : null,
    costHistory,
    costServices: [...services],
    last30dCost: round(last30),
    recommendations,
    forecasts,
  });
});
