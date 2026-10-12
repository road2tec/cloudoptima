import { CloudAccount, MetricSample, Recommendation, Resource } from '../models/index.js';
import { costSummary, dailyTotals } from '../services/costService.js';
import { savingsSummary } from '../engines/savingsCalculator.js';
import { asyncHandler, ok } from '../utils/http.js';
import { DAY, HOUR, round } from '../utils/stats.js';

// GET /dashboard/overview — one call that feeds the KPI row and the side panels.
export const overview = asyncHandler(async (_req, res) => {
  const now = Date.now();
  const [costs, savings, spendSpark, counts, cpuNow, cpuSpark, topRecs, accounts, heatTargets, fleetCpu] = await Promise.all([
    costSummary(),
    savingsSummary(),
    dailyTotals(14),
    Resource.aggregate([
      { $match: { state: { $ne: 'terminated' } } },
      { $group: { _id: { t: '$type', s: '$state' }, n: { $sum: 1 } } },
    ]),
    MetricSample.aggregate([
      { $match: { ts: { $gte: new Date(now - HOUR) } } },
      { $group: { _id: null, cpu: { $avg: '$cpu' }, mem: { $avg: '$mem' } } },
    ]),
    MetricSample.aggregate([
      { $match: { ts: { $gte: new Date(now - 14 * DAY) } } },
      { $group: { _id: { $dateTrunc: { date: '$ts', unit: 'day' } }, v: { $avg: '$cpu' } } },
      { $sort: { _id: 1 } },
    ]),
    Recommendation.find({ status: 'open' })
      .sort({ monthlySaving: -1 })
      .limit(5)
      .populate('resource', 'name provider region instanceType type tags')
      .lean(),
    CloudAccount.find().sort({ createdAt: 1 }).lean(),
    Resource.find({ type: 'vm', state: 'running' }).sort({ monthlyCost: -1 }).limit(14).select('name provider instanceType').lean(),
    MetricSample.aggregate([
      { $match: { ts: { $gte: new Date(now - 24 * HOUR) } } },
      { $group: { _id: { $dateTrunc: { date: '$ts', unit: 'hour' } }, cpu: { $avg: '$cpu' }, mem: { $avg: '$mem' } } },
      { $sort: { _id: 1 } },
    ]),
  ]);

  // Utilization heatmap: top VMs by cost × hour of day (IST), last 7 days.
  const heat = await MetricSample.aggregate([
    { $match: { resource: { $in: heatTargets.map((r) => r._id) }, ts: { $gte: new Date(now - 7 * DAY) } } },
    { $group: { _id: { r: '$resource', h: { $hour: { date: '$ts', timezone: 'Asia/Kolkata' } } }, cpu: { $avg: '$cpu' } } },
  ]);
  const heatmap = heatTargets.map((r) => {
    const hours = Array(24).fill(null);
    for (const h of heat) if (String(h._id.r) === String(r._id)) hours[h._id.h] = round(h.cpu, 1);
    return { id: r._id, name: r.name, provider: r.provider, instanceType: r.instanceType, hours };
  });

  const count = (fn) => counts.filter((c) => fn(c._id)).reduce((s, c) => s + c.n, 0);
  const potential = savings.potential;
  ok(res, {
    kpis: {
      mtdSpend: costs.thisMonth,
      momPct: costs.momPct,
      forecastMonthEnd: costs.forecastMonthEnd,
      lastMonth: costs.lastMonth,
      potentialSavings: potential,
      realizedSavings: savings.realized,
      wastePct: costs.monthlyRunRate ? round((potential / costs.monthlyRunRate) * 100, 1) : 0,
      monthlyRunRate: costs.monthlyRunRate,
      hourlyBurn: costs.hourlyBurn,
      activeResources: count(() => true),
      runningVms: count((k) => k.t === 'vm' && k.s === 'running'),
      totalVms: count((k) => k.t === 'vm'),
      avgCpu: round(cpuNow[0]?.cpu || 0, 1),
      avgMem: round(cpuNow[0]?.mem || 0, 1),
      openRecommendations: savings.counts.open,
    },
    sparklines: {
      spend: spendSpark,
      cpu: cpuSpark.map((c) => ({ date: c._id.toISOString().slice(0, 10), value: round(c.v, 1) })),
    },
    byProvider: costs.byProvider,
    savingsByCategory: savings.byCategory,
    topRecommendations: topRecs,
    accounts,
    heatmap,
    fleetCpu: fleetCpu.map((p) => ({ ts: p._id, cpu: round(p.cpu, 1), mem: round(p.mem, 1) })),
  });
});
