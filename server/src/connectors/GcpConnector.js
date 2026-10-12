import { BaseConnector } from './BaseConnector.js';
import { gcpSim } from '../simulation/providers/gcpSim.js';

export class GcpConnector extends BaseConnector {
  async listResources() {
    const [instances, disks, addresses, snapshots, hints] = await Promise.all([
      gcpSim.instancesAggregatedList(this.account),
      gcpSim.disksAggregatedList(this.account),
      gcpSim.addressesAggregatedList(this.account),
      gcpSim.snapshotsList(this.account),
      this.simulationHints(),
    ]);
    return { raw: { instances, disks, addresses, snapshots }, hints };
  }

  getMetrics(nativeIds, from, to, periodSec = 3600) {
    return gcpSim.listTimeSeries(this.account, nativeIds, from, to, periodSec);
  }

  getCosts(from, to) {
    return gcpSim.billingExport(this.account, from, to);
  }

  applyAction(nativeId, action) {
    switch (action.type) {
      case 'resize':
        return gcpSim.setMachineType(this.account, nativeId, `machineTypes/${action.toInstanceType}`);
      case 'terminate':
        return gcpSim.deleteInstance(this.account, nativeId);
      case 'delete':
        return gcpSim.deleteResource(this.account, nativeId);
      default:
        throw new Error(`Unsupported action ${action.type}`);
    }
  }
}
