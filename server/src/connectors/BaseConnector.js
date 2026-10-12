// Every cloud connector exposes the same four operations. The rest of the platform only
// talks to this interface, so a real SDK-backed connector can replace a simulated one
// without touching the sync service, engines or API.
import { SimObject } from '../simulation/cloudStore.js';

export class BaseConnector {
  constructor(account) {
    this.account = account;
    this.provider = account.provider;
  }

  /** @returns {Promise<{ raw: object, hints: Record<string, {pattern: string}> }>} provider-shaped inventory */
  async listResources() {
    throw new Error('listResources() not implemented');
  }

  /** @returns {Promise<object>} provider-shaped metrics keyed by native instance id */
  async getMetrics(nativeIds, from, to, periodSec = 3600) {
    throw new Error('getMetrics() not implemented');
  }

  /** @returns {Promise<object>} provider-shaped billing export for [from, to] */
  async getCosts(from, to) {
    throw new Error('getCosts() not implemented');
  }

  /**
   * Execute an optimization action.
   * action = { type: 'resize', toInstanceType } | { type: 'terminate' } | { type: 'delete' }
   */
  async applyAction(nativeId, action) {
    throw new Error('applyAction() not implemented');
  }

  // Simulation-only metadata (workload pattern per VM). A real connector returns {}.
  async simulationHints() {
    const objs = await SimObject.find({ account: this.account._id, kind: 'vm' }).select('nativeId pattern').lean();
    return Object.fromEntries(objs.map((o) => [o.nativeId, { pattern: o.pattern }]));
  }
}
