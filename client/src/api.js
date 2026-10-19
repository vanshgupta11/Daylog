const BASE = '/api';

async function apiFetch(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',          // send cookies
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export const authApi = {
  signup: (name, email, password) =>
    apiFetch('/auth/signup', { method: 'POST', body: JSON.stringify({ name, email, password }) }),
  signin: (email, password) =>
    apiFetch('/auth/signin', { method: 'POST', body: JSON.stringify({ email, password }) }),
  logout: () =>
    apiFetch('/auth/logout', { method: 'POST' }),
  me: () =>
    apiFetch('/auth/me'),
};

export const dataApi = {
  load: () => apiFetch('/data'),
  save: (json, updated) =>
    apiFetch('/data', { method: 'PUT', body: JSON.stringify({ json, updated }) }),
};
