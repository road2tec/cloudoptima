import { get } from './client';

export const auditApi = {
  list: (params) => get('/audit', params),
  facets: () => get('/audit/facets'),
};
