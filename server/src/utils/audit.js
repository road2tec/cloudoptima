import { AuditLog } from '../models/index.js';
import { emit } from '../services/realtime.js';

export async function audit(req, action, entityType, entityId, details = {}) {
  const entry = await AuditLog.create({
    user: req.user?._id,
    userName: req.user?.name,
    action,
    entityType,
    entityId: entityId ? String(entityId) : undefined,
    details,
    ip: req.ip,
  });
  emit('audit:new', { id: entry._id, action, userName: entry.userName, createdAt: entry.createdAt });
  return entry;
}
