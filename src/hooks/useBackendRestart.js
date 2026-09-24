import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

/**
 * Redémarrage du backend Spring Boot, piloté par le serveur de dev Vite (dev/backendRestart.js).
 *
 * Pas d'apiGet/apiPost ici : ces routes ne sont pas celles du backend (pas de JWT), et
 * VITE_API_URL ne doit pas préfixer une route servie par Vite lui-même.
 */
const STATUS_URL = '/__dev/backend/status'
const RESTART_URL = '/__dev/backend/restart'
const STATUS_KEY = ['dev-backend-restart']

export const RESTART_IN_PROGRESS = new Set(['stopping', 'starting'])

/** Le serveur n'accepte que localhost : inutile d'interroger la route depuis une autre machine. */
export const isLocalBrowser = ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname)

async function devFetch(url, options) {
  const res = await fetch(url, options)
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(body.error || `${res.status} ${res.statusText}`)
    err.status = res.status
    throw err
  }
  return body
}

export function useBackendRestartStatus() {
  return useQuery({
    queryKey: STATUS_KEY,
    queryFn: () => devFetch(STATUS_URL),
    enabled: isLocalBrowser,
    refetchInterval: (query) => (RESTART_IN_PROGRESS.has(query.state.data?.phase) ? 2000 : false),
    // On part souvent sur l'IDE pendant la compilation Maven : le suivi continue onglet masqué
    refetchIntervalInBackground: true,
  })
}

export function useRestartBackend() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => devFetch(RESTART_URL, { method: 'POST' }),
    // Succès comme 409 (redémarrage déjà lancé) : le statut relu déclenche le suivi
    onSettled: () => queryClient.invalidateQueries({ queryKey: STATUS_KEY }),
  })
}
