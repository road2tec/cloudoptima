import mongoose from 'mongoose';

const settingsSchema = new mongoose.Schema(
  {
    currency: { type: String, enum: ['USD', 'INR'], default: 'USD' },
    theme: { type: String, enum: ['dark', 'light'], default: 'dark' },
    // Thresholds read by the optimization engines when this user runs an analysis.
    idleCpuThreshold: { type: Number, default: 5, min: 1, max: 50 },
    snapshotAgeDays: { type: Number, default: 90, min: 7, max: 1000 },
    stoppedVmDays: { type: Number, default: 7, min: 1, max: 365 },
    minMonthlySaving: { type: Number, default: 5, min: 0, max: 10000 },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ['admin', 'analyst', 'approver'], default: 'analyst' },
    avatarColor: { type: String, default: '#8B5CF6' },
    settings: { type: settingsSchema, default: () => ({}) },
    lastLoginAt: Date,
  },
  { timestamps: true }
);

userSchema.methods.toPublic = function toPublic() {
  return {
    id: this._id,
    name: this.name,
    email: this.email,
    role: this.role,
    avatarColor: this.avatarColor,
    settings: this.settings,
    createdAt: this.createdAt,
    lastLoginAt: this.lastLoginAt,
  };
};

export const DEFAULT_SETTINGS = { idleCpuThreshold: 5, snapshotAgeDays: 90, stoppedVmDays: 7, minMonthlySaving: 5 };

export default mongoose.model('User', userSchema);
