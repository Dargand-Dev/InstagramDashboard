import { useAuthStore } from '@/stores/authStore'

const BASE_URL = import.meta.env.VITE_API_URL || ''

function getHeaders() {
  const token = useAuthStore.getState().token
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  return headers
}

async function handleResponse(res, responseType = 'json') {
  if (res.status === 401) {
    useAuthStore.getState().handleUnauthorized()
    throw new Error('Session expired')
  }
  if (res.status === 423 && responseType === 'json') {
    const body = await res.json().catch(() => ({}))
    return { locked: true, ...body }
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    const err = new Error(body.message || body.error || `${res.status} ${res.statusText}`)
    err.status = res.status
    throw err
  }
  return responseType === 'blob' ? res.blob() : res.json().catch(() => ({}))
}

export async function apiFetch(url, options = {}, responseType = 'json') {
  const res = await fetch(`${BASE_URL}${url}`, {
    ...options,
    headers: { ...getHeaders(), ...options.headers },
  })
  return handleResponse(res, responseType)
}

export async function apiGet(url, signal) {
  return apiFetch(url, { signal })
}

export async function apiGetBlob(url) {
  return apiFetch(url, { cache: 'no-store' }, 'blob')
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
