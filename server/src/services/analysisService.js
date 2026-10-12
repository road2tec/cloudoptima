// Runs every engine and replaces the open recommendation set.
import { Recommendation } from '../models/index.js';
import { DEFAULT_SETTINGS } from '../models/User.js';
import { detectWaste } from '../engines/idleDetector.js';
import { rightSize } from '../engines/rightSizer.js';
import { runForecasts } from '../engines/forecaster.js';
import { savingsSummary } from '../engines/savingsCalculator.js';
import { emit } from './realtime.js';

export async function runAnalysis({ settings = {}, withForecasts = true } = {}) {
  const started = Date.now();
  const cfg = { ...DEFAULT_SETTINGS, ...settings };
  const forecast = withForecasts ? await runForecasts() : null;

  const { recs: waste, idleIds } = await detectWaste(cfg);
  const sizing = await rightSize(cfg, { skipIds: idleIds });
  const all = [...waste, ...sizing];

  // Decisions already made by a person are kept; do not re-open the same finding.
  const decided = await Recommendation.find({ status: { $ne: 'open' } }).select('resource category').lean();
  const decidedKeys = new Set(decided.map((d) => `${d.resource}|${d.category}`));
  const fresh = all.filter((r) => !decidedKeys.has(`${r.resource}|${r.category}`));

  await Recommendation.deleteMany({ status: 'open' });
  if (fresh.length) await Recommendation.insertMany(fresh);

  const summary = await savingsSummary();
  emit('recommendations:updated', { at: new Date() });
  return { durationMs: Date.now() - started, generated: fresh.length, forecast, settings: cfg, summary };
}
