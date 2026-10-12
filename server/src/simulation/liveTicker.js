// Live simulator: every 60 s each running VM gets a fresh metric point (pulled through its
// connector and normalized like any other data) and the dashboard receives a `metrics:tick`.
import cron from 'node-cron';
import { CloudAccount, MetricSample, Resource } from '../models/index.js';
import { getConnector } from '../connectors/index.js';
import { normalizeMetrics } from '../normalization/normalizer.js';
import { burnRate } from '../services/costService.js';
import { emit } from '../services/realtime.js';
import { logger } from '../utils/logger.js';
import { round } from '../utils/stats.js';

let running = false;

export async function tick() {
  if (running) return null; // never overlap ticks
  running = true;
  try {
    const now = Date.now();
    const accounts = await CloudAccount.find({ status: { $ne: 'error' } });
    const docs = [];
    for (const account of accounts) {
      const vms = await Resource.find({ account: account._id, type: 'vm', state: 'running' }).select('_id nativeId memoryGb').lean();
      if (!vms.length) continue;
      const connector = getConnector(account);
      const raw = await connector.getMetrics(vms.map((v) => v.nativeId), now - 60_000, now, 60);
      const series = normalizeMetrics(account.provider, raw, Object.fromEntries(vms.map((v) => [v.nativeId, { memoryGb: v.memoryGb }])));
      for (const vm of vms) {
        const p = series[vm.nativeId]?.at(-1);
        if (p) docs.push({ resource: vm._id, ...p });
      }
    }
    if (docs.length) await MetricSample.insertMany(docs, { ordered: false });
    const burn = await burnRate();
    const payload = {
      ts: new Date(now),
      avgCpu: round(docs.reduce((s, d) => s + d.cpu, 0) / (docs.length || 1), 1),
      avgMem: round(docs.reduce((s, d) => s + (d.mem || 0), 0) / (docs.length || 1), 1),
      burnRate: round(burn.hourly, 2),
      running: docs.length,
    };
    emit('metrics:tick', payload);
    return payload;
  } catch (err) {
    logger.error(`Live ticker failed: ${err.message}`);
    return null;
  } finally {
    running = false;
  }
}

export function startLiveTicker() {
  cron.schedule('* * * * *', tick);
  logger.info('Live simulator ticking every 60 s');
}
