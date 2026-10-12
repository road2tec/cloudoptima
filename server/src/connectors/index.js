import { AwsConnector } from './AwsConnector.js';
import { AzureConnector } from './AzureConnector.js';
import { GcpConnector } from './GcpConnector.js';

const REGISTRY = { aws: AwsConnector, azure: AzureConnector, gcp: GcpConnector };

export function getConnector(account) {
  const Connector = REGISTRY[account.provider];
  if (!Connector) throw new Error(`No connector for provider ${account.provider}`);
  return new Connector(account);
}
