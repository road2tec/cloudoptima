// Cost roll-ups shared by the cost and dashboard controllers (all aggregation pipelines).
import { CostRecord, Resource } from '../models/index.js';
import { DAY, HOURS_PER_MONTH, round, startOfUtcDay } from '../utils/stats.js';

export function monthBounds(now = Date.now()) {
  const d = new Date(now);
  const monthStart = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
  const nextMonth = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
  const prevMonth = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1);
  return { monthStart, nextMonth, prevMonth, today: startOfUtcDay(now) };
}

// Current hourly burn rate of everything that is still billed.
export async function burnRate() {
  const [agg] = await Resource.aggregate([
    { $match: { state: { $ne: 'terminated' } } },
    { $group: { _id: null, monthly: { $sum: '$monthlyCost' } } },
  ]);
  const monthly = agg?.monthly || 0;
  return { hourly: monthly / HOURS_PER_MONTH, monthly };
}

export async function costSummary() {
  const now = Date.now();
  const { monthStart, nextMonth, prevMonth, today } = monthBounds(now);
  const completeDays = Math.round((today - monthStart) / DAY); // fully elapsed days this month
  const prevSameEnd = prevMonth + completeDays * DAY;

  const range = (from, to) => [{ $match: { date: { $gte: new Date(from), $lt: new Date(to) } } }, { $group: { _id: null, c: { $sum: '$cost' } } }];
  const [res] = await CostRecord.aggregate([
    { $match: { date: { $gte: new Date(prevMonth - 7 * DAY) } } },
    {
      $facet: {
        mtd: range(monthStart, nextMonth),
        mtdComplete: range(monthStart, today),
        lastMonth: range(prevMonth, monthStart),
        lastMonthSame: range(prevMonth, prevSameEnd),
        egress7d: [
          { $match: { service: 'Data Transfer', date: { $gte: new Date(today - 7 * DAY), $lt: new Date(today) } } },
          { $group: { _id: null, c: { $sum: '$cost' } } },
        ],
        byProvider: [
          { $match: { date: { $gte: new Date(monthStart) } } },
          { $group: { _id: '$provider', cost: { $sum: '$cost' } } },
          { $sort: { cost: -1 } },
        ],
      },
    },
  ]);
  const v = (k) => res[k][0]?.c || 0;
  const burn = await burnRate();
  // Month-end forecast = spend so far + (current burn rate + typical daily egress) × days left.
  const dailyRunRate = burn.hourly * 24 + v('egress7d') / 7;
  const daysLeft = (nextMonth - now) / DAY;
  const mtd = v('mtd');
  const lastSame = v('lastMonthSame');
  return {
    thisMonth: round(mtd),
    lastMonth: round(v('lastMonth')),
    lastMonthSamePeriod: round(lastSame),
    momPct: lastSame ? round(((v('mtdComplete') - lastSame) / lastSame) * 100, 1) : null,
    forecastMonthEnd: round(mtd + dailyRunRate * daysLeft),
    dailyRunRate: round(dailyRunRate),
    monthlyRunRate: round(burn.monthly),
    hourlyBurn: round(burn.hourly, 3),
    daysElapsed: completeDays,
    daysLeft: round(daysLeft, 1),
    byProvider: res.byProvider.map((p) => ({ provider: p._id, cost: round(p.cost) })),
  };
}

const GROUP_FIELD = { provider: '$provider', service: '$service', region: '$region', team: '$team', 'tag:team': '$team' };

// Trends cover complete days only (today is still being billed), ending yesterday.
export async function costTrend(days = 90, groupBy = 'provider') {
  const field = GROUP_FIELD[groupBy] || '$provider';
  const today = startOfUtcDay(Date.now());
  const from = today - days * DAY;
  const rows = await CostRecord.aggregate([
    { $match: { date: { $gte: new Date(from), $lt: new Date(today) } } },
    { $group: { _id: { d: '$date', k: field }, cost: { $sum: '$cost' } } },
  ]);

  const totals = new Map();
  for (const r of rows) totals.set(r._id.k, (totals.get(r._id.k) || 0) + r.cost);
  let keys = [...totals.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
  const top = keys.length > 7 ? new Set(keys.slice(0, 6)) : null;
  if (top) keys = [...keys.slice(0, 6), 'Other'];

  const byDate = new Map();
  for (let d = from; d < today; d += DAY) {
    byDate.set(d, Object.fromEntries([['date', new Date(d).toISOString().slice(0, 10)], ...keys.map((k) => [k, 0])]));
  }
  for (const r of rows) {
    const row = byDate.get(r._id.d.getTime());
    if (!row) continue;
    const k = top && !top.has(r._id.k) ? 'Other' : r._id.k;
    row[k] += r.cost;
  }
  const points = [...byDate.values()].map((row) => {
    let total = 0;
    for (const k of keys) {
      row[k] = round(row[k]);
      total += row[k];
    }
    return { ...row, total: round(total) };
  });
  return { groupBy, keys, points, totals: keys.map((k) => ({ key: k, cost: round(points.reduce((s, p) => s + p[k], 0)) })) };
}

export async function costBreakdown(by = 'provider', days = 30) {
  const field = GROUP_FIELD[by] || '$provider';
  // Compare the last N complete days with the N days before them.
  const today = startOfUtcDay(Date.now());
  const curFrom = today - days * DAY;
  const prevFrom = curFrom - days * DAY;
  const rows = await CostRecord.aggregate([
    { $match: { date: { $gte: new Date(prevFrom), $lt: new Date(today) } } },
    {
      $group: {
        _id: field,
        cost: { $sum: { $cond: [{ $gte: ['$date', new Date(curFrom)] }, '$cost', 0] } },
        prevCost: { $sum: { $cond: [{ $lt: ['$date', new Date(curFrom)] }, '$cost', 0] } },
        resources: { $addToSet: '$resource' },
      },
    },
    { $project: { cost: 1, prevCost: 1, resourceCount: { $size: '$resources' } } },
    { $sort: { cost: -1 } },
  ]);
  const total = rows.reduce((s, r) => s + r.cost, 0);
  const prevTotal = rows.reduce((s, r) => s + r.prevCost, 0);
  return {
    by,
    days,
    total: round(total),
    prevTotal: round(prevTotal),
    changePct: prevTotal ? round(((total - prevTotal) / prevTotal) * 100, 1) : null,
    rows: rows.map((r) => ({
      key: r._id || 'untagged',
      cost: round(r.cost),
      prevCost: round(r.prevCost),
      changePct: r.prevCost ? round(((r.cost - r.prevCost) / r.prevCost) * 100, 1) : null,
      share: total ? round((r.cost / total) * 100, 1) : 0,
      resourceCount: r.resourceCount,
    })),
  };
}

// Daily total spend for the last N complete days (sparklines).
export async function dailyTotals(days = 14) {
  const today = startOfUtcDay(Date.now());
  const rows = await CostRecord.aggregate([
    { $match: { date: { $gte: new Date(today - days * DAY), $lt: new Date(today) } } },
    { $group: { _id: '$date', cost: { $sum: '$cost' } } },
    { $sort: { _id: 1 } },
  ]);
  return rows.map((r) => ({ date: r._id.toISOString().slice(0, 10), value: round(r.cost) }));
}
