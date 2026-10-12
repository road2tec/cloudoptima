// Provider-neutral simulation maths shared by the three provider simulators:
// metric series, daily billing lines and state mutations.
import { CATALOG, getInstance, instancePrice, regionMultiplier } from './catalog.js';
import { utilizationAt } from './patterns.js';
import { DAY, HOUR, HOURS_PER_MONTH, dayKey, startOfUtcDay } from '../utils/stats.js';
import { findObject, SimObject, updateObject } from './cloudStore.js';

const t = (d) => (d ? new Date(d).getTime() : null);

export function isRunningAt(obj, ts) {
  const end = Math.min(t(obj.stoppedAt) ?? Infinity, t(obj.deletedAt) ?? Infinity);
  return ts >= t(obj.createdAt) && ts < end;
}

// Hours of overlap between [a1, a2) and [b1, b2).
const overlapHours = (a1, a2, b1, b2) => Math.max(0, Math.min(a2, b2) - Math.max(a1, b1)) / HOUR;

/**
 * Utilization series for a VM between `from` and `to` with a given period.
 * Each point averages 4 sub-samples and keeps their maximum (like CloudWatch Average/Maximum).
 */
export function metricSeries(obj, from, to, periodMs) {
  const out = [];
  const start = Math.ceil(from / periodMs) * periodMs;
  const subs = periodMs >= HOUR ? 4 : 1;
  for (let ts = start; ts <= to; ts += periodMs) {
    if (!isRunningAt(obj, ts)) continue;
    let cpuSum = 0, cpuMax = 0, memSum = 0, memMax = 0, netIn = 0, netOut = 0;
    for (let k = 0; k < subs; k++) {
      const u = utilizationAt(obj, ts + (k * periodMs) / subs);
      cpuSum += u.cpu; memSum += u.mem; netIn += u.netIn; netOut += u.netOut;
      cpuMax = Math.max(cpuMax, u.cpu); memMax = Math.max(memMax, u.mem);
    }
    const scale = periodMs / HOUR; // network values are MB per hour
    out.push({
      ts,
      cpuAvg: cpuSum / subs,
      cpuMax,
      memAvg: memSum / subs,
      memMax,
      netInMb: (netIn / subs) * scale,
      netOutMb: (netOut / subs) * scale,
    });
  }
  return out;
}

/**
 * Neutral daily billing lines for one cloud object between two days (inclusive).
 * category: compute | storage | snapshot | ip | egress
 */
export function dailyCostLines(obj, fromMs, toMs, nowMs = Date.now()) {
  const price = CATALOG[obj.provider];
  const mult = regionMultiplier(obj.provider, obj.region);
  const lines = [];
  const created = t(obj.createdAt);
  const deleted = t(obj.deletedAt) ?? Infinity;

  for (let day = startOfUtcDay(fromMs); day <= toMs; day += DAY) {
    const dayEnd = Math.min(day + DAY, nowMs);
    if (dayEnd <= day) break;
    const date = dayKey(day);
    const activeHours = overlapHours(day, dayEnd, created, deleted);
    if (activeHours <= 0) continue;

    if (obj.kind === 'vm') {
      const runEnd = Math.min(t(obj.stoppedAt) ?? Infinity, deleted);
      const resized = t(obj.resizedAt);
      // Split the day around a resize so each size is billed for its own hours.
      const segments = resized && obj.prevInstanceType
        ? [[created, resized, obj.prevInstanceType], [resized, runEnd, obj.instanceType]]
        : [[created, runEnd, obj.instanceType]];
      let runningHours = 0;
      for (const [s, e, type] of segments) {
        const hours = overlapHours(day, dayEnd, s, e);
        if (hours <= 0) continue;
        runningHours += hours;
        lines.push({ date, category: 'compute', instanceType: type, quantity: hours, unit: 'Hrs', cost: hours * instancePrice(obj.provider, type, obj.region) });
      }
      if (runningHours > 0 && obj.egressGbPerHour > 0) {
        const gb = runningHours * obj.egressGbPerHour;
        lines.push({ date, category: 'egress', quantity: gb, unit: 'GB', cost: gb * price.egressGb });
      }
      for (const spike of obj.costSpikes || []) {
        if (spike.date === date) {
          lines.push({ date, category: 'egress', quantity: spike.amount / price.egressGb, unit: 'GB', cost: spike.amount });
        }
      }
    } else if (obj.kind === 'disk') {
      lines.push({ date, category: 'storage', quantity: (obj.sizeGb * activeHours) / HOURS_PER_MONTH, unit: 'GB-Mo', cost: (obj.sizeGb * price.storageGbMonth * mult * activeHours) / HOURS_PER_MONTH });
    } else if (obj.kind === 'snapshot') {
      lines.push({ date, category: 'snapshot', quantity: (obj.sizeGb * activeHours) / HOURS_PER_MONTH, unit: 'GB-Mo', cost: (obj.sizeGb * price.snapshotGbMonth * mult * activeHours) / HOURS_PER_MONTH });
    } else if (obj.kind === 'ip') {
      const rate = obj.attachedTo ? price.ipHour : price.ipIdleHour || price.ipHour;
      lines.push({ date, category: 'ip', quantity: activeHours, unit: 'Hrs', cost: activeHours * rate });
    }
  }
  return lines;
}

// ---------- mutations used by applyAction in every provider simulator ----------

export async function resizeObject(accountId, nativeId, toType) {
  const obj = await findObject(accountId, nativeId);
  if (!obj || obj.kind !== 'vm' || obj.deletedAt) throw new Error(`Instance ${nativeId} not found`);
  const from = getInstance(obj.provider, obj.instanceType);
  const to = getInstance(obj.provider, toType);
  if (!to) throw new Error(`Unknown instance type ${toType}`);
  // The same workload on a smaller box shows proportionally higher utilization.
  await updateObject(obj._id, {
    prevInstanceType: obj.instanceType,
    instanceType: toType,
    resizedAt: new Date(),
    cpuScale: (obj.cpuScale || 1) * (from.vcpu / to.vcpu),
    memScale: (obj.memScale || 1) * (from.memoryGb / to.memoryGb),
  });
  return { from: obj.instanceType, to: toType };
}

export async function deleteObject(accountId, nativeId, { cascade = false } = {}) {
  const obj = await findObject(accountId, nativeId);
  if (!obj || obj.deletedAt) throw new Error(`Resource ${nativeId} not found`);
  const now = new Date();
  await updateObject(obj._id, { deletedAt: now, state: 'terminated' });
  let cascaded = 0;
  if (cascade && obj.kind === 'vm') {
    // Root volumes are deleted on termination and attached public IPs are released.
    const res = await SimObject.updateMany({ account: accountId, attachedTo: nativeId, deletedAt: null }, { $set: { deletedAt: now, state: 'terminated' } });
    cascaded = res.modifiedCount;
  }
  return { deleted: nativeId, cascaded };
}
