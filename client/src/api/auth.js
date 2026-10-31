import api from './client';

export const authApi = {
  me: () => api.get('/auth/me').then((res) => res.data.user),
  login: (credentials) => api.post('/auth/login', credentials).then((res) => res.data.user),
  signup: (details) => api.post('/auth/signup', details).then((res) => res.data.user),
  logout: () => api.post('/auth/logout')
};
