// Simulated AWS APIs. Response shapes follow EC2 Describe*, CloudWatch GetMetricStatistics
// and Cost & Usage Report (CUR) rows.
import { CATALOG, getRegion } from '../catalog.js';
import { findObjects } from '../cloudStore.js';
import { dailyCostLines, deleteObject, metricSeries, resizeObject } from '../simCore.js';
import { billableObjects, fakeRequestId, insertSimDocs, iso, toSimDoc, visibleObjects } from './common.js';
import { DAY } from '../../utils/stats.js';

const STATE_CODES = { pending: 0, running: 16, stopping: 64, stopped: 80, terminated: 48 };

const tagList = (name, tags = {}) => [{ Key: 'Name', Value: name }, ...Object.entries(tags).map(([Key, Value]) => ({ Key, Value }))];
const awsTime = (d) => `${new Date(d).toISOString().slice(0, 19).replace('T', ' ')} GMT`;

export const awsSim = {
  // Assign EC2-style identifiers and store the objects in the simulated cloud.
  async provision(account, specs, r) {
    const prefix = { vm: 'i-0', disk: 'vol-0', ip: 'eipalloc-0', snapshot: 'snap-0' };
    const ids = Object.fromEntries(specs.map((s) => [s.key, `${prefix[s.kind]}${r.hex(16)}`]));
    return insertSimDocs(specs.map((s) => toSimDoc(s, account, ids[s.key], ids, { accountNumber: account.externalId })));
  },

  async describeInstances(account) {
    const [vms, disks, ips] = await Promise.all([
      visibleObjects(account._id, 'vm', { keepTerminatedFor: DAY }),
      visibleObjects(account._id, 'disk'),
      visibleObjects(account._id, 'ip'),
    ]);
    const Reservations = vms.map((vm) => {
      const state = vm.deletedAt ? 'terminated' : vm.stoppedAt ? 'stopped' : 'running';
      const ip = ips.find((i) => i.attachedTo === vm.nativeId);
      return {
        ReservationId: `r-0${vm.nativeId.slice(3)}`,
        OwnerId: account.externalId,
        Instances: [
          {
            InstanceId: vm.nativeId,
            InstanceType: vm.instanceType,
            ImageId: 'ami-0f58b397bc5c1f2e8',
            LaunchTime: iso(vm.createdAt),
            Placement: { AvailabilityZone: vm.zone, Tenancy: 'default' },
            State: { Code: STATE_CODES[state], Name: state },
            StateTransitionReason: state === 'running' ? '' : `User initiated (${awsTime(vm.deletedAt || vm.stoppedAt)})`,
            PrivateIpAddress: vm.privateIp,
            PublicIpAddress: ip?.address,
            BlockDeviceMappings: disks
              .filter((d) => d.attachedTo === vm.nativeId)
              .map((d) => ({ DeviceName: '/dev/xvda', Ebs: { VolumeId: d.nativeId, Status: 'attached', DeleteOnTermination: true, AttachTime: iso(d.createdAt) } })),
            Tags: tagList(vm.name, vm.tags),
          },
        ],
      };
    });
    return { Reservations };
  },

  async describeVolumes(account) {
    const disks = await visibleObjects(account._id, 'disk');
    return {
      Volumes: disks.map((d) => ({
        VolumeId: d.nativeId,
        Size: d.sizeGb,
        VolumeType: 'gp3',
        Iops: 3000,
        State: d.attachedTo ? 'in-use' : 'available',
        AvailabilityZone: d.zone,
        CreateTime: iso(d.createdAt),
        Attachments: d.attachedTo ? [{ InstanceId: d.attachedTo, State: 'attached', Device: '/dev/xvda' }] : [],
        Tags: tagList(d.name, d.tags),
      })),
    };
  },

  async describeAddresses(account) {
    const ips = await visibleObjects(account._id, 'ip');
    return {
      Addresses: ips.map((a) => ({
        AllocationId: a.nativeId,
        PublicIp: a.address,
        Domain: 'vpc',
        NetworkBorderGroup: a.region,
        ...(a.attachedTo ? { AssociationId: `eipassoc-0${a.nativeId.slice(11)}`, InstanceId: a.attachedTo } : {}),
        Tags: tagList(a.name, a.tags),
      })),
    };
  },

  async describeSnapshots(account) {
    const snaps = await visibleObjects(account._id, 'snapshot');
    return {
      Snapshots: snaps.map((s) => ({
        SnapshotId: s.nativeId,
        VolumeId: s.sourceDisk,
        VolumeSize: s.sizeGb,
        StartTime: iso(s.createdAt),
        State: 'completed',
        Progress: '100%',
        OwnerId: account.externalId,
        Description: `Created by backup policy for ${s.sourceDisk}`,
        Tags: tagList(s.name, s.tags),
      })),
    };
  },

  // CloudWatch GetMetricStatistics for several instances at once.
  async getMetricStatistics(account, instanceIds, start, end, periodSec) {
    const vms = await findObjects(account._id, instanceIds);
    const MetricResults = {};
    for (const vm of vms) {
      const series = metricSeries(vm, start, end, periodSec * 1000);
      const dp = (fn, unit) => series.map((p) => ({ Timestamp: iso(p.ts), ...fn(p), Unit: unit }));
      MetricResults[vm.nativeId] = {
        CPUUtilization: { Label: 'CPUUtilization', Datapoints: dp((p) => ({ Average: p.cpuAvg, Maximum: p.cpuMax }), 'Percent') },
        mem_used_percent: { Label: 'mem_used_percent', Datapoints: dp((p) => ({ Average: p.memAvg, Maximum: p.memMax }), 'Percent') },
        NetworkIn: { Label: 'NetworkIn', Datapoints: dp((p) => ({ Sum: Math.round(p.netInMb * 1e6) }), 'Bytes') },
        NetworkOut: { Label: 'NetworkOut', Datapoints: dp((p) => ({ Sum: Math.round(p.netOutMb * 1e6) }), 'Bytes') },
      };
    }
    return { MetricResults };
  },

  // Cost & Usage Report rows (daily granularity).
  async getCostAndUsageReport(account, start, end) {
    const objs = await billableObjects(account._id, start);
    const rows = [];
    for (const o of objs) {
      const code = getRegion('aws', o.region).usageCode;
      for (const l of dailyCostLines(o, start, end)) {
        const usage = {
          compute: [`${code}-BoxUsage:${l.instanceType}`, 'AmazonEC2'],
          storage: [`${code}-EBS:VolumeUsage.gp3`, 'AmazonEC2'],
          snapshot: [`${code}-EBS:SnapshotUsage`, 'AmazonEC2'],
          ip: [`${code}-PublicIPv4:${o.attachedTo ? 'InUseAddress' : 'IdleAddress'}`, 'AmazonVPC'],
          egress: [`${code}-DataTransfer-Out-Bytes`, 'AWSDataTransfer'],
        }[l.category];
        rows.push({
          lineItem_UsageStartDate: `${l.date}T00:00:00Z`,
          lineItem_UsageEndDate: iso(new Date(l.date).getTime() + DAY),
          lineItem_ResourceId: o.nativeId,
          lineItem_UsageType: usage[0],
          lineItem_UsageAmount: l.quantity,
          lineItem_UnblendedCost: l.cost,
          lineItem_CurrencyCode: 'USD',
          product_servicecode: usage[1],
          product_region: o.region,
          resourceTags_user_team: o.tags?.team,
        });
      }
    }
    return { reportName: 'cur-daily', currency: 'USD', rows };
  },

  // ---- mutating APIs ----
  async modifyInstanceType(account, InstanceId, InstanceType) {
    const res = await resizeObject(account._id, InstanceId, InstanceType);
    return { RequestId: fakeRequestId(), InstanceId, Steps: ['StopInstances', 'ModifyInstanceAttribute', 'StartInstances'], ...res };
  },
  async terminateInstances(account, InstanceId) {
    const res = await deleteObject(account._id, InstanceId, { cascade: true });
    return { RequestId: fakeRequestId(), TerminatingInstances: [{ InstanceId, CurrentState: { Code: 48, Name: 'terminated' } }], ...res };
  },
  async deleteVolume(account, VolumeId) {
    return { RequestId: fakeRequestId(), ...(await deleteObject(account._id, VolumeId)) };
  },
  async releaseAddress(account, AllocationId) {
    return { RequestId: fakeRequestId(), ...(await deleteObject(account._id, AllocationId)) };
  },
  async deleteSnapshot(account, SnapshotId) {
    return { RequestId: fakeRequestId(), ...(await deleteObject(account._id, SnapshotId)) };
  },

  regions: () => CATALOG.aws.regions,
};
