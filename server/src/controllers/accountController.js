import { z } from 'zod';
import { CloudAccount, CostRecord, Forecast, MetricSample, Recommendation, Resource } from '../models/index.js';
import { CATALOG } from '../simulation/catalog.js';
import { destroyCloud, newExternalId, provisionGeneric } from '../simulation/provisioner.js';
import { syncAccount } from '../services/syncService.js';
import { runAnalysis } from '../services/analysisService.js';
import { ApiError, asyncHandler, ok } from '../utils/http.js';
import { audit } from '../utils/audit.js';
import { logger } from '../utils/logger.js';
import { round } from '../utils/stats.js';

const SYNC_MIN_MS = 2500; // keep the "syncing" state on screen long enough to be seen

export const connectSchema = z
  .object({
    name: z.string().trim().min(3, 'Name is too short').max(50),
    provider: z.enum(['aws', 'azure', 'gcp']),
    region: z.string(),
  })
  .refine((v) => CATALOG[v.provider].regions.some((r) => r.code === v.region), { message: 'Unknown region for provider', path: ['region'] });

export const catalog = asyncHandler(async (_req, res) => {
  ok(res, Object.fromEntries(Object.entries(CATALOG).map(([p, c]) => [p, { label: c.label, regions: c.regions.map(({ code, name }) => ({ code, name })) }])));
});

export const listAccounts = asyncHandler(async (_req, res) => {
  const accounts = await CloudAccount.find().sort({ createdAt: 1 }).lean();
  const [types, recs, spend] = await Promise.all([
    Resource.aggregate([{ $match: { state: { $ne: 'terminated' } } }, { $group: { _id: { a: '$account', t: '$type' }, n: { $sum: 1 } } }]),
    Recommendation.aggregate([{ $match: { status: { $in: ['open', 'approved'] } } }, { $group: { _id: '$account', n: { $sum: 1 }, saving: { $sum: '$monthlySaving' } } }]),
    CostRecord.aggregate([
      { $match: { date: { $gte: new Date(Date.now() - 30 * 86400000) } } },
      { $group: { _id: '$account', cost: { $sum: '$cost' } } },
    ]),
  ]);
  const items = accounts.map((a) => {
    const id = String(a._id);
    const byType = Object.fromEntries(types.filter((t) => String(t._id.a) === id).map((t) => [t._id.t, t.n]));
    const r = recs.find((x) => String(x._id) === id);
    const s = spend.find((x) => String(x._id) === id);
    return { ...a, byType, openRecommendations: r?.n || 0, potentialSaving: round(r?.saving || 0), last30dSpend: round(s?.cost || 0) };
  });
  ok(res, items);
});

// Run sync (and optionally a fresh analysis) without blocking the HTTP response.
function syncInBackground(account, user, { analyze = false } = {}) {
  syncAccount(account, { minDurationMs: SYNC_MIN_MS })
    .then(() => (analyze ? runAnalysis({ settings: user.settings?.toObject?.() || {} }) : null))
    .catch((err) => logger.error(`Background sync failed: ${err.message}`));
}

export const connectAccount = asyncHandler(async (req, res) => {
  const { name, provider, region } = req.body;
  const seed = Math.floor(Math.random() * 2 ** 30);
  const account = await CloudAccount.create({
    name,
    provider,
    defaultRegion: region,
    externalId: newExternalId(provider, name, seed),
    status: 'syncing',
    createdBy: req.user._id,
  });
  await provisionGeneric(account, seed);
  await audit(req, 'account.connect', 'account', account._id, { name, provider, region });
  syncInBackground(account, req.user, { analyze: true });
  ok(res, account, 'Account connected — initial sync started', 201);
});

export const syncNow = asyncHandler(async (req, res) => {
  const account = await CloudAccount.findById(req.params.id);
  if (!account) throw new ApiError(404, 'Account not found');
  if (account.status === 'syncing') throw new ApiError(409, 'A sync is already running for this account');
  await CloudAccount.updateOne({ _id: account._id }, { $set: { status: 'syncing' } });
  await audit(req, 'account.sync', 'account', account._id, { name: account.name });
  syncInBackground(account, req.user);
  ok(res, { ...account.toObject(), status: 'syncing' }, 'Sync started', 202);
});

export const deleteAccount = asyncHandler(async (req, res) => {
  const account = await CloudAccount.findById(req.params.id);
  if (!account) throw new ApiError(404, 'Account not found');
  const resourceIds = await Resource.find({ account: account._id }).distinct('_id');
  await Promise.all([
    MetricSample.deleteMany({ resource: { $in: resourceIds } }),
    CostRecord.deleteMany({ account: account._id }),
    Forecast.deleteMany({ resource: { $in: resourceIds } }),
    Recommendation.deleteMany({ account: account._id }),
    Resource.deleteMany({ account: account._id }),
    destroyCloud(account._id),
  ]);
  await account.deleteOne();
  await audit(req, 'account.delete', 'account', account._id, { name: account.name, provider: account.provider });
  ok(res, { id: account._id }, 'Account disconnected');
});
