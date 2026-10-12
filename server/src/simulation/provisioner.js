// Creates the simulated cloud estate behind a CloudAccount (the "cloud side" of the demo).
import { awsSim } from './providers/awsSim.js';
import { azureSim } from './providers/azureSim.js';
import { gcpSim } from './providers/gcpSim.js';
import { buildWorld, genericProfile } from './world.js';
import { makeRandom, mulberry32 } from '../utils/rng.js';
import { SimObject } from './cloudStore.js';

const SIMS = { aws: awsSim, azure: azureSim, gcp: gcpSim };

export async function provisionCloud(account, profile, seed) {
  const specs = buildWorld(profile, { seed });
  const r = makeRandom(mulberry32(seed ^ 0x5bd1e995));
  return SIMS[account.provider].provision(account, specs, r);
}

// Native account identifier format for each provider.
export function newExternalId(provider, name, seed) {
  const r = makeRandom(mulberry32(seed));
  if (provider === 'aws') return r.digits(12);
  if (provider === 'azure') return r.uuid();
  return `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 20)}-${r.int(1000, 9999)}`;
}

export async function provisionGeneric(account, seed) {
  const r = makeRandom(mulberry32(seed));
  return provisionCloud(account, genericProfile(account.provider, account.defaultRegion, r), seed);
}

export const destroyCloud = (accountId) => SimObject.deleteMany({ account: accountId });
