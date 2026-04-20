/**
 * Client HTTP vers le backend Scraper (port 8082, proxied via /api/scraper).
 *
 * Stratégie :
 *  - Login lazy au premier appel, credentials depuis VITE_SCRAPER_BOT_USERNAME / _PASSWORD
 *  - Access token gardé en mémoire (volatile, pas localStorage — tokens Scraper expirent 15min)
 *  - Sur 401 : invalidate + re-login + retry une seule fois
 *  - Réutilise automatiquement le token pour toutes les requêtes
 */

const BASE = '/api/scraper'
const USERNAME = import.meta.env.VITE_SCRAPER_BOT_USERNAME || 'automation-bot'
const PASSWORD = import.meta.env.VITE_SCRAPER_BOT_PASSWORD || ''

let cachedToken = null
let tokenExpiryMs = 0
let loginInFlight = null

async function login() {
  if (!PASSWORD) {
    throw new Error('VITE_SCRAPER_BOT_PASSWORD non configuré')
  }
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ username: USERNAME, password: PASSWORD }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Scraper login failed (${res.status}): ${body.slice(0, 200)}`)
  }
  const json = await res.json()
  const token = json.accessToken || json.access_token
  const expiresIn = json.expiresInSeconds || json.expiresIn || json.accessTokenExpiresInSeconds || 840
  if (!token) {
    throw new Error('Scraper login: réponse sans accessToken')
  }
  cachedToken = token
  tokenExpiryMs = Date.now() + Math.max(30, expiresIn - 60) * 1000
  return token
}

async function getToken() {
  if (cachedToken && Date.now() < tokenExpiryMs) {
    return cachedToken
  }
  if (!loginInFlight) {
    loginInFlight = login().finally(() => { loginInFlight = null })
  }
  return loginInFlight
}

function invalidateToken() {
  cachedToken = null
  tokenExpiryMs = 0
}

async function doRequest(path, options, token) {
  return fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  })
}

async function scraperFetch(path, options = {}) {
  const token = await getToken()
  let res = await doRequest(path, options, token)
  if (res.status === 401) {
    invalidateToken()
    const fresh = await getToken()
    res = await doRequest(path, options, fresh)
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Scraper ${res.status}: ${body.slice(0, 300)}`)
  }
  if (res.status === 204) return null
  return res.json()
}

export function scraperGet(path, params) {
  const qs = params
    ? '?' + new URLSearchParams(
        Object.entries(params)
          .filter(([, v]) => v !== undefined && v !== null && v !== '')
          .map(([k, v]) => [k, String(v)])
      ).toString()
    : ''
  return scraperFetch(`${path}${qs}`, { method: 'GET' })
}

export function scraperPost(path, body) {
  return scraperFetch(path, { method: 'POST', body: JSON.stringify(body ?? {}) })
}
