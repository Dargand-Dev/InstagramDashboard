import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { apiPost } from '@/lib/api'
import { useManualControlStore } from '@/stores/manualControlStore'

/**
 * Hook React Query pour les actions take/release.
 * - takeControl({ udid, deviceName }) : POST + peuple le store en cas de succès.
 * - release(udid) : POST + vide le store en cas de succès.
 */
export function useManualControl() {
  const queryClient = useQueryClient()
  const { setActive, clear } = useManualControlStore()

  const takeControl = useMutation({
    mutationFn: ({ udid }) => apiPost(`/api/devices/${udid}/take-control`, {}),
    onSuccess: (data, { udid, deviceName }) => {
      // api.js convertit un 423 en { locked: true, ... } sans throw.
      if (data?.locked) {
        toast.error(data.message || 'Device verrouillé par une autre opération')
        return
      }
      if (!data?.vncUrl) {
        toast.error('Réponse take-control invalide (vncUrl manquant)')
        return
      }
      setActive({
        udid,
        deviceName: deviceName || udid,
        vncUrl: data.vncUrl,
        deviceIp: data.deviceIp,
        since: data.since,
      })
      queryClient.invalidateQueries({ queryKey: ['devices-live'] })
      if (data.killed) {
        queryClient.invalidateQueries({ queryKey: ['queue'] })
        toast.warning(`Tâche ${data.killed.actionName || ''} arrêtée pour prendre la main`)
      }
    },
    onError: (err) => {
      toast.error(err.message || 'Take control échoué')
    },
  })

  const release = useMutation({
    mutationFn: (udid) => apiPost(`/api/devices/${udid}/release-control`, {}),
    onSuccess: () => {
      clear()
      queryClient.invalidateQueries({ queryKey: ['devices-live'] })
      queryClient.invalidateQueries({ queryKey: ['queue'] })
    },
    onError: (err) => {
      toast.error(err.message || 'Release échoué')
    },
  })

  return {
    takeControl: takeControl.mutate,
    // mutate accepte (vars, options) — on propage le 2e arg pour permettre
    // un onSuccess per-call (utile pour ne fermer la modale qu'au succès).
    release: (udid, options) => release.mutate(udid, options),
    isTaking: takeControl.isPending,
    isReleasing: release.isPending,
  }
}
