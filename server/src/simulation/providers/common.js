// Helpers shared by the provider simulators.
import { SimObject } from '../cloudStore.js';
import { DAY } from '../../utils/stats.js';

// Convert a neutral world spec into a stored cloud object with native IDs.
export function toSimDoc(spec, account, nativeId, ids, ctx = {}) {
  return {
    account: account._id,
    provider: account.provider,
    kind: spec.kind,
    nativeId,
    name: spec.name,
    region: spec.region,
    zone: spec.zone,
    instanceType: spec.instanceType,
    sizeGb: spec.sizeGb,
    state: spec.state,
    tags: spec.tags || {},
    createdAt: spec.createdAt,
    stoppedAt: spec.stoppedAt || null,
    deletedAt: null,
    attachedTo: spec.attachedToKey ? ids[spec.attachedToKey] : null,
    sourceDisk: spec.sourceDiskKey ? ids[spec.sourceDiskKey] : null,
    address: spec.address,
    privateIp: spec.privateIp,
    pattern: spec.pattern,
    params: spec.params,
    seed: spec.seed,
    egressGbPerHour: spec.egressGbPerHour || 0,
    costSpikes: spec.costSpikes || [],
    ctx,
  };
}

export async function insertSimDocs(docs) {
  await SimObject.insertMany(docs, { ordered: false });
  return docs.length;
}

// Objects that could have produced charges in the [from, to] window (deleted ones included).
export function billableObjects(accountId, from) {
  return SimObject.find({ account: accountId, $or: [{ deletedAt: null }, { deletedAt: { $gte: new Date(from - DAY) } }] }).lean();
}

// Objects visible to "list" APIs; recently terminated VMs stay visible for a day (like EC2).
export function visibleObjects(accountId, kind, { keepTerminatedFor = 0 } = {}) {
  const or = [{ deletedAt: null }];
  if (keepTerminatedFor) or.push({ deletedAt: { $gte: new Date(Date.now() - keepTerminatedFor) } });
  return SimObject.find({ account: accountId, kind, $or: or }).lean();
}

export const iso = (d) => (d ? new Date(d).toISOString() : undefined);
export const fakeRequestId = () => `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}`;
