import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { User } from '../models/index.js';
import { ApiError, asyncHandler } from '../utils/http.js';

export const signToken = (user) => jwt.sign({ sub: String(user._id), role: user.role }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });

export const verifyToken = (token) => jwt.verify(token, env.jwtSecret);

export const requireAuth = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new ApiError(401, 'Authentication required');
  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    throw new ApiError(401, 'Session expired — please sign in again');
  }
  const user = await User.findById(payload.sub);
  if (!user) throw new ApiError(401, 'User no longer exists');
  req.user = user;
  next();
});

// Role guard: requireRole('admin', 'approver')
export const requireRole = (...roles) => (req, _res, next) => {
  if (!roles.includes(req.user?.role)) {
    return next(new ApiError(403, `${roles.includes('approver') ? 'Approver' : 'Admin'} role required`));
  }
  next();
};
