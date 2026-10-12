// Savings roll-ups: potential (open + approved) vs realized (executed).
import { Recommendation } from '../models/index.js';
import { round } from '../utils/stats.js';

export async function savingsSummary(match = {}) {
  const [res] = await Recommendation.aggregate([
    { $match: match },
    {
      $facet: {
        byStatus: [{ $group: { _id: '$status', count: { $sum: 1 }, saving: { $sum: '$monthlySaving' } } }],
        byCategory: [
          { $match: { status: { $in: ['open', 'approved'] } } },
          { $group: { _id: '$category', count: { $sum: 1 }, saving: { $sum: '$monthlySaving' } } },
          { $sort: { saving: -1 } },
        ],
        byProvider: [
          { $match: { status: { $in: ['open', 'approved'] } } },
          { $group: { _id: '$provider', count: { $sum: 1 }, saving: { $sum: '$monthlySaving' } } },
          { $sort: { saving: -1 } },
        ],
        byRisk: [
          { $match: { status: { $in: ['open', 'approved'] } } },
          { $group: { _id: '$risk', count: { $sum: 1 }, saving: { $sum: '$monthlySaving' } } },
        ],
      },
    },
  ]);
  const status = Object.fromEntries(res.byStatus.map((s) => [s._id, { count: s.count, saving: round(s.saving) }]));
  const get = (k) => status[k] || { count: 0, saving: 0 };
  const map = (rows) => rows.map((r) => ({ key: r._id, count: r.count, saving: round(r.saving) }));
  return {
    potential: round(get('open').saving + get('approved').saving),
    realized: get('executed').saving,
    rejected: get('rejected').saving,
    counts: { open: get('open').count, approved: get('approved').count, executed: get('executed').count, rejected: get('rejected').count },
    byCategory: map(res.byCategory),
    byProvider: map(res.byProvider),
    byRisk: map(res.byRisk),
  };
}
