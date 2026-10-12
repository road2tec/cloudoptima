// Simulated Azure Resource Manager APIs: ARM list responses, Azure Monitor metrics
// and Cost Management query results (columns + rows).
import { getInstance } from '../catalog.js';
import { findObjects } from '../cloudStore.js';
import { dailyCostLines, deleteObject, metricSeries, resizeObject } from '../simCore.js';
import { billableObjects, fakeRequestId, insertSimDocs, iso, toSimDoc, visibleObjects } from './common.js';
import { makeRandom, mulberry32 } from '../../utils/rng.js';

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

function armId(sub, rg, type, name) {
  const path = {
    vm: 'Microsoft.Compute/virtualMachines',
    disk: 'Microsoft.Compute/disks',
    ip: 'Microsoft.Network/publicIPAddresses',
    snapshot: 'Microsoft.Compute/snapshots',
  }[type];
  return `/subscriptions/${sub}/resourceGroups/${rg}/providers/${path}/${name}`;
}
const rgOf = (id) => id.split('/')[4];
const nameOf = (id) => id.split('/').pop();

const meterSub = { compute: null, storage: 'Premium SSD Managed Disks', snapshot: 'Standard Snapshots', ip: 'IP Addresses', egress: 'Data Transfer Out' };
const meterCat = { compute: 'Virtual Machines', storage: 'Storage', snapshot: 'Storage', ip: 'Virtual Network', egress: 'Bandwidth' };

export const azureSim = {
  async provision(account, specs) {
    const sub = account.externalId;
    const base = slug(account.name);
    const ids = Object.fromEntries(specs.map((s) => [s.key, armId(sub, `rg-${base}-${s.tags?.env || 'shared'}`, s.kind, s.name)]));
    return insertSimDocs(specs.map((s) => toSimDoc(s, account, ids[s.key], ids, { subscriptionId: sub })));
  },

  async listVirtualMachines(account) {
    const [vms, disks] = await Promise.all([visibleObjects(account._id, 'vm'), visibleObjects(account._id, 'disk')]);
    return {
      value: vms.map((vm) => {
        const os = disks.find((d) => d.attachedTo === vm.nativeId);
        const vmId = makeRandom(mulberry32(vm.seed)).uuid();
        const running = !vm.stoppedAt;
        return {
          id: vm.nativeId,
          name: vm.name,
          type: 'Microsoft.Compute/virtualMachines',
          location: vm.region,
          zones: [vm.zone],
          tags: vm.tags,
          properties: {
            vmId,
            timeCreated: iso(vm.createdAt),
            hardwareProfile: { vmSize: `Standard_${vm.instanceType}` },
            provisioningState: 'Succeeded',
            storageProfile: os ? { osDisk: { name: os.name, osType: 'Linux', diskSizeGB: os.sizeGb, managedDisk: { id: os.nativeId, storageAccountType: 'Premium_LRS' } } } : {},
            networkProfile: { networkInterfaces: [{ id: `/subscriptions/${account.externalId}/resourceGroups/${rgOf(vm.nativeId)}/providers/Microsoft.Network/networkInterfaces/${vm.name}-nic` }] },
            instanceView: {
              statuses: [
                { code: 'ProvisioningState/succeeded', level: 'Info', displayStatus: 'Provisioning succeeded' },
                running
                  ? { code: 'PowerState/running', level: 'Info', displayStatus: 'VM running' }
                  : { code: 'PowerState/deallocated', level: 'Info', displayStatus: 'VM deallocated', time: iso(vm.stoppedAt) },
              ],
            },
          },
        };
      }),
    };
  },

  async listDisks(account) {
    const disks = await visibleObjects(account._id, 'disk');
    return {
      value: disks.map((d) => ({
        id: d.nativeId,
        name: d.name,
        type: 'Microsoft.Compute/disks',
        location: d.region,
        zones: d.zone ? [d.zone] : undefined,
        managedBy: d.attachedTo || undefined,
        sku: { name: 'Premium_LRS', tier: 'Premium' },
        tags: d.tags,
        properties: { diskSizeGB: d.sizeGb, diskState: d.attachedTo ? 'Attached' : 'Unattached', timeCreated: iso(d.createdAt), provisioningState: 'Succeeded' },
      })),
    };
  },

  async listPublicIPAddresses(account) {
    const ips = await visibleObjects(account._id, 'ip');
    return {
      value: ips.map((a) => ({
        id: a.nativeId,
        name: a.name,
        type: 'Microsoft.Network/publicIPAddresses',
        location: a.region,
        sku: { name: 'Standard', tier: 'Regional' },
        tags: a.tags,
        properties: {
          ipAddress: a.address,
          publicIPAllocationMethod: 'Static',
          provisioningState: 'Succeeded',
          ...(a.attachedTo
            ? { ipConfiguration: { id: `/subscriptions/${account.externalId}/resourceGroups/${rgOf(a.attachedTo)}/providers/Microsoft.Network/networkInterfaces/${nameOf(a.attachedTo)}-nic/ipConfigurations/ipconfig1` } }
            : {}),
        },
      })),
    };
  },

  async listSnapshots(account) {
    const snaps = await visibleObjects(account._id, 'snapshot');
    return {
      value: snaps.map((s) => ({
        id: s.nativeId,
        name: s.name,
        type: 'Microsoft.Compute/snapshots',
        location: s.region,
        tags: s.tags,
        properties: { diskSizeGB: s.sizeGb, timeCreated: iso(s.createdAt), creationData: { createOption: 'Copy', sourceResourceId: s.sourceDisk }, provisioningState: 'Succeeded' },
      })),
    };
  },

  // Azure Monitor metrics. Memory is reported as *available bytes*, not percent.
  async getMetrics(account, vmIds, start, end, periodSec) {
    const vms = await findObjects(account._id, vmIds);
    const interval = periodSec >= 3600 ? 'PT1H' : 'PT1M';
    const out = {};
    for (const vm of vms) {
      const memBytes = (getInstance('azure', vm.instanceType)?.memoryGb || 1) * 1024 ** 3;
      const series = metricSeries(vm, start, end, periodSec * 1000);
      const metric = (name, unit, fn) => ({
        id: `${vm.nativeId}/providers/Microsoft.Insights/metrics/${name}`,
        type: 'Microsoft.Insights/metrics',
        name: { value: name, localizedValue: name },
        unit,
        timeseries: [{ metadatavalues: [], data: series.map((p) => ({ timeStamp: iso(p.ts), ...fn(p) })) }],
      });
      out[vm.nativeId] = {
        cost: 0,
        timespan: `${iso(start)}/${iso(end)}`,
        interval,
        namespace: 'Microsoft.Compute/virtualMachines',
        resourceregion: vm.region,
        value: [
          metric('Percentage CPU', 'Percent', (p) => ({ average: p.cpuAvg, maximum: p.cpuMax })),
          metric('Available Memory Bytes', 'Bytes', (p) => ({ average: memBytes * (1 - p.memAvg / 100), minimum: memBytes * (1 - p.memMax / 100) })),
          metric('Network In Total', 'Bytes', (p) => ({ total: Math.round(p.netInMb * 1e6) })),
          metric('Network Out Total', 'Bytes', (p) => ({ total: Math.round(p.netOutMb * 1e6) })),
        ],
      };
    }
    return out;
  },

  // Cost Management query result. Note: ResourceIds come back lower-cased, like the real service.
  async queryCosts(account, start, end) {
    const objs = await billableObjects(account._id, start);
    const rows = [];
    for (const o of objs) {
      const family = getInstance('azure', o.instanceType)?.family;
      for (const l of dailyCostLines(o, start, end)) {
        rows.push([
          l.cost,
          Number(l.date.replace(/-/g, '')),
          o.nativeId.toLowerCase(),
          meterCat[l.category],
          l.category === 'compute' ? `${getInstance('azure', l.instanceType)?.family || family} Series` : meterSub[l.category],
          o.region,
          'USD',
        ]);
      }
    }
    return {
      id: `subscriptions/${account.externalId}/providers/Microsoft.CostManagement/query/${fakeRequestId()}`,
      type: 'Microsoft.CostManagement/query',
      properties: {
        nextLink: null,
        columns: [
          { name: 'PreTaxCost', type: 'Number' },
          { name: 'UsageDate', type: 'Number' },
          { name: 'ResourceId', type: 'String' },
          { name: 'MeterCategory', type: 'String' },
          { name: 'MeterSubCategory', type: 'String' },
          { name: 'ResourceLocation', type: 'String' },
          { name: 'Currency', type: 'String' },
        ],
        rows,
      },
    };
  },

  // ---- mutating APIs (ARM PATCH / DELETE) ----
  async updateVmSize(account, id, vmSize) {
    const res = await resizeObject(account._id, id, vmSize.replace(/^Standard_/, ''));
    return { status: 'Succeeded', operationId: fakeRequestId(), ...res };
  },
  async deleteVirtualMachine(account, id) {
    return { status: 'Succeeded', operationId: fakeRequestId(), ...(await deleteObject(account._id, id, { cascade: true })) };
  },
  async deleteResource(account, id) {
    return { status: 'Succeeded', operationId: fakeRequestId(), ...(await deleteObject(account._id, id)) };
  },
};
