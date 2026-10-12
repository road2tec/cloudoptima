import { get, patch, post } from './client';

export const authApi = {
  login: (body) => post('/auth/login', body),
  register: (body) => post('/auth/register', body),
  me: () => get('/auth/me'),
  updateMe: (body) => patch('/auth/me', body),
  health: () => get('/health'),
};
