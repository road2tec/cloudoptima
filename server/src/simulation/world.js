// Builds the provider-neutral description of a simulated cloud estate ("world"):
// VMs with workload patterns, their disks and IPs, snapshots and the planted waste.
// Provider simulators turn these specs into native IDs and native API shapes.
import { fakerEN_IN as faker } from '@faker-js/faker';
import { familySizes, CATALOG } from './catalog.js';
import { makeParams } from './patterns.js';
import { makeRandom, mulberry32 } from '../utils/rng.js';
import { DAY, dayKey } from '../utils/stats.js';

// Workload roles per provider: name prefix, size class and typical patterns.
const ROLES = {
  aws: [
    { prefix: 'api-gateway', cls: 'general', pats: ['diurnal', 'steady'], ip: 0.8 },
    { prefix: 'auth-service', cls: 'burst', pats: ['diurnal', 'steady'] },
    { prefix: 'payments-api', cls: 'compute', pats: ['diurnal', 'weekly'] },
    { prefix: 'order-service', cls: 'general', pats: ['diurnal', 'growing'] },
    { prefix: 'web-frontend', cls: 'burst', pats: ['diurnal'], ip: 0.7 },
    { prefix: 'redis-cache', cls: 'memory', pats: ['steady'] },
    { prefix: 'kafka-broker', cls: 'general', pats: ['steady', 'growing'] },
    { prefix: 'reporting-db-replica', cls: 'memory', pats: ['weekly', 'steady'] },
    { prefix: 'batch-worker', cls: 'compute', pats: ['spiky', 'weekly'] },
    { prefix: 'search-indexer', cls: 'memory', pats: ['spiky', 'steady'] },
    { prefix: 'notification-svc', cls: 'burst', pats: ['diurnal', 'spiky'] },
    { prefix: 'bastion-host', cls: 'burst', pats: ['steady'], ip: 0.9 },
  ],
  azure: [
    { prefix: 'spark-worker', cls: 'compute', pats: ['spiky', 'weekly'] },
    { prefix: 'etl-runner', cls: 'general', pats: ['weekly', 'spiky'] },
    { prefix: 'powerbi-gateway', cls: 'general', pats: ['diurnal'], ip: 0.6 },
    { prefix: 'synapse-proxy', cls: 'general', pats: ['diurnal', 'steady'] },
    { prefix: 'airflow-scheduler', cls: 'burst', pats: ['steady'] },
    { prefix: 'data-lake-ingest', cls: 'general', pats: ['growing', 'steady'] },
    { prefix: 'reporting-db-replica', cls: 'memory', pats: ['weekly', 'steady'] },
    { prefix: 'analytics-api', cls: 'general', pats: ['diurnal'], ip: 0.7 },
    { prefix: 'tableau-server', cls: 'memory', pats: ['diurnal', 'weekly'], ip: 0.4 },
    { prefix: 'jupyter-analytics', cls: 'burst', pats: ['diurnal', 'spiky'] },
  ],
  gcp: [
    { prefix: 'ml-train-worker', cls: 'compute', pats: ['spiky', 'growing'] },
    { prefix: 'inference-api', cls: 'general', pats: ['diurnal', 'growing'], ip: 0.8 },
    { prefix: 'feature-store', cls: 'memory', pats: ['steady'] },
    { prefix: 'jupyter-hub', cls: 'general', pats: ['diurnal', 'weekly'], ip: 0.5 },
    { prefix: 'vector-db', cls: 'memory', pats: ['steady', 'growing'] },
    { prefix: 'model-registry', cls: 'burst', pats: ['steady'] },
    { prefix: 'label-studio', cls: 'burst', pats: ['diurnal', 'weekly'] },
    { prefix: 'embedding-batch', cls: 'compute', pats: ['spiky'] },
    { prefix: 'mlflow-tracking', cls: 'burst', pats: ['steady', 'diurnal'] },
    { prefix: 'ray-head', cls: 'general', pats: ['spiky', 'steady'] },
  ],
};

const CLASS_FAMILY = {
  aws: { burst: 't3', general: 'm5', compute: 'c5', memory: 'r5' },
  azure: { burst: 'B', general: 'Dsv5', compute: 'Fsv2', memory: 'Esv5' },
  gcp: { burst: 'e2', general: 'n2-standard', compute: 'c2', memory: 'n2-highmem' },
};

const ORPHAN_DISK_NAMES = ['pvc-data', 'vol-backup', 'scratch-disk', 'legacy-data', 'migration-vol', 'tmp-export', 'restore-test'];
const ORPHAN_IP_NAMES = ['eip-legacy-nat', 'pip-old-lb', 'static-ip-migration', 'vpn-endpoint-old', 'pip-test-gateway'];

// Ready-made profiles for the three seeded accounts. Waste counts add up to the planted totals.
export const PROFILES = {
  'aws-prod': {
    provider: 'aws',
    vmCount: 60,
    regions: [['ap-south-1', 0.65], ['us-east-1', 0.2], ['eu-west-1', 0.15]],
    teams: ['platform', 'payments', 'checkout', 'sre', 'growth'],
    waste: { idle: 7, oversized: 12, stoppedVms: 2, unattachedDisks: 6, unusedIps: 3, oldSnapshots: 8, recentSnapshots: 10 },
    spike: { rolePrefix: 'api-gateway', daysAgo: [9, 8, 7], amounts: [412, 538, 386] },
  },
  'azure-analytics': {
    provider: 'azure',
    vmCount: 50,
    regions: [['centralindia', 0.55], ['eastus', 0.25], ['westeurope', 0.2]],
    teams: ['data-eng', 'bi', 'analytics', 'platform'],
    waste: { idle: 6, oversized: 10, stoppedVms: 2, unattachedDisks: 5, unusedIps: 3, oldSnapshots: 7, recentSnapshots: 8 },
  },
  'gcp-ml': {
    provider: 'gcp',
    vmCount: 40,
    regions: [['asia-south1', 0.5], ['us-central1', 0.35], ['europe-west1', 0.15]],
    teams: ['ml-research', 'ml-platform', 'inference', 'data-science'],
    waste: { idle: 5, oversized: 8, stoppedVms: 1, unattachedDisks: 4, unusedIps: 2, oldSnapshots: 5, recentSnapshots: 6 },
    spike: { rolePrefix: 'ml-train-worker', daysAgo: [4, 3], amounts: [297, 344] },
  },
};

// Smaller profile used when a user "connects" a new simulated account from the UI.
export function genericProfile(provider, region, r) {
  const regions = CATALOG[provider].regions.map((x) => x.code);
  const others = regions.filter((c) => c !== region);
  return {
    provider,
    vmCount: r.int(14, 20),
    regions: [[region, 0.75], [others[0], 0.15], [others[1], 0.1]],
    teams: ['platform', 'data', 'web', 'sre'],
    waste: { idle: 2, oversized: 3, stoppedVms: 1, unattachedDisks: 2, unusedIps: 1, oldSnapshots: 2, recentSnapshots: 3 },
  };
}

const pad = (n) => String(n).padStart(2, '0');

/** Build neutral specs for one account. */
export function buildWorld(profile, { seed, now = Date.now() }) {
  const r = makeRandom(mulberry32(seed));
  faker.seed(seed);
  const { provider, waste } = profile;
  const roles = ROLES[provider];
  const counters = {};
  const specs = [];
  const vms = [];
  const regionOf = () => r.weighted(profile.regions);
  const zoneOf = (region) => {
    const reg = CATALOG[provider].regions.find((x) => x.code === region);
    const z = r.pick(reg.zones);
    return provider === 'azure' ? z : `${region}${provider === 'gcp' ? '-' : ''}${z}`;
  };
  const owner = () => `${faker.person.firstName()}.${faker.person.lastName()}`.toLowerCase().replace(/[^a-z.]/g, '');
  const envPick = () => r.weighted([['prod', 0.55], ['staging', 0.25], ['dev', 0.2]]);

  // Pattern pool: planted waste first, the rest decided by each VM's role.
  let pool = [...Array(waste.idle).fill('idle'), ...Array(waste.oversized).fill('oversized')];
  while (pool.length < profile.vmCount) pool.push(null);
  pool = r.shuffle(pool);
  const normalIdx = pool.map((p, i) => (p ? -1 : i)).filter((i) => i >= 0);
  const stoppedSet = new Set(r.shuffle(normalIdx).slice(0, waste.stoppedVms));

  for (let i = 0; i < profile.vmCount; i++) {
    const role = r.pick(roles);
    const env = envPick();
    const pattern = pool[i] || r.pick(role.pats);
    const family = CLASS_FAMILY[provider][role.cls];
    const sizes = familySizes(provider, family);
    let sizeIdx;
    if (pattern === 'oversized') sizeIdx = r.int(Math.max(2, sizes.length - 2), sizes.length - 1);
    else if (pattern === 'idle') sizeIdx = r.int(0, sizes.length - 2);
    else if (role.cls === 'burst') sizeIdx = r.int(1, Math.min(3, sizes.length - 1));
    else sizeIdx = r.int(0, Math.min(2, sizes.length - 1));
    if (env === 'dev' && pattern !== 'oversized') sizeIdx = Math.max(0, sizeIdx - 1);

    const key = `${role.prefix}-${env}`;
    counters[key] = (counters[key] || 0) + 1;
    const name = `${role.prefix}-${env}-${pad(counters[key])}`;
    const region = regionOf();
    const recent = pattern === 'growing' ? r.chance(0.5) : r.chance(0.1);
    const createdAt = now - (recent ? r.int(35, 85) : r.int(95, 540)) * DAY - r.int(0, 23) * 3600e3;
    const stopped = stoppedSet.has(i);
    const team = r.pick(profile.teams);

    const vm = {
      kind: 'vm',
      key: `vm-${i}`,
      name,
      region,
      zone: zoneOf(region),
      instanceType: sizes[sizeIdx].type,
      state: stopped ? 'stopped' : 'running',
      tags: { env, team, owner: owner(), app: role.prefix },
      createdAt: new Date(createdAt),
      stoppedAt: stopped ? new Date(now - r.int(10, 40) * DAY - r.int(0, 23) * 3600e3) : null,
      pattern,
      params: makeParams(pattern, r, now),
      seed: r.int(1, 2 ** 31 - 1),
      egressGbPerHour: env === 'prod' && pattern !== 'idle' ? r.float(0.4, 2.2) : r.float(0, 0.15),
      costSpikes: [],
      role: role.prefix,
      privateIp: `10.${r.int(0, 40)}.${r.int(0, 254)}.${r.int(2, 254)}`,
    };
    specs.push(vm);
    vms.push(vm);

    // Every VM has a boot/data disk.
    const big = role.cls === 'memory' || /db|kafka|store|lake/.test(role.prefix);
    specs.push({
      kind: 'disk',
      key: `disk-${i}`,
      name: `${name}-${provider === 'aws' ? 'root' : 'osdisk'}`,
      region,
      zone: vm.zone,
      sizeGb: big ? r.pick([256, 512, 1024]) : r.pick([30, 50, 64, 100, 128]),
      state: 'in-use',
      attachedToKey: vm.key,
      tags: { env, team, owner: vm.tags.owner },
      createdAt: vm.createdAt,
    });

    if (r.chance(role.ip || 0.08)) {
      specs.push({
        kind: 'ip',
        key: `ip-${i}`,
        name: `${name}-pip`,
        region,
        state: 'in-use',
        attachedToKey: vm.key,
        address: `${r.pick([13, 15, 20, 34, 35, 52, 104])}.${r.int(1, 254)}.${r.int(1, 254)}.${r.int(1, 254)}`,
        tags: { env, team },
        createdAt: vm.createdAt,
      });
    }
  }

  // Unattached disks (left behind after migrations / deleted pods).
  for (let j = 0; j < waste.unattachedDisks; j++) {
    const env = envPick();
    const region = regionOf();
    specs.push({
      kind: 'disk',
      key: `orphan-disk-${j}`,
      name: `${r.pick(ORPHAN_DISK_NAMES)}-${env}-${pad(j + 1)}`,
      region,
      zone: zoneOf(region),
      sizeGb: r.pick([100, 200, 256, 500, 1000]),
      state: 'available',
      tags: { env, team: r.pick(profile.teams), owner: owner() },
      createdAt: new Date(now - r.int(40, 400) * DAY),
    });
  }

  // Reserved public IPs that point at nothing.
  for (let j = 0; j < waste.unusedIps; j++) {
    specs.push({
      kind: 'ip',
      key: `orphan-ip-${j}`,
      name: `${r.pick(ORPHAN_IP_NAMES)}-${pad(j + 1)}`,
      region: regionOf(),
      state: 'available',
      address: `${r.pick([3, 18, 34, 40, 52])}.${r.int(1, 254)}.${r.int(1, 254)}.${r.int(1, 254)}`,
      tags: { env: 'prod', team: r.pick(profile.teams) },
      createdAt: new Date(now - r.int(60, 500) * DAY),
    });
  }

  // Snapshots: some old (waste), some recent (healthy backups).
  const diskSpecs = specs.filter((s) => s.kind === 'disk' && s.attachedToKey);
  const addSnapshot = (ageDays, idx, old) => {
    const disk = r.pick(diskSpecs);
    const vm = vms.find((v) => v.key === disk.attachedToKey);
    const created = now - ageDays * DAY;
    specs.push({
      kind: 'snapshot',
      key: `snap-${old ? 'o' : 'r'}-${idx}`,
      name: `snap-${vm.name}-${dayKey(created).replace(/-/g, '')}`,
      region: disk.region,
      sizeGb: disk.sizeGb,
      state: 'completed',
      sourceDiskKey: disk.key,
      tags: { env: vm.tags.env, team: vm.tags.team, purpose: old ? 'pre-upgrade-backup' : 'daily-backup' },
      createdAt: new Date(created),
    });
  };
  for (let j = 0; j < waste.oldSnapshots; j++) addSnapshot(r.int(95, 420), j, true);
  for (let j = 0; j < waste.recentSnapshots; j++) addSnapshot(r.int(1, 60), j, false);

  // Planted cost spike: a burst of internet egress on one production VM.
  if (profile.spike) {
    const target = vms.find((v) => v.role === profile.spike.rolePrefix && v.tags.env === 'prod' && v.state === 'running')
      || vms.find((v) => v.state === 'running');
    target.costSpikes = profile.spike.daysAgo.map((d, k) => ({ date: dayKey(now - d * DAY), amount: profile.spike.amounts[k] }));
  }

  return specs;
}
