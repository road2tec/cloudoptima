// Demand forecasting.
//  • Holt-Winters triple exponential smoothing (additive, damped trend, 24 h season)
//  • Linear-trend fallback
// Back-test: train on the first 23 of 30 days, predict the last 7, score with MAPE / RMSE.
// Then refit on all data and forecast 14 days with a ±1.96·σ(residual) band.
//
// forecastSeries() is the single public contract. A future Python service (ARIMA / Prophet /
// LSTM) only needs to return the same shape to be swapped in.
import { Forecast, MetricSample, Resource } from '../models/index.js';
import { clamp, HOUR, mean, round, std } from '../utils/stats.js';

const SEASON = 24; // daily cycle (primary)
const WEEK = 168; // weekly cycle, tried when there is enough history
const PHI = 0.98; // trend damping so long horizons do not run away

// ---------- Holt-Winters ----------

function hwFit(y, m, alpha, beta, gamma) {
  if (y.length < 2 * m) return null;
  let level = mean(y.slice(0, m));
  let trend = (mean(y.slice(m, 2 * m)) - level) / m;
  const season = y.slice(0, m).map((v) => v - level);
  const residuals = [];
  let sse = 0;
  for (let t = 0; t < y.length; t++) {
    const s = season[t % m];
    const yhat = level + PHI * trend + s; // one-step-ahead prediction
    if (t >= m) {
      const r = y[t] - yhat;
      residuals.push(r);
      sse += r * r;
    }
    const prevLevel = level;
    level = alpha * (y[t] - s) + (1 - alpha) * (prevLevel + PHI * trend);
    trend = beta * (level - prevLevel) + (1 - beta) * PHI * trend;
    season[t % m] = gamma * (y[t] - level) + (1 - gamma) * s;
  }
  return { level, trend, season, sse, residuals, n: y.length, alpha, beta, gamma };
}

function hwPredict(state, h, m) {
  const out = [];
  let damp = 0;
  for (let k = 1; k <= h; k++) {
    damp += PHI ** k;
    out.push(state.level + damp * state.trend + state.season[(state.n + k - 1) % m]);
  }
  return out;
}

// Small grid search on in-sample one-step SSE.
function hwBest(y, m) {
  let best = null;
  if (y.length < 2 * m) return null;
  for (const alpha of [0.1, 0.25, 0.45, 0.7]) {
    for (const beta of [0.005, 0.02, 0.08]) {
      for (const gamma of [0.05, 0.2, 0.4]) {
        const fit = hwFit(y, m, alpha, beta, gamma);
        if (fit && (!best || fit.sse < best.sse)) best = fit;
      }
    }
  }
  return best;
}

// ---------- Linear trend ----------

function linearFit(y) {
  const n = y.length;
  const xm = (n - 1) / 2;
  const ym = mean(y);
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - xm) * (y[i] - ym);
    den += (i - xm) ** 2;
  }
  const slope = den ? num / den : 0;
  const intercept = ym - slope * xm;
  const residuals = y.map((v, i) => v - (intercept + slope * i));
  return { slope, intercept, n, residuals };
}
const linearPredict = (fit, h) => Array.from({ length: h }, (_, k) => fit.intercept + fit.slope * (fit.n + k));

// ---------- Accuracy ----------

export function mape(actual, predicted) {
  // Denominator floored at 1 percentage point so near-idle series do not explode.
  return (100 * mean(actual.map((a, i) => Math.abs(a - predicted[i]) / Math.max(Math.abs(a), 1))));
}
export const rmse = (actual, predicted) => Math.sqrt(mean(actual.map((a, i) => (a - predicted[i]) ** 2)));

/**
 * Forecast one hourly series.
 * @param values  hourly observations (oldest first)
 * @param opts    { startTs, horizonHours = 336, testHours = 168, min = 0, max = 100 }
 * @returns { model, params, points:[{ts,value,lower,upper}], backtest:[{ts,actual,predicted}], mape, rmse, predictedPeak }
 */
export function forecastSeries(values, { startTs, horizonHours = 14 * 24, testHours = 7 * 24, min = 0, max = 100 } = {}) {
  const n = values.length;
  const test = Math.min(testHours, Math.floor(n * 0.25));
  const train = values.slice(0, n - test);
  const actual = values.slice(n - test);

  // 1) Back-test every candidate on the hold-out window.
  const candidates = [];
  for (const m of [SEASON, WEEK]) {
    const fit = hwBest(train, m);
    if (!fit) continue;
    const pred = hwPredict(fit, test, m).map((v) => clamp(v, min, max));
    candidates.push({ model: 'holt-winters', pred, rmse: rmse(actual, pred), mape: mape(actual, pred), params: { alpha: fit.alpha, beta: fit.beta, gamma: fit.gamma, season: m } });
  }
  const linTrain = linearFit(train);
  const linPred = linearPredict(linTrain, test).map((v) => clamp(v, min, max));
  const lin = { model: 'linear-trend', pred: linPred, rmse: rmse(actual, linPred), mape: mape(actual, linPred), params: {} };

  // Holt-Winters is preferred unless the simple trend line is clearly better.
  const hw = candidates.sort((a, b) => a.rmse - b.rmse)[0];
  const chosen = hw && hw.rmse <= lin.rmse * 1.05 ? hw : lin;

  // 2) Refit the chosen model on all data and project forward.
  let future;
  let residuals;
  if (chosen.model === 'holt-winters') {
    const p = chosen.params;
    const full = hwFit(values, p.season, p.alpha, p.beta, p.gamma);
    future = hwPredict(full, horizonHours, p.season);
    residuals = full.residuals;
  } else {
    const full = linearFit(values);
    future = linearPredict(full, horizonHours);
    residuals = full.residuals;
  }
  const band = 1.96 * std(residuals);
  const lastTs = startTs + (n - 1) * HOUR;
  const points = future.map((v, k) => ({
    ts: new Date(lastTs + (k + 1) * HOUR),
    value: round(clamp(v, min, max)),
    lower: round(clamp(v - band, min, max)),
    upper: round(clamp(v + band, min, max)),
  }));
  const testStart = startTs + (n - test) * HOUR;

  return {
    model: chosen.model,
    params: chosen.params,
    points,
    backtest: actual.map((a, i) => ({ ts: new Date(testStart + i * HOUR), actual: round(a), predicted: round(chosen.pred[i]) })),
    mape: round(chosen.mape),
    rmse: round(chosen.rmse),
    predictedPeak: round(Math.max(...points.map((p) => p.value))),
    trainedOn: n,
  };
}

// ---------- Fleet runner ----------

/** Build regular hourly series (forward-filled) for many resources in one aggregation. */
export async function hourlySeries(resourceIds, days = 30) {
  const since = new Date(Date.now() - days * 24 * HOUR);
  const rows = await MetricSample.aggregate([
    { $match: { resource: { $in: resourceIds }, ts: { $gte: since } } },
    {
      $group: {
        _id: { r: '$resource', h: { $dateTrunc: { date: '$ts', unit: 'hour' } } },
        cpu: { $avg: '$cpu' },
        mem: { $avg: '$mem' },
      },
    },
    { $sort: { '_id.h': 1 } },
  ]).allowDiskUse(true);

  const byRes = new Map();
  for (const row of rows) {
    const key = String(row._id.r);
    if (!byRes.has(key)) byRes.set(key, []);
    byRes.get(key).push({ ts: row._id.h.getTime(), cpu: row.cpu, mem: row.mem });
  }
  const out = new Map();
  for (const [key, pts] of byRes) {
    const start = pts[0].ts;
    const end = pts[pts.length - 1].ts;
    const cpu = [];
    const mem = [];
    let j = 0;
    let prev = pts[0];
    for (let ts = start; ts <= end; ts += HOUR) {
      if (j < pts.length && pts[j].ts === ts) prev = pts[j++];
      cpu.push(prev.cpu);
      mem.push(prev.mem ?? 0);
    }
    out.set(key, { startTs: start, cpu, mem });
  }
  return out;
}

/** Forecast CPU and memory for every running VM (or a subset) and store the results. */
export async function runForecasts({ resourceIds } = {}) {
  const filter = { type: 'vm', state: 'running', ...(resourceIds ? { _id: { $in: resourceIds } } : {}) };
  const vms = await Resource.find(filter).select('_id account provider').lean();
  const series = await hourlySeries(vms.map((v) => v._id));
  const docs = [];
  for (const vm of vms) {
    const s = series.get(String(vm._id));
    if (!s || s.cpu.length < 3 * 24) continue; // need at least 3 days of history
    for (const metric of ['cpu', 'mem']) {
      const f = forecastSeries(s[metric], { startTs: s.startTs });
      docs.push({ resource: vm._id, account: vm.account, provider: vm.provider, metric, horizonDays: 14, ...f });
    }
  }
  const ids = [...new Set(docs.map((d) => String(d.resource)))];
  await Forecast.deleteMany(resourceIds ? { resource: { $in: resourceIds } } : {});
  // Raw driver insert: ~150k embedded points would be slow to cast through Mongoose.
  const createdAt = new Date();
  if (docs.length) await Forecast.collection.insertMany(docs.map((d) => ({ ...d, createdAt })), { ordered: false });
  const cpuDocs = docs.filter((d) => d.metric === 'cpu');
  return {
    resources: ids.length,
    forecasts: docs.length,
    avgMape: round(mean(cpuDocs.map((d) => d.mape))),
    avgRmse: round(mean(cpuDocs.map((d) => d.rmse))),
    models: { 'holt-winters': docs.filter((d) => d.model === 'holt-winters').length, 'linear-trend': docs.filter((d) => d.model === 'linear-trend').length },
  };
}
