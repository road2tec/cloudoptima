// Simulated Google Cloud APIs: Compute Engine aggregatedList, Cloud Monitoring timeSeries
// (CPU as a 0..1 fraction, newest point first) and BigQuery billing-export rows.
import { getInstance, getRegion } from '../catalog.js';
import { findObjects } from '../cloudStore.js';
import { dailyCostLines, deleteObject, metricSeries, resizeObject } from '../simCore.js';
import { billableObjects, fakeRequestId, insertSimDocs, iso, toSimDoc, visibleObjects } from './common.js';
import { DAY } from '../../utils/stats.js';

const API = 'https://www.googleapis.com/compute/v1';
const zoneUrl = (p, z) => `${API}/projects/${p}/zones/${z}`;
const regionUrl = (p, r) => `${API}/projects/${p}/regions/${r}`;
// GCP label values allow only lowercase letters, digits, "_" and "-".
const labels = (tags = {}) => Object.fromEntries(Object.entries(tags).map(([k, v]) => [k, String(v).toLowerCase().replace(/[^a-z0-9_-]/g, '_')]));

function selfLink(project, o) {
  if (o.kind === 'vm') return `${zoneUrl(project, o.zone)}/instances/${o.name}`;
  if (o.kind === 'disk') return `${zoneUrl(project, o.zone)}/disks/${o.name}`;
  if (o.kind === 'ip') return `${regionUrl(project, o.region)}/addresses/${o.name}`;
  return `${API}/projects/${project}/global/snapshots/${o.name}`;
}
function globalName(project, o) {
  const path = { vm: `zones/${o.zone}/instances`, disk: `zones/${o.zone}/disks`, ip: `regions/${o.region}/addresses`, snapshot: 'global/snapshots' }[o.kind];
  return `//compute.googleapis.com/projects/${project}/${path}/${o.nativeId}`;
}

// Group items as aggregatedList does: { "zones/x": { instances: [...] } }
function aggregate(items, scopeOf, field) {
  const out = {};
  for (const it of items) {
    const scope = scopeOf(it);
    (out[scope] ||= { [field]: [] })[field].push(it);
  }
  return out;
}

const SKU_FAMILY = { e2: 'E2', 'n2-standard': 'N2', 'n2-highmem': 'N2', c2: 'Compute optimized' };

export const gcpSim = {
  async provision(account, specs, r) {
    const ids = Object.fromEntries(specs.map((s) => [s.key, r.digits(19)]));
    // Orphaned addresses / disks still need a zone or region; specs already carry them.
    return insertSimDocs(specs.map((s) => toSimDoc(s, account, ids[s.key], ids, { project: account.externalId })));
  },

  async instancesAggregatedList(account) {
    const p = account.externalId;
    const [vms, disks, ips] = await Promise.all([visibleObjects(account._id, 'vm'), visibleObjects(account._id, 'disk'), visibleObjects(account._id, 'ip')]);
    const items = vms.map((vm) => {
      const ip = ips.find((i) => i.attachedTo === vm.nativeId);
      return {
        kind: 'compute#instance',
        id: vm.nativeId,
        name: vm.name,
        creationTimestamp: iso(vm.createdAt),
        zone: zoneUrl(p, vm.zone),
        machineType: `${zoneUrl(p, vm.zone)}/machineTypes/${vm.instanceType}`,
        status: vm.stoppedAt ? 'TERMINATED' : 'RUNNING',
        ...(vm.stoppedAt ? { lastStopTimestamp: iso(vm.stoppedAt) } : {}),
        labels: labels(vm.tags),
        disks: disks.filter((d) => d.attachedTo === vm.nativeId).map((d, i) => ({ source: selfLink(p, d), boot: i === 0, deviceName: d.name, autoDelete: true })),
        networkInterfaces: [{ networkIP: vm.privateIp, accessConfigs: ip ? [{ type: 'ONE_TO_ONE_NAT', natIP: ip.address }] : [] }],
        selfLink: selfLink(p, vm),
      };
    });
    return { kind: 'compute#instanceAggregatedList', items: aggregate(items, (i) => `zones/${i.zone.split('/').pop()}`, 'instances') };
  },

  async disksAggregatedList(account) {
    const p = account.externalId;
    const [disks, vms] = await Promise.all([visibleObjects(account._id, 'disk'), visibleObjects(account._id, 'vm')]);
    const items = disks.map((d) => {
      const vm = vms.find((v) => v.nativeId === d.attachedTo);
      return {
        kind: 'compute#disk',
        id: d.nativeId,
        name: d.name,
        sizeGb: String(d.sizeGb),
        zone: zoneUrl(p, d.zone),
        type: `${zoneUrl(p, d.zone)}/diskTypes/pd-balanced`,
        status: 'READY',
        users: vm ? [selfLink(p, vm)] : [],
        creationTimestamp: iso(d.createdAt),
        labels: labels(d.tags),
        selfLink: selfLink(p, d),
      };
    });
    return { kind: 'compute#diskAggregatedList', items: aggregate(items, (i) => `zones/${i.zone.split('/').pop()}`, 'disks') };
  },

  async addressesAggregatedList(account) {
    const p = account.externalId;
    const [ips, vms] = await Promise.all([visibleObjects(account._id, 'ip'), visibleObjects(account._id, 'vm')]);
    const items = ips.map((a) => {
      const vm = vms.find((v) => v.nativeId === a.attachedTo);
      return {
        kind: 'compute#address',
        id: a.nativeId,
        name: a.name,
        address: a.address,
        region: regionUrl(p, a.region),
        status: vm ? 'IN_USE' : 'RESERVED',
        addressType: 'EXTERNAL',
        networkTier: 'PREMIUM',
        users: vm ? [selfLink(p, vm)] : [],
        creationTimestamp: iso(a.createdAt),
        labels: labels(a.tags),
      };
    });
    return { kind: 'compute#addressAggregatedList', items: aggregate(items, (i) => `regions/${i.region.split('/').pop()}`, 'addresses') };
  },

  async snapshotsList(account) {
    const p = account.externalId;
    const [snaps, disks] = await Promise.all([visibleObjects(account._id, 'snapshot'), visibleObjects(account._id, 'disk')]);
    return {
      kind: 'compute#snapshotList',
      items: snaps.map((s) => {
        const disk = disks.find((d) => d.nativeId === s.sourceDisk);
        return {
          kind: 'compute#snapshot',
          id: s.nativeId,
          name: s.name,
          diskSizeGb: String(s.sizeGb),
          storageBytes: String(Math.round(s.sizeGb * 0.62 * 1024 ** 3)),
          creationTimestamp: iso(s.createdAt),
          sourceDisk: disk ? selfLink(p, disk) : undefined,
          sourceDiskId: s.sourceDisk,
          status: 'READY',
          storageLocations: [s.region],
          labels: labels(s.tags),
        };
      }),
    };
  },

  // Cloud Monitoring timeSeries.list — CPU utilization is a fraction (0..1).
  async listTimeSeries(account, instanceIds, start, end, periodSec) {
    const vms = await findObjects(account._id, instanceIds);
    const out = {};
    for (const vm of vms) {
      const series = metricSeries(vm, start, end, periodSec * 1000).reverse(); // newest first
      const res = { type: 'gce_instance', labels: { project_id: account.externalId, instance_id: vm.nativeId, zone: vm.zone } };
      const ts = (type, kind, valueType, fn, extra = {}) => ({
        metric: { type, ...extra },
        resource: res,
        metricKind: kind,
        valueType,
        points: series.map((p) => ({ interval: { startTime: iso(p.ts), endTime: iso(p.ts + periodSec * 1000) }, value: fn(p) })),
      });
      out[vm.nativeId] = {
        timeSeries: [
          ts('compute.googleapis.com/instance/cpu/utilization', 'GAUGE', 'DOUBLE', (p) => ({ doubleValue: p.cpuAvg / 100 })),
          ts('agent.googleapis.com/memory/percent_used', 'GAUGE', 'DOUBLE', (p) => ({ doubleValue: p.memAvg }), { labels: { state: 'used' } }),
          ts('compute.googleapis.com/instance/network/received_bytes_count', 'DELTA', 'INT64', (p) => ({ int64Value: String(Math.round(p.netInMb * 1e6)) })),
          ts('compute.googleapis.com/instance/network/sent_bytes_count', 'DELTA', 'INT64', (p) => ({ int64Value: String(Math.round(p.netOutMb * 1e6)) })),
        ],
      };
    }
    return out;
  },

  // BigQuery standard billing export rows. Compute is split into Core and Ram SKUs.
  async billingExport(account, start, end) {
    const p = account.externalId;
    const objs = await billableObjects(account._id, start);
    const rows = [];
    for (const o of objs) {
      const regionName = getRegion('gcp', o.region).name;
      const base = {
        billing_account_id: '01A7F3-5C2E9D-8B41C0',
        project: { id: p, name: account.name },
        labels: Object.entries(labels(o.tags)).map(([key, value]) => ({ key, value })),
        location: { location: o.region, region: o.region, zone: o.zone },
        resource: { name: o.name, global_name: globalName(p, o) },
        currency: 'USD',
      };
      for (const l of dailyCostLines(o, start, end)) {
        const time = { usage_start_time: `${l.date}T00:00:00Z`, usage_end_time: iso(new Date(l.date).getTime() + DAY) };
        const row = (service, sku, cost, amount, unit) => rows.push({ ...base, ...time, service, sku: { id: sku.replace(/\W/g, '').slice(0, 12).toUpperCase(), description: sku }, cost, usage: { amount, unit } });
        const ce = { id: '6F81-5844-456A', description: 'Compute Engine' };
        if (l.category === 'compute') {
          const fam = SKU_FAMILY[getInstance('gcp', l.instanceType)?.family] || 'N2';
          row(ce, `${fam} Instance Core running in ${regionName}`, l.cost * 0.73, l.quantity, 'hour');
          row(ce, `${fam} Instance Ram running in ${regionName}`, l.cost * 0.27, l.quantity, 'hour');
        } else if (l.category === 'storage') row(ce, 'Balanced PD Capacity', l.cost, l.quantity, 'gibibyte month');
        else if (l.category === 'snapshot') row(ce, 'Storage PD Snapshot', l.cost, l.quantity, 'gibibyte month');
        else if (l.category === 'ip') row(ce, o.attachedTo ? 'External IP Charge on a Standard VM' : 'Static Ip Charge', l.cost, l.quantity, 'hour');
        else if (l.category === 'egress') row({ id: 'E505-1604-58F8', description: 'Networking' }, `Network Internet Egress from ${regionName}`, l.cost, l.quantity, 'gibibyte');
      }
    }
    return { table: `billing_export.gcp_billing_export_v1_${p.replace(/-/g, '_')}`, rows };
  },

  // ---- mutating APIs (return Operation resources) ----
  async setMachineType(account, id, machineType) {
    const res = await resizeObject(account._id, id, machineType.split('/').pop());
    return { kind: 'compute#operation', name: `operation-${fakeRequestId()}`, operationType: 'setMachineType', status: 'DONE', ...res };
  },
  async deleteInstance(account, id) {
    return { kind: 'compute#operation', name: `operation-${fakeRequestId()}`, operationType: 'delete', status: 'DONE', ...(await deleteObject(account._id, id, { cascade: true })) };
  },
  async deleteResource(account, id) {
    return { kind: 'compute#operation', name: `operation-${fakeRequestId()}`, operationType: 'delete', status: 'DONE', ...(await deleteObject(account._id, id)) };
  },
};
