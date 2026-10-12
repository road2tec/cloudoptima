import { BaseConnector } from './BaseConnector.js';
import { awsSim } from '../simulation/providers/awsSim.js';

export class AwsConnector extends BaseConnector {
  async listResources() {
    const [instances, volumes, addresses, snapshots, hints] = await Promise.all([
      awsSim.describeInstances(this.account),
      awsSim.describeVolumes(this.account),
      awsSim.describeAddresses(this.account),
      awsSim.describeSnapshots(this.account),
      this.simulationHints(),
    ]);
    return { raw: { instances, volumes, addresses, snapshots }, hints };
  }

  getMetrics(nativeIds, from, to, periodSec = 3600) {
    return awsSim.getMetricStatistics(this.account, nativeIds, from, to, periodSec);
  }

  getCosts(from, to) {
    return awsSim.getCostAndUsageReport(this.account, from, to);
  }

  applyAction(nativeId, action) {
    switch (action.type) {
      case 'resize':
        return awsSim.modifyInstanceType(this.account, nativeId, action.toInstanceType);
      case 'terminate':
        return awsSim.terminateInstances(this.account, nativeId);
      case 'delete':
        if (nativeId.startsWith('vol-')) return awsSim.deleteVolume(this.account, nativeId);
        if (nativeId.startsWith('eipalloc-')) return awsSim.releaseAddress(this.account, nativeId);
        if (nativeId.startsWith('snap-')) return awsSim.deleteSnapshot(this.account, nativeId);
        throw new Error(`Cannot delete ${nativeId}`);
      default:
        throw new Error(`Unsupported action ${action.type}`);
    }
  }
}
