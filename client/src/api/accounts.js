import { del, get, post } from './client';

export const accountsApi = {
  list: () => get('/accounts'),
  catalog: () => get('/accounts/catalog'),
  connect: (body) => post('/accounts', body),
  sync: (id) => post(`/accounts/${id}/sync`),
  remove: (id) => del(`/accounts/${id}`),
};
