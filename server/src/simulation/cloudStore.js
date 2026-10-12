// Backing store of the *simulated clouds themselves* (collection: sim_cloud_objects).
// Think of it as "what lives inside AWS/Azure/GCP". The platform never reads it directly:
// it only sees it through provider-shaped API responses returned by the simulators.
import mongoose from 'mongoose';

const simObjectSchema = new mongoose.Schema(
  {
    account: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    provider: { type: String, required: true },
    kind: { type: String, enum: ['vm', 'disk', 'ip', 'snapshot'], required: true },
    nativeId: { type: String, required: true, index: true },
    name: String,
    region: String,
    zone: String,
    instanceType: String,
    prevInstanceType: String,
    sizeGb: Number,
    state: String, // running | stopped | in-use | available | completed | terminated
    tags: { type: Object, default: {} },
    createdAt: Date,
    stoppedAt: Date,
    deletedAt: Date,
    resizedAt: Date,
    cpuScale: Number,
    memScale: Number,
    attachedTo: String, // nativeId of the VM
    sourceDisk: String, // snapshots: nativeId of the source disk
    address: String, // public IPs
    privateIp: String,
    pattern: String,
    params: Object,
    seed: Number,
    egressGbPerHour: { type: Number, default: 0 },
    costSpikes: [{ _id: false, date: String, amount: Number }],
    ctx: Object, // provider context: subscriptionId, resourceGroup, project ...
  },
  { collection: 'sim_cloud_objects', versionKey: false, strict: false }
);

export const SimObject = mongoose.models.SimObject || mongoose.model('SimObject', simObjectSchema);

export const listObjects = (accountId, kind, { includeDeleted = false } = {}) =>
  SimObject.find({ account: accountId, ...(kind ? { kind } : {}), ...(includeDeleted ? {} : { deletedAt: null }) }).lean();

export const findObjects = (accountId, nativeIds) => SimObject.find({ account: accountId, nativeId: { $in: nativeIds } }).lean();

export const findObject = (accountId, nativeId) => SimObject.findOne({ account: accountId, nativeId }).lean();

export const updateObject = (id, set) => SimObject.updateOne({ _id: id }, { $set: set });
