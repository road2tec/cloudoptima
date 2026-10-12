import { get } from './client';

export const resourcesApi = {
  list: (params) => get('/resources', params),
  facets: () => get('/resources/facets'),
  get: (id) => get(`/resources/${id}`),
  metrics: (id, params) => get(`/metrics/${id}`, params),
};
