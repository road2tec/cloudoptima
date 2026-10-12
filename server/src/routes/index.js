import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import * as auth from '../controllers/authController.js';
import * as accounts from '../controllers/accountController.js';
import * as resources from '../controllers/resourceController.js';
import * as metrics from '../controllers/metricsController.js';
import * as costs from '../controllers/costController.js';
import * as forecasts from '../controllers/forecastController.js';
import * as recs from '../controllers/recommendationController.js';
import * as dashboard from '../controllers/dashboardController.js';
import * as misc from '../controllers/miscController.js';

const router = Router();
const OPERATORS = ['admin', 'approver'];

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 50,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, message: 'Too many attempts — try again in a few minutes', data: null },
});

router.get('/health', misc.health);

// ---- auth ----
router.post('/auth/register', authLimiter, validate(auth.registerSchema), auth.register);
router.post('/auth/login', authLimiter, validate(auth.loginSchema), auth.login);
router.get('/auth/me', requireAuth, auth.me);
router.patch('/auth/me', requireAuth, validate(auth.updateMeSchema), auth.updateMe);

// Everything below requires a valid token.
router.use(requireAuth);

// ---- accounts ----
router.get('/accounts', accounts.listAccounts);
router.get('/accounts/catalog', accounts.catalog);
router.post('/accounts', requireRole(...OPERATORS), validate(accounts.connectSchema), accounts.connectAccount);
router.post('/accounts/:id/sync', requireRole(...OPERATORS), accounts.syncNow);
router.delete('/accounts/:id', requireRole('admin'), accounts.deleteAccount);

// ---- inventory & metrics ----
router.get('/resources', resources.listResources);
router.get('/resources/facets', resources.facets);
router.get('/resources/:id', resources.getResource);
router.get('/metrics/:resourceId', metrics.getMetrics);

// ---- costs ----
router.get('/costs/summary', costs.summary);
router.get('/costs/trend', costs.trend);
router.get('/costs/breakdown', costs.breakdown);

// ---- forecasts ----
router.get('/forecasts', forecasts.fleetForecast);
router.post('/forecasts/run', requireRole(...OPERATORS), forecasts.runForecast);
router.get('/forecasts/:resourceId', forecasts.resourceForecast);

// ---- recommendations ----
router.get('/recommendations', recs.listRecommendations);
router.post('/recommendations/bulk-approve', requireRole(...OPERATORS), validate(recs.bulkSchema), recs.bulkApprove);
router.patch('/recommendations/:id/approve', requireRole(...OPERATORS), validate(recs.approveSchema), recs.approve);
router.patch('/recommendations/:id/reject', requireRole(...OPERATORS), validate(recs.rejectSchema), recs.reject);
router.post('/recommendations/:id/simulate-execute', requireRole(...OPERATORS), validate(recs.executeSchema), recs.simulateExecute);

// ---- analysis, dashboard, audit ----
router.post('/analysis/run', requireRole(...OPERATORS), misc.runAnalysisNow);
router.get('/dashboard/overview', dashboard.overview);
router.get('/audit', misc.listAudit);
router.get('/audit/facets', misc.auditFacets);

export default router;
