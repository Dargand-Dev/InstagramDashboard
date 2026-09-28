import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPut } from '@/lib/api'
import { toast } from 'sonner'
import { presentSettingsGroups } from './settingsPresentation'
import { changeForValue, makeApplicationSettingsPayload, updateApplicationSettingsDraft } from './applicationSettingsDraft'

const SETTINGS_URL = '/api/settings/application'

export default function useApplicationSettings() {
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState({ baseRevision: null, changes: {}, conflict: false })
  const { data: response, isLoading, error, refetch } = useQuery({
    queryKey: ['application-settings'],
    queryFn: () => apiGet(SETTINGS_URL),
  })
  const snapshot = response?.data ?? response
  const changes = draft.changes
  const dirtyCount = Object.keys(changes).length
  const needsReview = dirtyCount > 0 && (draft.conflict || draft.baseRevision !== snapshot?.revision)

  const save = useMutation({
    mutationFn: payload => apiPut(SETTINGS_URL, payload),
    onSuccess: result => {
      queryClient.setQueryData(['application-settings'], result)
      setDraft({ baseRevision: null, changes: {}, conflict: false })
      const saved = result?.data ?? result
      toast.success(saved.restartRequired
        ? 'Configuration enregistrée. Redémarrez le backend pour appliquer les changements.'
        : 'Configuration enregistrée.')
    },
    onError: async failure => {
      if (failure.status === 409) {
        setDraft(previous => ({ ...previous, conflict: true }))
        await refetch()
        toast.error('La configuration a changé sur le serveur. Vérifiez votre brouillon avant de reprendre sur la nouvelle version.')
      } else {
        toast.error(failure.message || 'Impossible d’enregistrer la configuration')
      }
    },
  })

  const setValue = (field, value) => setDraft(previous =>
    updateApplicationSettingsDraft(previous, snapshot.revision, field.key, changeForValue(field, value)))
  const setReset = field => setDraft(previous =>
    updateApplicationSettingsDraft(previous, snapshot.revision, field.key, { action: 'reset' }))
  const undo = field => setDraft(previous =>
    updateApplicationSettingsDraft(previous, snapshot.revision, field.key, null))
  const clearSecret = field => setDraft(previous => {
    const wasCleared = previous.changes[field.key]?.action === 'update' && previous.changes[field.key].value === ''
    return updateApplicationSettingsDraft(previous, snapshot.revision, field.key, wasCleared ? null : { action: 'update', value: '' })
  })
  const discard = () => {
    setDraft({ baseRevision: null, changes: {}, conflict: false })
  }
  const rebase = async () => {
    const latest = await refetch()
    const current = latest.data?.data ?? latest.data
    if (latest.isError || !current?.revision) {
      toast.error('Impossible de charger la version actuelle. Réessayez avant d’enregistrer.')
      return
    }
    setDraft(previous => ({ ...previous, baseRevision: current.revision, conflict: false }))
    toast.success('Brouillon repris sur la version actuelle. Vérifiez les valeurs avant de l’enregistrer.')
  }
  const handleSave = () => {
    if (needsReview) return
    try {
      save.mutate(makeApplicationSettingsPayload({ ...snapshot, groups: presentSettingsGroups(snapshot.groups) }, changes, draft.baseRevision))
    } catch (failure) {
      toast.error(failure.message)
    }
  }

  return { snapshot, changes, dirtyCount, needsReview, isLoading, error, refetch, saving: save.isPending, setValue, setReset, undo, clearSecret, discard, rebase, save: handleSave }
}
