import mongoose from 'mongoose';
import { AuditLog, CloudAccount, Recommendation, Resource } from '../models/index.js';
import { runAnalysis } from '../services/analysisService.js';
import { asyncHandler, ok, paginate } from '../utils/http.js';
import { audit } from '../utils/audit.js';
import { env } from '../config/env.js';
import { round } from '../utils/stats.js';

const started = Date.now();

// GET /health — public; also feeds the stat cards on the sign-in screen.
export const health = asyncHandler(async (_req, res) => {
  const dbUp = mongoose.connection.readyState === 1;
  let stats = null;
  if (dbUp) {
    const [resources, accounts, recs] = await Promise.all([
      Resource.countDocuments({ state: { $ne: 'terminated' } }),
      CloudAccount.countDocuments(),
      Recommendation.aggregate([{ $match: { status: { $in: ['open', 'approved'] } } }, { $group: { _id: null, n: { $sum: 1 }, s: { $sum: '$monthlySaving' } } }]),
    ]);
    stats = { resources, accounts, openRecommendations: recs[0]?.n || 0, potentialSavings: round(recs[0]?.s || 0) };
  }
  ok(res, { status: dbUp ? 'ok' : 'degraded', db: dbUp ? 'connected' : 'disconnected', uptimeSec: Math.round((Date.now() - started) / 1000), simulatorLive: env.simulatorLive, stats });
});

// POST /analysis/run — runs every engine with the caller's thresholds.
export const runAnalysisNow = asyncHandler(async (req, res) => {
  const result = await runAnalysis({ settings: req.user.settings.toObject() });
  await audit(req, 'analysis.run', 'fleet', null, { generated: result.generated, durationMs: result.durationMs, potential: result.summary.potential });
  ok(res, result, `Analysis complete — ${result.generated} recommendation(s)`);
});

// GET /audit?page&limit&user&action
export const listAudit = asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate(req.query);
  const filter = {};
  if (req.query.user && mongoose.isValidObjectId(req.query.user)) filter.user = req.query.user;
  if (req.query.action) filter.action = { $regex: `^${String(req.query.action).replace(/[^a-z.-]/gi, '')}` };
  const [items, total] = await Promise.all([
    AuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('user', 'name email avatarColor role').lean(),
    AuditLog.countDocuments(filter),
  ]);
  ok(res, { items, page, limit, total });
});

export const auditFacets = asyncHandler(async (_req, res) => {
  const [users, actions] = await Promise.all([
    AuditLog.aggregate([{ $match: { user: { $ne: null } } }, { $group: { _id: '$user', name: { $first: '$userName' }, n: { $sum: 1 } } }, { $sort: { name: 1 } }]),
    AuditLog.aggregate([{ $group: { _id: '$action', n: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
  ]);
  ok(res, { users: users.map((u) => ({ id: u._id, name: u.name, count: u.n })), actions: actions.map((a) => ({ value: a._id, count: a.n })) });
});
