// Right-sizing: find the cheapest size in the same family that keeps projected p95
// utilization under the 70 % ceiling (target band ≈ 60 %).
import { Forecast, MetricSample, Resource } from '../models/index.js';
import { familySizes, regionMultiplier } from '../simulation/catalog.js';
import { clamp, DAY, HOURS_PER_MONTH, percentile, round } from '../utils/stats.js';

export const TARGET_UTILIZATION = 60;
export const CEILING = 70;

export async function rightSize(settings, { skipIds = new Set() } = {}) {
  const now = Date.now();
  const vms = (await Resource.find({ type: 'vm', state: 'running' }).lean()).filter((v) => v.family && !skipIds.has(String(v._id)));
  const ids = vms.map((v) => v._id);

  const usage = await MetricSample.aggregate([
    { $match: { resource: { $in: ids }, ts: { $gte: new Date(now - 30 * DAY) } } },
    { $group: { _id: '$resource', cpu: { $push: '$cpu' }, mem: { $push: '$mem' } } },
  ]).allowDiskUse(true);
  const usageBy = new Map(usage.map((u) => [String(u._id), u]));

  const forecasts = await Forecast.find({ resource: { $in: ids } }).select('resource metric predictedPeak mape').lean();
  const fc = new Map(forecasts.map((f) => [`${f.resource}|${f.metric}`, f]));

  const recs = [];
  for (const vm of vms) {
    const u = usageBy.get(String(vm._id));
    if (!u || u.cpu.length < 7 * 24) continue;
    const cpuP95 = percentile(u.cpu, 95);
    const memP95 = percentile(u.mem.filter((m) => m != null), 95);
    const fCpu = fc.get(`${vm._id}|cpu`);
    const fMem = fc.get(`${vm._id}|mem`);
    // Use whichever is higher: what we saw, or what we expect over the next 14 days.
    const effCpu = Math.max(cpuP95, fCpu?.predictedPeak || 0);
    const effMem = Math.max(memP95, fMem?.predictedPeak || 0);

    const sizes = familySizes(vm.provider, vm.family);
    const curIdx = sizes.findIndex((s) => s.type === vm.instanceType);
    if (curIdx <= 0) continue;
    const cur = sizes[curIdx];

    const options = sizes
      .slice(0, curIdx)
      .map((s, idx) => ({ ...s, idx, projCpu: (effCpu * cur.vcpu) / s.vcpu, projMem: (effMem * cur.memoryGb) / s.memoryGb }))
      .filter((s) => s.projCpu <= CEILING && s.projMem <= CEILING)
      .sort((a, b) => a.price - b.price);
    const best = options[0];
    if (!best) continue;

    const mult = regionMultiplier(vm.provider, vm.region);
    const saving = (cur.price - best.price) * mult * HOURS_PER_MONTH;
    if (saving < settings.minMonthlySaving) continue;

    const steps = curIdx - best.idx;
    const prod = vm.tags?.env === 'prod';
    const risk = prod && steps > 2 ? 'high' : prod ? 'medium' : 'low';
    const headroom = 1 - Math.max(best.projCpu, best.projMem) / CEILING;
    const coverage = Math.min(1, u.cpu.length / (30 * 24));
    const mapePenalty = fCpu && fCpu.mape > 25 ? 0.1 : 0;
    const confidence = clamp((0.62 + 0.33 * headroom) * (0.8 + 0.2 * coverage) - mapePenalty, 0.4, 0.97);

    recs.push({
      resource: vm._id,
      account: vm.account,
      provider: vm.provider,
      status: 'open',
      category: 'rightsize',
      title: `Downsize ${vm.name} to ${best.type}`,
      reason:
        `CPU p95 was ${cpuP95.toFixed(1)}% and memory p95 ${memP95.toFixed(1)}% over 30 days` +
        `${fCpu ? ` (14-day forecast peak ${fCpu.predictedPeak.toFixed(1)}%)` : ''}. ` +
        `${vm.instanceType} → ${best.type} keeps projected p95 at ${best.projCpu.toFixed(0)}% CPU / ${best.projMem.toFixed(0)}% memory, under the ${CEILING}% ceiling.`,
      currentConfig: { instanceType: cur.type, vcpu: cur.vcpu, memoryGb: cur.memoryGb, hourlyPrice: round(cur.price * mult, 4), monthlyCost: round(cur.price * mult * HOURS_PER_MONTH) },
      proposedConfig: { instanceType: best.type, vcpu: best.vcpu, memoryGb: best.memoryGb, hourlyPrice: round(best.price * mult, 4), monthlyCost: round(best.price * mult * HOURS_PER_MONTH) },
      action: { type: 'resize', toInstanceType: best.type },
      evidence: { cpuP95: round(cpuP95), memP95: round(memP95), forecastPeakCpu: fCpu?.predictedPeak, forecastPeakMem: fMem?.predictedPeak, projectedCpu: round(best.projCpu), projectedMem: round(best.projMem), sizeSteps: steps, target: TARGET_UTILIZATION },
      monthlySaving: round(saving),
      risk,
      confidence: round(confidence),
    });
  }
  return recs;
}
