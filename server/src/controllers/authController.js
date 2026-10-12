import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { User } from '../models/index.js';
import { signToken } from '../middleware/auth.js';
import { ApiError, asyncHandler, ok } from '../utils/http.js';
import { audit } from '../utils/audit.js';
import { env } from '../config/env.js';

const AVATAR_COLORS = ['#8B5CF6', '#22D3EE', '#10B981', '#F59E0B', '#F43F5E', '#6366F1', '#EC4899'];

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name is too short').max(60),
  email: z.string().trim().email('Enter a valid email'),
  password: z
    .string()
    .min(8, 'Use at least 8 characters')
    .regex(/[A-Z]/, 'Add an uppercase letter')
    .regex(/[0-9]/, 'Add a number'),
});

export const loginSchema = z.object({
  email: z.string().trim().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

export const updateMeSchema = z.object({
  name: z.string().trim().min(2).max(60).optional(),
  settings: z
    .object({
      currency: z.enum(['USD', 'INR']).optional(),
      theme: z.enum(['dark', 'light']).optional(),
      idleCpuThreshold: z.number().min(1).max(50).optional(),
      snapshotAgeDays: z.number().int().min(7).max(1000).optional(),
      stoppedVmDays: z.number().int().min(1).max(365).optional(),
      minMonthlySaving: z.number().min(0).max(10000).optional(),
    })
    .optional(),
});

const session = (user) => ({ token: signToken(user), user: user.toPublic(), config: { usdToInr: env.usdToInr } });

export const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;
  if (await User.exists({ email: email.toLowerCase() })) throw new ApiError(409, 'An account with this email already exists');
  const user = await User.create({
    name,
    email,
    passwordHash: await bcrypt.hash(password, 10),
    role: 'analyst',
    avatarColor: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
    lastLoginAt: new Date(),
  });
  req.user = user;
  await audit(req, 'auth.register', 'user', user._id, { email: user.email });
  ok(res, session(user), 'Account created', 201);
});

export const login = asyncHandler(async (req, res) => {
  const user = await User.findOne({ email: req.body.email.toLowerCase() }).select('+passwordHash');
  if (!user || !(await bcrypt.compare(req.body.password, user.passwordHash))) {
    throw new ApiError(401, 'Invalid email or password');
  }
  user.lastLoginAt = new Date();
  await user.save();
  req.user = user;
  await audit(req, 'auth.login', 'user', user._id, {});
  ok(res, session(user), 'Signed in');
});

export const me = asyncHandler(async (req, res) => {
  ok(res, { user: req.user.toPublic(), config: { usdToInr: env.usdToInr } });
});

export const updateMe = asyncHandler(async (req, res) => {
  const { name, settings } = req.body;
  if (name) req.user.name = name;
  if (settings) Object.assign(req.user.settings, settings);
  await req.user.save();
  await audit(req, 'user.settings.update', 'user', req.user._id, { name, settings });
  ok(res, { user: req.user.toPublic() }, 'Settings saved');
});
