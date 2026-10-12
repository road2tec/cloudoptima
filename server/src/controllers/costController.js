import { asyncHandler, ok } from '../utils/http.js';
import { costBreakdown, costSummary, costTrend } from '../services/costService.js';

const days = (v, def) => Math.min(365, Math.max(1, parseInt(v, 10) || def));

export const summary = asyncHandler(async (_req, res) => ok(res, await costSummary()));

export const trend = asyncHandler(async (req, res) => ok(res, await costTrend(days(req.query.days, 90), req.query.groupBy || 'provider')));

export const breakdown = asyncHandler(async (req, res) => ok(res, await costBreakdown(req.query.by || 'provider', days(req.query.days, 30))));
