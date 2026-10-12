import axios from 'axios';

export const TOKEN_KEY = 'co-token';

export const api = axios.create({ baseURL: '/api', timeout: 60000 });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Unwrap { success, message, data } and normalise errors to a readable message.
api.interceptors.response.use(
  (res) => res.data,
  (err) => {
    const status = err.response?.status;
    const message = err.response?.data?.message || (err.code === 'ERR_NETWORK' ? 'Cannot reach the API server' : err.message);
    if (status === 401 && !err.config.url.includes('/auth/login')) {
      localStorage.removeItem(TOKEN_KEY);
      window.dispatchEvent(new Event('co:logout'));
    }
    return Promise.reject(Object.assign(new Error(message), { status }));
  }
);

export const get = (url, params) => api.get(url, { params }).then((r) => r.data);
export const post = (url, body) => api.post(url, body).then((r) => r.data);
export const patch = (url, body) => api.patch(url, body).then((r) => r.data);
export const del = (url) => api.delete(url).then((r) => r.data);
