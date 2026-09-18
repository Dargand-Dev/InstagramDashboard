import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiPost, apiPut } from '@/lib/api'

const BASE = '/api/devices'

/**
 * Outillage de containers d'un téléphone : doritos ou crane+ghost.
 *
 * Le backend expose `effectiveBackend` (calculé : manuel > détecté > défaut) sur chaque device,
 * pour que la règle de priorité n'existe qu'à un seul endroit. Ne pas la réimplémenter ici.
 */
export const CONTAINER_BACKENDS = {
  DORITOS: { label: 'Doritos', color: '#8B5CF6' },
  CRANE_GHOST: { label: 'Crane + Ghost', color: '#F59E0B' },
}

export function backendLabel(backend) {
  return CONTAINER_BACKENDS[backend]?.label || backend || 'Inconnu'
}

export function backendColor(backend) {
  return CONTAINER_BACKENDS[backend]?.color || '#52525B'
}

/** `null` remet le device en automatique : c'est alors la détection qui décide. */
export function useUpdateContainerBackend() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, backend }) =>
      apiPut(`${BASE}/${encodeURIComponent(id)}/container-backend`, { backend: backend ?? null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices-config'] })
    },
  })
}

/**
 * Sonde le téléphone par SSH pour découvrir l'outillage installé.
 *
 * Indispensable pour rebrancher un ancien téléphone : la sonde du démarrage ne couvre que les
 * devices activés, or celui qu'on rebranche est encore désactivé.
 */
export function useDetectContainerBackend() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id }) => apiPost(`${BASE}/${encodeURIComponent(id)}/detect-backend`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices-config'] })
    },
  })
}

/** Édition des presets Ghost, via le PATCH partiel générique du device. */
export function useUpdateGhostPresets() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, presets }) =>
      apiPut(`${BASE}/${encodeURIComponent(id)}`, { presets }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices-config'] })
    },
  })
}
