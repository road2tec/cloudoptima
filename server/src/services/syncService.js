// Sync pipeline: connector (provider-shaped data) → normalizer (unified schema) → MongoDB.
import { CloudAccount, CostRecord, MetricSample, Resource } from '../models/index.js';
import { getConnector } from '../connectors/index.js';
import { normalizeCosts, normalizeInventory, normalizeMetrics } from '../normalization/normalizer.js';
import { emit } from './realtime.js';
import { logger } from '../utils/logger.js';
import { DAY, HOUR, startOfUtcDay } from '../utils/stats.js';

const BATCH = 5000;
const METRIC_WINDOW_DAYS = 30;
const COST_WINDOW_DAYS = 90; // complete days, plus today so far

async function insertInBatches(Model, docs) {
  for (let i = 0; i < docs.length; i += BATCH) {
    await Model.insertMany(docs.slice(i, i + BATCH), { ordered: false });
  }
  return docs.length;
}

/** Pull the inventory and upsert unified Resource documents. */
export async function syncInventory(account, connector = getConnector(account)) {
  const listing = await connector.listResources();
  const docs = normalizeInventory(account.provider, listing, account);
  const now = new Date();
  if (docs.length) {
    await Resource.bulkWrite(
      docs.map((d) => ({
        updateOne: {
          filter: { resourceId: d.resourceId },
          update: { $set: { ...d, lastSeenAt: now, terminatedAt: d.state === 'terminated' ? d.stoppedAt || now : null } },
          upsert: true,
        },
      })),
      { ordered: false }
    );
  }
  // Anything we knew about that the provider no longer returns has been deleted.
  const gone = await Resource.updateMany(
    { account: account._id, resourceId: { $nin: docs.map((d) => d.resourceId) }, state: { $ne: 'terminated' } },
    { $set: { state: 'terminated', terminatedAt: now, monthlyCost: 0 } }
  );
  return { resources: docs.length, removed: gone.modifiedCount };
}

/** Back-fill hourly metrics from the last stored sample (max 30 days) up to now. */
export async function syncMetrics(account, connector = getConnector(account)) {
  const now = Date.now();
  const vms = await Resource.find({ account: account._id, type: 'vm', state: { $in: ['running', 'stopped'] } })
    .select('_id nativeId memoryGb')
    .lean();
  if (!vms.length) return 0;

  const lastTs = await MetricSample.aggregate([
    { $match: { resource: { $in: vms.map((v) => v._id) } } },
    { $group: { _id: '$resource', last: { $max: '$ts' } } },
  ]);
  const lastBy = new Map(lastTs.map((x) => [String(x._id), x.last.getTime()]));
  const floor = now - METRIC_WINDOW_DAYS * DAY;

  // Group VMs that need the same window so each connector call fetches many at once.
  const groups = new Map();
  for (const vm of vms) {
    const last = lastBy.get(String(vm._id));
    const from = last ? Math.max(last + 1, floor) : floor;
    if (now - from < HOUR) continue;
    const key = Math.floor(from / HOUR) * HOUR;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(vm);
  }

  const docs = [];
  for (const [from, list] of groups) {
    for (let i = 0; i < list.length; i += 25) {
      const chunk = list.slice(i, i + 25);
      const raw = await connector.getMetrics(chunk.map((v) => v.nativeId), from + 1, now, 3600);
      const ctx = Object.fromEntries(chunk.map((v) => [v.nativeId, { memoryGb: v.memoryGb }]));
      const series = normalizeMetrics(account.provider, raw, ctx);
      for (const vm of chunk) {
        for (const p of series[vm.nativeId] || []) docs.push({ resource: vm._id, ...p });
      }
    }
  }
  return insertInBatches(MetricSample, docs);
}

/** Re-pull daily costs from the last stored day (or 90 days back) and replace that window. */
export async function syncCosts(account, connector = getConnector(account)) {
  const now = Date.now();
  const lastRec = await CostRecord.findOne({ account: account._id }).sort({ date: -1 }).select('date').lean();
  const from = lastRec ? lastRec.date.getTime() - 2 * DAY : startOfUtcDay(now - COST_WINDOW_DAYS * DAY);

  const raw = await connector.getCosts(from, now);
  const rows = normalizeCosts(account.provider, raw);

  const resources = await Resource.find({ account: account._id }).select('_id nativeId region tags').lean();
  const byNative = new Map(resources.map((r) => [r.nativeId.toLowerCase(), r]));

  // Collapse multiple line items (e.g. GCP core + ram SKUs) into one record per resource/day/service.
  const merged = new Map();
  for (const row of rows) {
    const res = byNative.get(row.nativeKey);
    if (!res) continue;
    const key = `${res._id}|${row.date}|${row.service}`;
    const rec = merged.get(key);
    if (rec) rec.cost += row.cost;
    else {
      merged.set(key, {
        resource: res._id,
        account: account._id,
        provider: account.provider,
        service: row.service,
        region: row.region || res.region,
        team: res.tags?.team || 'untagged',
        date: new Date(`${row.date}T00:00:00Z`),
        cost: row.cost,
      });
    }
  }

  await CostRecord.deleteMany({ account: account._id, date: { $gte: new Date(startOfUtcDay(from)) } });
  return insertInBatches(CostRecord, [...merged.values()].map((r) => ({ ...r, cost: Math.round(r.cost * 10000) / 10000 })));
}

export async function refreshAccountTotals(accountId) {
  const [agg] = await Resource.aggregate([
    { $match: { account: accountId, state: { $ne: 'terminated' } } },
    { $group: { _id: null, count: { $sum: 1 }, monthly: { $sum: '$monthlyCost' } } },
  ]);
  await CloudAccount.updateOne({ _id: accountId }, { $set: { resourceCount: agg?.count || 0, monthlyCost: agg?.monthly || 0 } });
}

/**
 * Full sync of one account. `quiet` skips the "syncing" status (used by background catch-up).
 * `minDurationMs` keeps the syncing state visible long enough for the UI animation.
 */
export async function syncAccount(accountOrId, { quiet = false, minDurationMs = 0 } = {}) {
  const account = accountOrId._id ? accountOrId : await CloudAccount.findById(accountOrId);
  if (!account) throw new Error('Account not found');
  const started = Date.now();
  if (!quiet) {
    await CloudAccount.updateOne({ _id: account._id }, { $set: { status: 'syncing', lastError: null } });
    emit('account:sync', { accountId: account._id, status: 'syncing' });
  }
  try {
    const connector = getConnector(account);
    const inventory = await syncInventory(account, connector);
    const metrics = await syncMetrics(account, connector);
    const costs = await syncCosts(account, connector);
    await refreshAccountTotals(account._id);
    const elapsed = Date.now() - started;
    if (elapsed < minDurationMs) await new Promise((r) => setTimeout(r, minDurationMs - elapsed));
    await CloudAccount.updateOne(
      { _id: account._id },
      { $set: { status: 'connected', lastSyncedAt: new Date(), lastSyncDurationMs: Date.now() - started } }
    );
    const result = { ...inventory, metrics, costs, durationMs: Date.now() - started };
    emit('account:sync', { accountId: account._id, status: 'connected', result });
    return result;
  } catch (err) {
    logger.error(`Sync failed for ${account.name}: ${err.message}`);
    await CloudAccount.updateOne({ _id: account._id }, { $set: { status: 'error', lastError: err.message } });
    emit('account:sync', { accountId: account._id, status: 'error', error: err.message });
    throw err;
  }
}

export async function syncAll(opts = {}) {
  const accounts = await CloudAccount.find();
  const results = [];
  for (const a of accounts) results.push({ account: a.name, ...(await syncAccount(a, opts)) });
  return results;
}
