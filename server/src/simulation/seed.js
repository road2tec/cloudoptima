// npm run seed
// 1. Reset the database.  2. Create demo users and three cloud accounts.
// 3. Provision the simulated clouds.  4. Load everything through connector → normalizer.
// 5. Run forecasts + optimization engines.  6. Print a summary.
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { connectDB } from '../config/db.js';
import { AuditLog, CloudAccount, CostRecord, MetricSample, Recommendation, Resource, User } from '../models/index.js';
import { SimObject } from './cloudStore.js';
import { PROFILES } from './world.js';
import { newExternalId, provisionCloud } from './provisioner.js';
import { syncAccount } from '../services/syncService.js';
import { runAnalysis } from '../services/analysisService.js';
import { logger } from '../utils/logger.js';
import { DAY } from '../utils/stats.js';

const USERS = [
  { name: 'Aarav Mehta', email: 'admin@cloudoptima.io', password: 'Admin@123', role: 'admin', avatarColor: '#8B5CF6' },
  { name: 'Diya Kapoor', email: 'analyst@cloudoptima.io', password: 'Analyst@123', role: 'analyst', avatarColor: '#22D3EE' },
  { name: 'Rohan Iyer', email: 'approver@cloudoptima.io', password: 'Approver@123', role: 'approver', avatarColor: '#10B981' },
];

const ACCOUNTS = [
  { name: 'Production AWS', provider: 'aws', defaultRegion: 'ap-south-1', profile: 'aws-prod', seed: 1101 },
  { name: 'Analytics Azure', provider: 'azure', defaultRegion: 'centralindia', profile: 'azure-analytics', seed: 2202 },
  { name: 'ML Platform GCP', provider: 'gcp', defaultRegion: 'asia-south1', profile: 'gcp-ml', seed: 3303 },
];

const usd = (v) => `$${v.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

async function main() {
  const t0 = Date.now();
  await connectDB();
  logger.info('Dropping database…');
  await mongoose.connection.dropDatabase();
  await Promise.all([User, CloudAccount, Resource, MetricSample, CostRecord, Recommendation, AuditLog, SimObject].map((m) => m.syncIndexes()));

  const users = [];
  for (const u of USERS) {
    users.push(await User.create({ ...u, passwordHash: await bcrypt.hash(u.password, 10) }));
  }
  logger.success(`Created ${users.length} users`);

  const accounts = [];
  for (const def of ACCOUNTS) {
    const account = await CloudAccount.create({
      name: def.name,
      provider: def.provider,
      defaultRegion: def.defaultRegion,
      externalId: newExternalId(def.provider, def.name, def.seed),
      status: 'syncing',
      createdBy: users[0]._id,
      createdAt: new Date(Date.now() - 180 * DAY),
    });
    const n = await provisionCloud(account, PROFILES[def.profile], def.seed);
    logger.info(`Provisioned simulated ${def.provider.toUpperCase()} estate for "${def.name}" (${n} objects)`);
    accounts.push(account);
  }

  for (const account of accounts) {
    const t = Date.now();
    const r = await syncAccount(account, { quiet: true });
    logger.success(`Synced ${account.name}: ${r.resources} resources, ${r.metrics.toLocaleString()} metric samples, ${r.costs.toLocaleString()} cost records (${Date.now() - t} ms)`);
  }

  logger.info('Running forecasts and optimization engines…');
  const analysis = await runAnalysis({ settings: users[0].settings.toObject() });
  logger.success(`Forecasts: ${analysis.forecast.forecasts} (avg CPU MAPE ${analysis.forecast.avgMape}%, RMSE ${analysis.forecast.avgRmse}) · Recommendations: ${analysis.generated}`);

  await AuditLog.create({ user: users[0]._id, userName: users[0].name, action: 'system.seed', entityType: 'system', details: { accounts: accounts.length } });

  // ---- summary ----
  const monthAgo = new Date(Date.now() - 30 * DAY);
  const rows = [];
  for (const a of accounts) {
    const types = await Resource.aggregate([
      { $match: { account: a._id, state: { $ne: 'terminated' } } },
      { $group: { _id: '$type', n: { $sum: 1 }, monthly: { $sum: '$monthlyCost' } } },
    ]);
    const t = Object.fromEntries(types.map((x) => [x._id, x]));
    const [spend] = await CostRecord.aggregate([{ $match: { account: a._id, date: { $gte: monthAgo } } }, { $group: { _id: null, c: { $sum: '$cost' } } }]);
    const [waste] = await Recommendation.aggregate([{ $match: { account: a._id, status: 'open' } }, { $group: { _id: null, s: { $sum: '$monthlySaving' }, n: { $sum: 1 } } }]);
    rows.push({
      Provider: a.provider.toUpperCase(),
      Account: a.name,
      VMs: t.vm?.n || 0,
      Disks: t.disk?.n || 0,
      IPs: t.ip?.n || 0,
      Snapshots: t.snapshot?.n || 0,
      'Run-rate/mo': usd(types.reduce((s, x) => s + x.monthly, 0)),
      'Last 30d spend': usd(spend?.c || 0),
      'Waste found/mo': usd(waste?.s || 0),
      Recs: waste?.n || 0,
    });
  }
  const tot = (k) => rows.reduce((s, r) => s + Number(String(r[k]).replace(/[$,]/g, '')), 0);
  rows.push({
    Provider: 'ALL',
    Account: '—',
    VMs: tot('VMs'),
    Disks: tot('Disks'),
    IPs: tot('IPs'),
    Snapshots: tot('Snapshots'),
    'Run-rate/mo': usd(tot('Run-rate/mo')),
    'Last 30d spend': usd(tot('Last 30d spend')),
    'Waste found/mo': usd(tot('Waste found/mo')),
    Recs: tot('Recs'),
  });
  logger.raw('');
  logger.table(rows);
  logger.raw('');
  logger.table(analysis.summary.byCategory.map((c) => ({ Category: c.key, Findings: c.count, 'Saving/mo': usd(c.saving) })));
  logger.raw('');
  logger.success(`Seed complete in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  logger.raw('  admin@cloudoptima.io / Admin@123   ·   analyst@cloudoptima.io / Analyst@123   ·   approver@cloudoptima.io / Approver@123');
  await mongoose.disconnect();
}

main().catch(async (err) => {
  logger.error(err);
  await mongoose.disconnect();
  process.exit(1);
});
