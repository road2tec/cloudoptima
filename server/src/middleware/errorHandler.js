import { ZodError } from 'zod';
import { logger } from '../utils/logger.js';

export function notFound(req, res) {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.originalUrl}`, data: null });
}

// Every error leaves the API in the same { success, message, data } shape.
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  let status = err.status || 500;
  let message = err.message || 'Internal server error';
  let data = err.details || null;

  if (err instanceof ZodError) {
    status = 400;
    message = err.issues.map((i) => `${i.path.join('.') || 'value'}: ${i.message}`).join('; ');
    data = err.issues;
  } else if (err.name === 'CastError') {
    status = 400;
    message = `Invalid ${err.path}: ${err.value}`;
  } else if (err.code === 11000) {
    status = 409;
    message = `Duplicate value for ${Object.keys(err.keyValue || {}).join(', ')}`;
  }

  if (status >= 500) logger.error(`${req.method} ${req.originalUrl}`, err);
  res.status(status).json({ success: false, message, data });
}
