import { get } from './client';

export const costsApi = {
  summary: () => get('/costs/summary'),
  trend: (params) => get('/costs/trend', params),
  breakdown: (params) => get('/costs/breakdown', params),
  overview: () => get('/dashboard/overview'),
};
