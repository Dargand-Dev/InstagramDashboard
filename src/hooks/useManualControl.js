import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { apiPost } from '@/lib/api'
import { useManualControlStore } from '@/stores/manualControlStore'

/**
 * Hook React Query pour les actions take/release individuelles.
 *
 * - takeControl({ udid, deviceName }) : POST + ajoute la session au store.
 * - release(udid, options?) : POST + retire la session du store.
 *
 * Plusieurs sessions peuvent coexister — pas de single-active enforcement ici.
 */
export function useManualControl() {
  const queryClient = useQueryClient()
  const setSession = useManualControlStore((s) => s.setSession)
  const removeSession = useManualControlStore((s) => s.removeSession)

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
      setSession(udid, {
        udid,
        deviceName: deviceName || udid,
        vncUrl: data.vncUrl,
        deviceIp: data.deviceIp,
        since: data.since,
      })
      queryClient.invalidateQueries({ queryKey: ['devices-live'] })
    },
    onError: (err) => {
      toast.error(err.message || 'Take control échoué')
    },
  })

  const release = useMutation({
    mutationFn: (udid) => apiPost(`/api/devices/${udid}/release-control`, {}),
    onSuccess: (_data, udid) => {
      removeSession(udid)
      queryClient.invalidateQueries({ queryKey: ['devices-live'] })
      queryClient.invalidateQueries({ queryKey: ['queue'] })
    },
    onError: (err) => {
      toast.error(err.message || 'Release échoué')
    },
  })

  return {
    takeControl: takeControl.mutate,
    release: (udid, options) => release.mutate(udid, options),
    isTaking: takeControl.isPending,
    isReleasing: release.isPending,
  }
}
