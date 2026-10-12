import { get, post } from './client';

export const forecastsApi = {
  fleet: () => get('/forecasts'),
  resource: (id) => get(`/forecasts/${id}`),
  run: (resourceId) => post('/forecasts/run', resourceId ? { resourceId } : {}),
  runAnalysis: () => post('/analysis/run'),
};
