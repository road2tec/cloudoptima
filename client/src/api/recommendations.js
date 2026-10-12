import { get, patch, post } from './client';

export const recommendationsApi = {
  list: (params) => get('/recommendations', params),
  approve: (id, note) => patch(`/recommendations/${id}/approve`, note ? { note } : {}),
  reject: (id, note) => patch(`/recommendations/${id}/reject`, { note }),
  bulkApprove: (ids) => post('/recommendations/bulk-approve', { ids }),
  execute: (id, dryRun = false) => post(`/recommendations/${id}/simulate-execute`, { dryRun }),
};
