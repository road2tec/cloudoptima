import mongoose from 'mongoose';
import { z } from 'zod';
import { CloudAccount, Recommendation, Resource } from '../models/index.js';
import { CATEGORIES } from '../models/Recommendation.js';
import { getConnector } from '../connectors/index.js';
import { refreshAccountTotals, syncCosts, syncInventory } from '../services/syncService.js';
import { savingsSummary } from '../engines/savingsCalculator.js';
import { emit } from '../services/realtime.js';
import { ApiError, asyncHandler, ok } from '../utils/http.js';
import { audit } from '../utils/audit.js';

export const rejectSchema = z.object({ note: z.string().trim().min(3, 'Please add a short reason').max(500) });
export const approveSchema = z.object({ note: z.string().trim().max(500).optional() }).default({});
export const bulkSchema = z.object({ ids: z.array(z.string()).min(1).max(200) });
export const executeSchema = z.object({ dryRun: z.boolean().optional() }).default({});

const SORTS = {
  saving: { monthlySaving: -1 },
  confidence: { confidence: -1, monthlySaving: -1 },
  newest: { createdAt: -1 },
  risk: { riskOrder: 1, monthlySaving: -1 },
};
const POPULATE_RESOURCE = { path: 'resource', select: 'name type provider region instanceType state tags resourceId monthlyCost sizeGb' };

async function loadRec(id) {
  if (!mongoose.isValidObjectId(id)) throw new ApiError(400, 'Invalid recommendation id');
  const rec = await Recommendation.findById(id);
  if (!rec) throw new ApiError(404, 'Recommendation not found');
  return rec;
}

const populated = (id) => Recommendation.findById(id).populate(POPULATE_RESOURCE).populate('decidedBy', 'name').populate('executedBy', 'name').lean();

export const listRecommendations = asyncHandler(async (req, res) => {
  const q = req.query;
  const filter = {};
  const multi = (v) => String(v).split(',').filter(Boolean);
  if (q.category) filter.category = { $in: multi(q.category).filter((c) => CATEGORIES.includes(c)) };
  if (q.provider) filter.provider = { $in: multi(q.provider) };
  if (q.status) filter.status = { $in: multi(q.status) };
  if (q.risk) filter.risk = { $in: multi(q.risk) };
  if (q.resource && mongoose.isValidObjectId(q.resource)) filter.resource = q.resource;

  const sortKey = SORTS[q.sort] ? q.sort : 'saving';
  const pipeline = [
    { $match: { ...filter, ...(filter.resource ? { resource: new mongoose.Types.ObjectId(filter.resource) } : {}) } },
    { $addFields: { riskOrder: { $indexOfArray: [['high', 'medium', 'low'], '$risk'] } } },
    { $sort: SORTS[sortKey] },
    { $limit: Math.min(500, parseInt(q.limit, 10) || 500) },
  ];
  const ids = (await Recommendation.aggregate(pipeline)).map((r) => r._id);
  const docs = await Recommendation.find({ _id: { $in: ids } }).populate(POPULATE_RESOURCE).populate('decidedBy', 'name').populate('executedBy', 'name').lean();
  const order = new Map(ids.map((id, i) => [String(id), i]));
  docs.sort((a, b) => order.get(String(a._id)) - order.get(String(b._id)));

  ok(res, { items: docs, total: docs.length, summary: await savingsSummary() });
});

export const approve = asyncHandler(async (req, res) => {
  const rec = await loadRec(req.params.id);
  if (rec.status !== 'open') throw new ApiError(409, `Recommendation is already ${rec.status}`);
  Object.assign(rec, { status: 'approved', decidedBy: req.user._id, decidedAt: new Date(), note: req.body?.note });
  await rec.save();
  await audit(req, 'recommendation.approve', 'recommendation', rec._id, { title: rec.title, monthlySaving: rec.monthlySaving });
  emit('recommendations:updated', { id: rec._id, status: rec.status });
  ok(res, await populated(rec._id), 'Recommendation approved');
});

export const bulkApprove = asyncHandler(async (req, res) => {
  const recs = await Recommendation.find({ _id: { $in: req.body.ids }, status: 'open', risk: 'low' });
  const now = new Date();
  await Recommendation.updateMany({ _id: { $in: recs.map((r) => r._id) } }, { $set: { status: 'approved', decidedBy: req.user._id, decidedAt: now } });
  const total = recs.reduce((s, r) => s + r.monthlySaving, 0);
  await audit(req, 'recommendation.bulk-approve', 'recommendation', null, { count: recs.length, monthlySaving: total, ids: recs.map((r) => r._id) });
  emit('recommendations:updated', { bulk: true });
  ok(res, { approved: recs.length, skipped: req.body.ids.length - recs.length, monthlySaving: total }, `${recs.length} low-risk recommendation(s) approved`);
});

export const reject = asyncHandler(async (req, res) => {
  const rec = await loadRec(req.params.id);
  if (!['open', 'approved'].includes(rec.status)) throw new ApiError(409, `Recommendation is already ${rec.status}`);
  Object.assign(rec, { status: 'rejected', decidedBy: req.user._id, decidedAt: new Date(), note: req.body.note });
  await rec.save();
  await audit(req, 'recommendation.reject', 'recommendation', rec._id, { title: rec.title, note: req.body.note });
  emit('recommendations:updated', { id: rec._id, status: rec.status });
  ok(res, await populated(rec._id), 'Recommendation rejected');
});

/**
 * POST /recommendations/:id/simulate-execute  { dryRun?: boolean }
 * dryRun → validates the plan only. Otherwise the connector applies the action to the
 * simulated cloud, then the inventory is re-pulled through the normalizer.
 */
export const simulateExecute = asyncHandler(async (req, res) => {
  const rec = await loadRec(req.params.id);
  if (rec.status !== 'approved') throw new ApiError(409, 'Only approved recommendations can be executed');
  const resource = await Resource.findById(rec.resource);
  if (!resource || resource.state === 'terminated') throw new ApiError(409, 'Target resource no longer exists');
  const account = await CloudAccount.findById(resource.account);
  if (!account) throw new ApiError(409, 'Cloud account is no longer connected');
  if (rec.action?.type === 'resize' && resource.instanceType !== rec.currentConfig?.instanceType) {
    throw new ApiError(409, `Resource is now ${resource.instanceType}; re-run analysis before executing`);
  }

  const verb = { resize: `Resize ${resource.instanceType} → ${rec.action?.toInstanceType}`, terminate: 'Terminate instance', delete: `Delete ${resource.type}` }[rec.action?.type];
  const plan = {
    resource: { id: resource._id, name: resource.name, nativeId: resource.nativeId, provider: resource.provider },
    action: rec.action,
    description: verb,
    expectedMonthlySaving: rec.monthlySaving,
  };
  if (req.body?.dryRun) {
    await audit(req, 'recommendation.dry-run', 'recommendation', rec._id, plan);
    return ok(res, { dryRun: true, plan }, 'Dry run passed');
  }

  const connector = getConnector(account);
  const result = await connector.applyAction(resource.nativeId, rec.action);
  // Pull the changed state back through connector → normalizer so the platform stays truthful.
  await syncInventory(account, connector);
  await syncCosts(account, connector);
  await refreshAccountTotals(account._id);

  Object.assign(rec, { status: 'executed', executedBy: req.user._id, executedAt: new Date() });
  await rec.save();
  const updated = await Resource.findById(resource._id).lean();
  await audit(req, 'recommendation.execute', 'recommendation', rec._id, { title: rec.title, monthlySaving: rec.monthlySaving, result });
  emit('recommendations:updated', { id: rec._id, status: 'executed' });
  ok(res, { recommendation: await populated(rec._id), resource: updated, result }, 'Change applied and verified');
});
