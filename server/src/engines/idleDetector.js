// Waste detection: idle VMs, unattached disks, unused IPs, old snapshots and stopped VMs
// that still carry storage. Saving = the full monthly cost that disappears.
import { MetricSample, Resource } from '../models/index.js';
import { DAY, percentile, round } from '../utils/stats.js';

const money = (v) => `$${v.toFixed(2)}`;
const isProd = (r) => r.tags?.env === 'prod';
const ageDays = (d, now) => (d ? Math.floor((now - new Date(d).getTime()) / DAY) : null);

function rec(resource, fields) {
  return {
    resource: resource._id,
    account: resource.account,
    provider: resource.provider,
    status: 'open',
    ...fields,
    monthlySaving: round(fields.monthlySaving),
  };
}

/**
 * @param settings { idleCpuThreshold, snapshotAgeDays, stoppedVmDays, minMonthlySaving }
 * @returns { recs, idleIds:Set<string> }
 */
export async function detectWaste(settings) {
  const now = Date.now();
  const recs = [];
  const resources = await Resource.find({ state: { $ne: 'terminated' } }).lean();

  // Disks / IPs hanging off each VM (they go away together with the VM).
  const children = new Map();
  for (const r of resources) {
    if (!r.attachedTo) continue;
    if (!children.has(r.attachedTo)) children.set(r.attachedTo, []);
    children.get(r.attachedTo).push(r);
  }
  const childCost = (vm) => (children.get(vm.resourceId) || []).reduce((s, c) => s + c.monthlyCost, 0);

  // ---- Idle VMs: p95 CPU below threshold for at least 14 days ----
  const running = resources.filter((r) => r.type === 'vm' && r.state === 'running');
  const since = new Date(now - 14 * DAY);
  const usage = await MetricSample.aggregate([
    { $match: { resource: { $in: running.map((r) => r._id) }, ts: { $gte: since } } },
    { $group: { _id: '$resource', cpu: { $push: '$cpu' }, first: { $min: '$ts' } } },
  ]).allowDiskUse(true);
  const usageBy = new Map(usage.map((u) => [String(u._id), u]));
  const idleIds = new Set();

  for (const vm of running) {
    const u = usageBy.get(String(vm._id));
    if (!u || now - u.first.getTime() < 13.5 * DAY) continue;
    const p95 = percentile(u.cpu, 95);
    if (p95 >= settings.idleCpuThreshold) continue;
    idleIds.add(String(vm._id));
    const extra = childCost(vm);
    const kids = children.get(vm.resourceId) || [];
    recs.push(rec(vm, {
      category: 'idle-vm',
      title: `Terminate idle VM ${vm.name}`,
      reason: `CPU p95 was ${p95.toFixed(1)}% over the last 14 days (threshold ${settings.idleCpuThreshold}%). This ${vm.instanceType} costs ${money(vm.monthlyCost)}/mo${kids.length ? ` plus ${money(extra)}/mo for ${kids.length} attached resource${kids.length > 1 ? 's' : ''}` : ''} while doing no meaningful work.`,
      currentConfig: { instanceType: vm.instanceType, vcpu: vm.vcpu, memoryGb: vm.memoryGb, state: vm.state, monthlyCost: round(vm.monthlyCost + extra) },
      proposedConfig: { action: 'Terminate instance', monthlyCost: 0 },
      action: { type: 'terminate' },
      evidence: { cpuP95: round(p95), windowDays: 14, samples: u.cpu.length },
      monthlySaving: vm.monthlyCost + extra,
      risk: isProd(vm) ? 'medium' : 'low',
      confidence: round(Math.min(0.97, 0.75 + 0.22 * (1 - p95 / settings.idleCpuThreshold))),
    }));
  }

  // ---- Stopped VMs still paying for disks ----
  for (const vm of resources.filter((r) => r.type === 'vm' && r.state === 'stopped')) {
    const days = ageDays(vm.stoppedAt, now);
    const kids = children.get(vm.resourceId) || [];
    if (days == null || days < settings.stoppedVmDays || !kids.length) continue;
    const cost = childCost(vm);
    const gb = kids.filter((k) => k.type === 'disk').reduce((s, k) => s + (k.sizeGb || 0), 0);
    recs.push(rec(vm, {
      category: 'stopped-vm',
      title: `Remove stopped VM ${vm.name} and its storage`,
      reason: `Stopped for ${days} days (threshold ${settings.stoppedVmDays}) but still billed ${money(cost)}/mo for ${gb} GB of attached storage${kids.some((k) => k.type === 'ip') ? ' and a reserved public IP' : ''}.`,
      currentConfig: { instanceType: vm.instanceType, state: 'stopped', attachedGb: gb, monthlyCost: round(cost) },
      proposedConfig: { action: 'Terminate instance and delete attached disks', monthlyCost: 0 },
      action: { type: 'terminate' },
      evidence: { stoppedDays: days, attached: kids.length },
      monthlySaving: cost,
      risk: isProd(vm) ? 'medium' : 'low',
      confidence: 0.86,
    }));
  }

  // ---- Unattached disks ----
  for (const d of resources.filter((r) => r.type === 'disk' && r.state === 'available')) {
    const age = ageDays(d.createdAt, now);
    recs.push(rec(d, {
      category: 'unattached-disk',
      title: `Delete unattached disk ${d.name}`,
      reason: `${d.sizeGb} GB volume is not attached to any instance${age != null ? ` (created ${age} days ago)` : ''}. It costs ${money(d.monthlyCost)}/mo for storage nobody reads.`,
      currentConfig: { sizeGb: d.sizeGb, state: 'unattached', monthlyCost: round(d.monthlyCost) },
      proposedConfig: { action: 'Delete volume', monthlyCost: 0 },
      action: { type: 'delete' },
      evidence: { ageDays: age },
      monthlySaving: d.monthlyCost,
      risk: isProd(d) ? 'medium' : 'low',
      confidence: 0.93,
    }));
  }

  // ---- Unused public IPs ----
  for (const ip of resources.filter((r) => r.type === 'ip' && r.state === 'available')) {
    recs.push(rec(ip, {
      category: 'unused-ip',
      title: `Release unused public IP ${ip.meta?.address || ip.name}`,
      reason: `Static IP ${ip.meta?.address || ''} is reserved but not associated with any instance or load balancer, costing ${money(ip.monthlyCost)}/mo.`,
      currentConfig: { address: ip.meta?.address, state: 'unassociated', monthlyCost: round(ip.monthlyCost) },
      proposedConfig: { action: 'Release address', monthlyCost: 0 },
      action: { type: 'delete' },
      evidence: {},
      monthlySaving: ip.monthlyCost,
      risk: 'low',
      confidence: 0.97,
    }));
  }

  // ---- Old snapshots ----
  for (const s of resources.filter((r) => r.type === 'snapshot')) {
    const age = ageDays(s.createdAt, now);
    if (age == null || age <= settings.snapshotAgeDays) continue;
    recs.push(rec(s, {
      category: 'old-snapshot',
      title: `Delete ${age}-day-old snapshot ${s.name}`,
      reason: `Snapshot is ${age} days old (retention threshold ${settings.snapshotAgeDays} days) and holds ${s.sizeGb} GB at ${money(s.monthlyCost)}/mo.`,
      currentConfig: { sizeGb: s.sizeGb, ageDays: age, monthlyCost: round(s.monthlyCost) },
      proposedConfig: { action: 'Delete snapshot', monthlyCost: 0 },
      action: { type: 'delete' },
      evidence: { ageDays: age },
      monthlySaving: s.monthlyCost,
      risk: 'low',
      confidence: 0.9,
    }));
  }

  // Waste is always reported; the minimum-saving filter applies to right-sizing only.
  return { recs: recs.filter((r) => r.monthlySaving > 0), idleIds };
}
