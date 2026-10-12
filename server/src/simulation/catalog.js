// Price catalog for the three simulated clouds (on-demand Linux, USD per hour).
// Prices are modelled on public list prices for the base region; other regions apply a multiplier.
import { env } from '../config/env.js';

export const USD_TO_INR = env.usdToInr;

const vm = (type, family, vcpu, memoryGb, price) => ({ type, family, vcpu, memoryGb, price });

export const CATALOG = {
  aws: {
    label: 'Amazon Web Services',
    storageGbMonth: 0.08, // gp3
    snapshotGbMonth: 0.05,
    ipHour: 0.005, // public IPv4
    egressGb: 0.09,
    regions: [
      { code: 'us-east-1', name: 'US East (N. Virginia)', multiplier: 1.0, zones: ['a', 'b', 'c'], usageCode: 'USE1' },
      { code: 'ap-south-1', name: 'Asia Pacific (Mumbai)', multiplier: 1.05, zones: ['a', 'b', 'c'], usageCode: 'APS3' },
      { code: 'eu-west-1', name: 'Europe (Ireland)', multiplier: 1.11, zones: ['a', 'b', 'c'], usageCode: 'EUW1' },
    ],
    instances: [
      vm('t3.micro', 't3', 2, 1, 0.0104),
      vm('t3.small', 't3', 2, 2, 0.0208),
      vm('t3.medium', 't3', 2, 4, 0.0416),
      vm('t3.large', 't3', 2, 8, 0.0832),
      vm('t3.xlarge', 't3', 4, 16, 0.1664),
      vm('t3.2xlarge', 't3', 8, 32, 0.3328),
      vm('m5.large', 'm5', 2, 8, 0.096),
      vm('m5.xlarge', 'm5', 4, 16, 0.192),
      vm('m5.2xlarge', 'm5', 8, 32, 0.384),
      vm('m5.4xlarge', 'm5', 16, 64, 0.768),
      vm('c5.large', 'c5', 2, 4, 0.085),
      vm('c5.xlarge', 'c5', 4, 8, 0.17),
      vm('c5.2xlarge', 'c5', 8, 16, 0.34),
      vm('c5.4xlarge', 'c5', 16, 32, 0.68),
      vm('r5.large', 'r5', 2, 16, 0.126),
      vm('r5.xlarge', 'r5', 4, 32, 0.252),
      vm('r5.2xlarge', 'r5', 8, 64, 0.504),
    ],
  },
  azure: {
    label: 'Microsoft Azure',
    storageGbMonth: 0.12, // Premium SSD managed disk (approx. per GB)
    snapshotGbMonth: 0.05,
    ipHour: 0.005, // Standard static public IP
    egressGb: 0.087,
    regions: [
      { code: 'eastus', name: 'East US', multiplier: 1.0, zones: ['1', '2', '3'] },
      { code: 'centralindia', name: 'Central India', multiplier: 1.04, zones: ['1', '2', '3'] },
      { code: 'westeurope', name: 'West Europe', multiplier: 1.12, zones: ['1', '2', '3'] },
    ],
    instances: [
      vm('B1s', 'B', 1, 1, 0.0104),
      vm('B1ms', 'B', 1, 2, 0.0207),
      vm('B2s', 'B', 2, 4, 0.0416),
      vm('B2ms', 'B', 2, 8, 0.0832),
      vm('B4ms', 'B', 4, 16, 0.166),
      vm('D2s_v5', 'Dsv5', 2, 8, 0.096),
      vm('D4s_v5', 'Dsv5', 4, 16, 0.192),
      vm('D8s_v5', 'Dsv5', 8, 32, 0.384),
      vm('D16s_v5', 'Dsv5', 16, 64, 0.768),
      vm('F2s_v2', 'Fsv2', 2, 4, 0.0846),
      vm('F4s_v2', 'Fsv2', 4, 8, 0.169),
      vm('F8s_v2', 'Fsv2', 8, 16, 0.338),
      vm('F16s_v2', 'Fsv2', 16, 32, 0.677),
      vm('E2s_v5', 'Esv5', 2, 16, 0.126),
      vm('E4s_v5', 'Esv5', 4, 32, 0.252),
      vm('E8s_v5', 'Esv5', 8, 64, 0.504),
    ],
  },
  gcp: {
    label: 'Google Cloud',
    storageGbMonth: 0.1, // pd-balanced
    snapshotGbMonth: 0.026,
    ipHour: 0.005, // in-use external IP
    ipIdleHour: 0.01, // reserved but unused static IP
    egressGb: 0.12,
    regions: [
      { code: 'us-central1', name: 'Iowa', multiplier: 1.0, zones: ['a', 'b', 'c'] },
      { code: 'asia-south1', name: 'Mumbai', multiplier: 1.2, zones: ['a', 'b', 'c'] },
      { code: 'europe-west1', name: 'Belgium', multiplier: 1.1, zones: ['b', 'c', 'd'] },
    ],
    instances: [
      vm('e2-micro', 'e2', 2, 1, 0.0084),
      vm('e2-small', 'e2', 2, 2, 0.0168),
      vm('e2-medium', 'e2', 2, 4, 0.0335),
      vm('e2-standard-2', 'e2', 2, 8, 0.067),
      vm('e2-standard-4', 'e2', 4, 16, 0.134),
      vm('e2-standard-8', 'e2', 8, 32, 0.268),
      vm('n2-standard-2', 'n2-standard', 2, 8, 0.0971),
      vm('n2-standard-4', 'n2-standard', 4, 16, 0.1942),
      vm('n2-standard-8', 'n2-standard', 8, 32, 0.3885),
      vm('n2-standard-16', 'n2-standard', 16, 64, 0.7769),
      vm('c2-standard-4', 'c2', 4, 16, 0.2088),
      vm('c2-standard-8', 'c2', 8, 32, 0.4176),
      vm('c2-standard-16', 'c2', 16, 64, 0.8352),
      vm('n2-highmem-2', 'n2-highmem', 2, 16, 0.131),
      vm('n2-highmem-4', 'n2-highmem', 4, 32, 0.262),
      vm('n2-highmem-8', 'n2-highmem', 8, 64, 0.524),
    ],
  },
};

export const PROVIDERS = Object.keys(CATALOG);

export function getInstance(provider, type) {
  return CATALOG[provider]?.instances.find((i) => i.type === type) || null;
}

// All sizes of one family, cheapest first. Index in this list = "size step".
export function familySizes(provider, family) {
  return CATALOG[provider].instances.filter((i) => i.family === family).sort((a, b) => a.price - b.price);
}

export function getRegion(provider, code) {
  return CATALOG[provider].regions.find((r) => r.code === code) || CATALOG[provider].regions[0];
}

export const regionMultiplier = (provider, region) => getRegion(provider, region).multiplier;

// Effective hourly price of an instance type in a region.
export function instancePrice(provider, type, region) {
  const inst = getInstance(provider, type);
  return inst ? inst.price * regionMultiplier(provider, region) : 0;
}
