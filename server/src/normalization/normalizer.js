// Normalization layer: turns AWS / Azure / GCP shaped responses into one unified schema.
// Nothing outside this file needs to know how a provider names fields.
import { CATALOG, getInstance, instancePrice, regionMultiplier } from '../simulation/catalog.js';
import { HOURS_PER_MONTH } from '../utils/stats.js';

// ---------------------------------------------------------------- inventory

function vmDoc(account, hints, v) {
  const inst = getInstance(v.provider, v.instanceType);
  const hourly = instancePrice(v.provider, v.instanceType, v.region);
  return {
    resourceId: `${v.provider}:${v.nativeId}`,
    nativeId: v.nativeId,
    account: account._id,
    provider: v.provider,
    type: 'vm',
    name: v.name,
    region: v.region,
    zone: v.zone,
    instanceType: v.instanceType,
    family: inst?.family,
    vcpu: inst?.vcpu,
    memoryGb: inst?.memoryGb,
    hourlyPrice: hourly,
    monthlyCost: v.state === 'running' ? hourly * HOURS_PER_MONTH : 0,
    state: v.state,
    attachedTo: null,
    tags: v.tags || {},
    meta: v.meta || {},
    pattern: hints[v.nativeId]?.pattern,
    createdAt: v.createdAt ? new Date(v.createdAt) : undefined,
    stoppedAt: v.stoppedAt ? new Date(v.stoppedAt) : null,
  };
}

function diskDoc(account, d) {
  const monthly = d.sizeGb * CATALOG[d.provider].storageGbMonth * regionMultiplier(d.provider, d.region);
  return {
    resourceId: `${d.provider}:${d.nativeId}`,
    nativeId: d.nativeId,
    account: account._id,
    provider: d.provider,
    type: 'disk',
    name: d.name,
    region: d.region,
    zone: d.zone,
    sizeGb: d.sizeGb,
    hourlyPrice: monthly / HOURS_PER_MONTH,
    monthlyCost: monthly,
    state: d.attachedTo ? 'in-use' : 'available',
    attachedTo: d.attachedTo || null,
    tags: d.tags || {},
    meta: d.meta || {},
    createdAt: d.createdAt ? new Date(d.createdAt) : undefined,
  };
}

function ipDoc(account, a) {
  const p = CATALOG[a.provider];
  const hourly = a.attachedTo ? p.ipHour : p.ipIdleHour || p.ipHour;
  return {
    resourceId: `${a.provider}:${a.nativeId}`,
    nativeId: a.nativeId,
    account: account._id,
    provider: a.provider,
    type: 'ip',
    name: a.name,
    region: a.region,
    hourlyPrice: hourly,
    monthlyCost: hourly * HOURS_PER_MONTH,
    state: a.attachedTo ? 'in-use' : 'available',
    attachedTo: a.attachedTo || null,
    tags: a.tags || {},
    meta: { address: a.address },
    createdAt: a.createdAt ? new Date(a.createdAt) : undefined,
  };
}

function snapshotDoc(account, s) {
  const monthly = s.sizeGb * CATALOG[s.provider].snapshotGbMonth * regionMultiplier(s.provider, s.region);
  return {
    resourceId: `${s.provider}:${s.nativeId}`,
    nativeId: s.nativeId,
    account: account._id,
    provider: s.provider,
    type: 'snapshot',
    name: s.name,
    region: s.region,
    sizeGb: s.sizeGb,
    hourlyPrice: monthly / HOURS_PER_MONTH,
    monthlyCost: monthly,
    state: 'available',
    attachedTo: null,
    tags: s.tags || {},
    meta: { sourceDisk: s.sourceDisk },
    createdAt: s.createdAt ? new Date(s.createdAt) : undefined,
  };
}

const awsTags = (Tags = []) => {
  const tags = {};
  let name;
  for (const { Key, Value } of Tags) {
    if (Key === 'Name') name = Value;
    else tags[Key] = Value;
  }
  return { name, tags };
};

const INVENTORY = {
  aws(raw, hints, account) {
    const out = [];
    const volumeRegion = {};
    for (const r of raw.instances.Reservations) {
      for (const i of r.Instances) {
        const { name, tags } = awsTags(i.Tags);
        const s = i.State.Name;
        // "User initiated (2026-09-20 10:12:00 GMT)" → stop time
        const m = /\((\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}) GMT\)/.exec(i.StateTransitionReason || '');
        out.push(vmDoc(account, hints, {
          provider: 'aws',
          nativeId: i.InstanceId,
          name: name || i.InstanceId,
          region: i.Placement.AvailabilityZone.slice(0, -1),
          zone: i.Placement.AvailabilityZone,
          instanceType: i.InstanceType,
          state: s === 'running' ? 'running' : s === 'terminated' ? 'terminated' : 'stopped',
          tags,
          createdAt: i.LaunchTime,
          stoppedAt: s !== 'running' && m ? `${m[1].replace(' ', 'T')}Z` : null,
          meta: { imageId: i.ImageId, privateIp: i.PrivateIpAddress, publicIp: i.PublicIpAddress },
        }));
      }
    }
    for (const v of raw.volumes.Volumes) {
      const { name, tags } = awsTags(v.Tags);
      const region = v.AvailabilityZone.slice(0, -1);
      volumeRegion[v.VolumeId] = region;
      const att = v.Attachments?.[0]?.InstanceId;
      out.push(diskDoc(account, {
        provider: 'aws', nativeId: v.VolumeId, name: name || v.VolumeId, region, zone: v.AvailabilityZone,
        sizeGb: v.Size, attachedTo: att ? `aws:${att}` : null, tags, createdAt: v.CreateTime, meta: { volumeType: v.VolumeType, iops: v.Iops },
      }));
    }
    for (const a of raw.addresses.Addresses) {
      const { name, tags } = awsTags(a.Tags);
      out.push(ipDoc(account, {
        provider: 'aws', nativeId: a.AllocationId, name: name || a.PublicIp, region: a.NetworkBorderGroup,
        address: a.PublicIp, attachedTo: a.InstanceId ? `aws:${a.InstanceId}` : null, tags,
      }));
    }
    for (const s of raw.snapshots.Snapshots) {
      const { name, tags } = awsTags(s.Tags);
      out.push(snapshotDoc(account, {
        provider: 'aws', nativeId: s.SnapshotId, name: name || s.SnapshotId, region: volumeRegion[s.VolumeId] || account.defaultRegion,
        sizeGb: s.VolumeSize, sourceDisk: s.VolumeId ? `aws:${s.VolumeId}` : null, tags, createdAt: s.StartTime,
      }));
    }
    return out;
  },

  azure(raw, hints, account) {
    const out = [];
    for (const vm of raw.virtualMachines.value) {
      const power = vm.properties.instanceView?.statuses?.find((s) => s.code.startsWith('PowerState/'));
      const running = power?.code === 'PowerState/running';
      out.push(vmDoc(account, hints, {
        provider: 'azure',
        nativeId: vm.id,
        name: vm.name,
        region: vm.location,
        zone: vm.zones?.[0] ? `${vm.location}-${vm.zones[0]}` : undefined,
        instanceType: vm.properties.hardwareProfile.vmSize.replace(/^Standard_/, ''),
        state: running ? 'running' : 'stopped',
        tags: vm.tags,
        createdAt: vm.properties.timeCreated,
        stoppedAt: running ? null : power?.time,
        meta: { vmId: vm.properties.vmId, resourceGroup: vm.id.split('/')[4] },
      }));
    }
    for (const d of raw.disks.value) {
      out.push(diskDoc(account, {
        provider: 'azure', nativeId: d.id, name: d.name, region: d.location, zone: d.zones?.[0] ? `${d.location}-${d.zones[0]}` : undefined,
        sizeGb: d.properties.diskSizeGB, attachedTo: d.managedBy ? `azure:${d.managedBy}` : null, tags: d.tags,
        createdAt: d.properties.timeCreated, meta: { sku: d.sku?.name, diskState: d.properties.diskState },
      }));
    }
    for (const ip of raw.publicIPAddresses.value) {
      // ipConfiguration → NIC → VM (NICs are named "<vm>-nic").
      let attachedTo = null;
      const cfg = ip.properties.ipConfiguration?.id;
      if (cfg) {
        const parts = cfg.split('/');
        const vmName = parts[8].replace(/-nic$/, '');
        attachedTo = `azure:/subscriptions/${parts[2]}/resourceGroups/${parts[4]}/providers/Microsoft.Compute/virtualMachines/${vmName}`;
      }
      out.push(ipDoc(account, { provider: 'azure', nativeId: ip.id, name: ip.name, region: ip.location, address: ip.properties.ipAddress, attachedTo, tags: ip.tags }));
    }
    for (const s of raw.snapshots.value) {
      out.push(snapshotDoc(account, {
        provider: 'azure', nativeId: s.id, name: s.name, region: s.location, sizeGb: s.properties.diskSizeGB,
        sourceDisk: s.properties.creationData?.sourceResourceId ? `azure:${s.properties.creationData.sourceResourceId}` : null,
        tags: s.tags, createdAt: s.properties.timeCreated,
      }));
    }
    return out;
  },

  gcp(raw, hints, account) {
    const out = [];
    const bySelfLink = {};
    const last = (url) => url?.split('/').pop();
    const each = (agg, field, fn) => Object.values(agg.items || {}).forEach((scope) => (scope[field] || []).forEach(fn));

    each(raw.instances, 'instances', (i) => {
      const zone = last(i.zone);
      bySelfLink[i.selfLink] = `gcp:${i.id}`;
      out.push(vmDoc(account, hints, {
        provider: 'gcp',
        nativeId: i.id,
        name: i.name,
        region: zone.replace(/-[a-z]$/, ''),
        zone,
        instanceType: last(i.machineType),
        state: i.status === 'RUNNING' ? 'running' : 'stopped',
        tags: i.labels,
        createdAt: i.creationTimestamp,
        stoppedAt: i.status === 'RUNNING' ? null : i.lastStopTimestamp,
        meta: { privateIp: i.networkInterfaces?.[0]?.networkIP, publicIp: i.networkInterfaces?.[0]?.accessConfigs?.[0]?.natIP },
      }));
    });
    each(raw.disks, 'disks', (d) => {
      const zone = last(d.zone);
      out.push(diskDoc(account, {
        provider: 'gcp', nativeId: d.id, name: d.name, region: zone.replace(/-[a-z]$/, ''), zone, sizeGb: Number(d.sizeGb),
        attachedTo: d.users?.length ? bySelfLink[d.users[0]] || null : null, tags: d.labels, createdAt: d.creationTimestamp,
        meta: { diskType: last(d.type) },
      }));
    });
    each(raw.addresses, 'addresses', (a) => {
      out.push(ipDoc(account, {
        provider: 'gcp', nativeId: a.id, name: a.name, region: last(a.region), address: a.address,
        attachedTo: a.status === 'IN_USE' && a.users?.length ? bySelfLink[a.users[0]] || null : null, tags: a.labels, createdAt: a.creationTimestamp,
      }));
    });
    for (const s of raw.snapshots.items || []) {
      out.push(snapshotDoc(account, {
        provider: 'gcp', nativeId: s.id, name: s.name, region: s.storageLocations?.[0] || account.defaultRegion, sizeGb: Number(s.diskSizeGb),
        sourceDisk: s.sourceDiskId ? `gcp:${s.sourceDiskId}` : null, tags: s.labels, createdAt: s.creationTimestamp,
      }));
    }
    return out;
  },
};

export function normalizeInventory(provider, { raw, hints = {} }, account) {
  return INVENTORY[provider](raw, hints, account);
}

// ---------------------------------------------------------------- metrics

/**
 * @param ctx  { [nativeId]: { memoryGb } } — needed to convert Azure "available bytes" to %.
 * @returns    { [nativeId]: [{ ts, cpu, mem, netIn, netOut }] } with network in MB.
 */
export function normalizeMetrics(provider, raw, ctx = {}) {
  const out = {};
  if (provider === 'aws') {
    for (const [id, m] of Object.entries(raw.MetricResults)) {
      const rows = new Map();
      const put = (dps, fn) => dps.forEach((d) => {
        const ts = new Date(d.Timestamp).getTime();
        rows.set(ts, { ...(rows.get(ts) || { ts: new Date(ts) }), ...fn(d) });
      });
      put(m.CPUUtilization.Datapoints, (d) => ({ cpu: d.Average }));
      put(m.mem_used_percent.Datapoints, (d) => ({ mem: d.Average }));
      put(m.NetworkIn.Datapoints, (d) => ({ netIn: d.Sum / 1e6 }));
      put(m.NetworkOut.Datapoints, (d) => ({ netOut: d.Sum / 1e6 }));
      out[id] = [...rows.values()].sort((a, b) => a.ts - b.ts);
    }
  } else if (provider === 'azure') {
    for (const [id, m] of Object.entries(raw)) {
      const totalBytes = (ctx[id]?.memoryGb || 1) * 1024 ** 3;
      const series = (name) => m.value.find((v) => v.name.value === name)?.timeseries?.[0]?.data || [];
      const cpu = series('Percentage CPU');
      const mem = series('Available Memory Bytes');
      const nin = series('Network In Total');
      const nout = series('Network Out Total');
      out[id] = cpu.map((d, i) => ({
        ts: new Date(d.timeStamp),
        cpu: d.average,
        mem: mem[i] ? 100 * (1 - mem[i].average / totalBytes) : null,
        netIn: (nin[i]?.total || 0) / 1e6,
        netOut: (nout[i]?.total || 0) / 1e6,
      }));
    }
  } else if (provider === 'gcp') {
    for (const [id, m] of Object.entries(raw)) {
      const rows = new Map();
      const pick = (type) => m.timeSeries.find((t) => t.metric.type === type)?.points || [];
      const put = (type, key, fn) => pick(type).forEach((p) => {
        const ts = new Date(p.interval.startTime).getTime();
        rows.set(ts, { ...(rows.get(ts) || { ts: new Date(ts) }), [key]: fn(p.value) });
      });
      put('compute.googleapis.com/instance/cpu/utilization', 'cpu', (v) => v.doubleValue * 100);
      put('agent.googleapis.com/memory/percent_used', 'mem', (v) => v.doubleValue);
      put('compute.googleapis.com/instance/network/received_bytes_count', 'netIn', (v) => Number(v.int64Value) / 1e6);
      put('compute.googleapis.com/instance/network/sent_bytes_count', 'netOut', (v) => Number(v.int64Value) / 1e6);
      out[id] = [...rows.values()].sort((a, b) => a.ts - b.ts);
    }
  }
  return out;
}

// ---------------------------------------------------------------- costs

// Unified service names used across the platform.
export const SERVICES = ['Compute', 'Block Storage', 'Snapshots', 'Public IP', 'Data Transfer'];

function awsService(usageType) {
  if (usageType.includes('BoxUsage')) return 'Compute';
  if (usageType.includes('SnapshotUsage')) return 'Snapshots';
  if (usageType.includes('VolumeUsage')) return 'Block Storage';
  if (usageType.includes('PublicIPv4')) return 'Public IP';
  if (usageType.includes('DataTransfer')) return 'Data Transfer';
  return 'Other';
}

function azureService(cat, sub) {
  if (cat === 'Virtual Machines') return 'Compute';
  if (cat === 'Storage') return /snapshot/i.test(sub) ? 'Snapshots' : 'Block Storage';
  if (cat === 'Virtual Network') return 'Public IP';
  if (cat === 'Bandwidth') return 'Data Transfer';
  return 'Other';
}

function gcpService(service, sku) {
  if (service === 'Networking' || /Egress/i.test(sku)) return 'Data Transfer';
  if (/Instance (Core|Ram)/.test(sku)) return 'Compute';
  if (/Snapshot/i.test(sku)) return 'Snapshots';
  if (/PD Capacity/i.test(sku)) return 'Block Storage';
  if (/Ip Charge|IP Charge/i.test(sku)) return 'Public IP';
  return 'Other';
}

/** @returns [{ nativeKey (lower-cased), date: 'YYYY-MM-DD', service, region, cost }] */
export function normalizeCosts(provider, raw) {
  if (provider === 'aws') {
    return raw.rows.map((r) => ({
      nativeKey: r.lineItem_ResourceId.toLowerCase(),
      date: r.lineItem_UsageStartDate.slice(0, 10),
      service: awsService(r.lineItem_UsageType),
      region: r.product_region,
      cost: r.lineItem_UnblendedCost,
    }));
  }
  if (provider === 'azure') {
    const cols = Object.fromEntries(raw.properties.columns.map((c, i) => [c.name, i]));
    return raw.properties.rows.map((r) => {
      const d = String(r[cols.UsageDate]);
      return {
        nativeKey: String(r[cols.ResourceId]).toLowerCase(),
        date: `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`,
        service: azureService(r[cols.MeterCategory], r[cols.MeterSubCategory]),
        region: r[cols.ResourceLocation],
        cost: r[cols.PreTaxCost],
      };
    });
  }
  return raw.rows.map((r) => ({
    nativeKey: r.resource.global_name.split('/').pop().toLowerCase(),
    date: r.usage_start_time.slice(0, 10),
    service: gcpService(r.service.description, r.sku.description),
    region: r.location.region,
    cost: r.cost,
  }));
}
