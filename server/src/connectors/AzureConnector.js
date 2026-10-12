import { BaseConnector } from './BaseConnector.js';
import { azureSim } from '../simulation/providers/azureSim.js';

export class AzureConnector extends BaseConnector {
  async listResources() {
    const [virtualMachines, disks, publicIPAddresses, snapshots, hints] = await Promise.all([
      azureSim.listVirtualMachines(this.account),
      azureSim.listDisks(this.account),
      azureSim.listPublicIPAddresses(this.account),
      azureSim.listSnapshots(this.account),
      this.simulationHints(),
    ]);
    return { raw: { virtualMachines, disks, publicIPAddresses, snapshots }, hints };
  }

  getMetrics(nativeIds, from, to, periodSec = 3600) {
    return azureSim.getMetrics(this.account, nativeIds, from, to, periodSec);
  }

  getCosts(from, to) {
    return azureSim.queryCosts(this.account, from, to);
  }

  applyAction(nativeId, action) {
    switch (action.type) {
      case 'resize':
        return azureSim.updateVmSize(this.account, nativeId, `Standard_${action.toInstanceType}`);
      case 'terminate':
        return azureSim.deleteVirtualMachine(this.account, nativeId);
      case 'delete':
        return azureSim.deleteResource(this.account, nativeId);
      default:
        throw new Error(`Unsupported action ${action.type}`);
    }
  }
}
