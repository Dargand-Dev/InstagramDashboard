import { useAuthStore } from '@/stores/authStore'

const BASE_URL = import.meta.env.VITE_API_URL || ''

function getHeaders() {
  const token = useAuthStore.getState().token
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  return headers
}

async function handleResponse(res) {
  if (res.status === 401) {
    useAuthStore.getState().handleUnauthorized()
    throw new Error('Session expired')
  }
  if (res.status === 423) {
    const body = await res.json().catch(() => ({}))
    return { locked: true, ...body }
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.message || body.error || `${res.status} ${res.statusText}`)
  }
  return res.json().catch(() => ({}))
}

export async function apiFetch(url, options = {}) {
  const res = await fetch(`${BASE_URL}${url}`, {
    ...options,
    headers: { ...getHeaders(), ...options.headers },
  })
  return handleResponse(res)
}

export async function apiGet(url, signal) {
  return apiFetch(url, { signal })
}

export async function apiPost(url, body) {
  return apiFetch(url, { method: 'POST', body: JSON.stringify(body) })
}

export async function apiPut(url, body) {
  return apiFetch(url, { method: 'PUT', body: JSON.stringify(body) })
}

export async function apiDelete(url) {
  return apiFetch(url, { method: 'DELETE' })
}
