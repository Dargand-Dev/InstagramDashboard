import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, FolderOpen, Image, LoaderCircle, Pencil, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { apiPost, apiPut } from '@/lib/api'
import useProfilePictureTypes from '@/hooks/useProfilePictureTypes'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { SETTINGS_THEME } from './settingsTheme'

function ProfilePictureTypeDialog({ open, type, onOpenChange, onSave, isPending, error }) {
  const [label, setLabel] = useState(type?.label || '')
  const [driveFolderId, setDriveFolderId] = useState(type?.driveFolderId || '')
  const [submitted, setSubmitted] = useState(false)
  const invalidLabel = submitted && !label.trim()
  const invalidFolder = submitted && !driveFolderId.trim()
  const isEdit = Boolean(type)

  const handleSubmit = event => {
    event.preventDefault()
    if (isPending) return
    setSubmitted(true)
    if (!label.trim() || !driveFolderId.trim()) return
    onSave({ id: type?.id, label: label.trim(), driveFolderId: driveFolderId.trim() })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent style={SETTINGS_THEME} showCloseButton={!isPending}
        className="max-h-[90vh] overflow-y-auto sm:max-w-lg [&_[data-slot=input]]:h-10">
        <DialogHeader>
          <DialogTitle>{isEdit ? `Modifier ${type.label}` : 'Ajouter un type de photo de profil'}</DialogTitle>
          <DialogDescription>Associez ce type au dossier Google Drive qui contient ses photos. Les changements sont appliqués immédiatement.</DialogDescription>
        </DialogHeader>
        <form id="profile-picture-type-form" className="flex flex-col gap-5" noValidate onSubmit={handleSubmit} aria-busy={isPending}>
          <div className="flex flex-col gap-2" data-invalid={invalidLabel || undefined}>
            <Label htmlFor="profile-picture-type-label">Nom du type</Label>
            <Input id="profile-picture-type-label" value={label} onChange={event => setLabel(event.target.value)}
              placeholder="Ex. Rousse" required disabled={isPending} aria-invalid={invalidLabel || undefined}
              aria-describedby={invalidLabel ? 'profile-picture-type-label-error' : undefined} />
            {invalidLabel && <p id="profile-picture-type-label-error" className="text-sm text-destructive">Renseignez un nom pour ce type.</p>}
          </div>
          <div className="flex flex-col gap-2" data-invalid={invalidFolder || undefined}>
            <Label htmlFor="profile-picture-type-folder">Dossier Google Drive</Label>
            <Input id="profile-picture-type-folder" value={driveFolderId} onChange={event => setDriveFolderId(event.target.value)}
              placeholder="Identifiant du dossier Drive" required disabled={isPending} aria-invalid={invalidFolder || undefined}
              aria-describedby={invalidFolder ? 'profile-picture-type-folder-error' : 'profile-picture-type-folder-help'} />
            {invalidFolder ? <p id="profile-picture-type-folder-error" className="text-sm text-destructive">Renseignez l’identifiant du dossier Drive.</p>
              : <p id="profile-picture-type-folder-help" className="text-xs text-muted-foreground">Les photos de profil de ce type seront choisies dans ce dossier.</p>}
          </div>
          {error && <Alert variant="destructive"><AlertTriangle aria-hidden="true" /><AlertTitle>Enregistrement impossible</AlertTitle>
            <AlertDescription>{error.message || 'Réessayez dans quelques instants.'}</AlertDescription></Alert>}
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>Annuler</Button>
          <Button type="submit" form="profile-picture-type-form" disabled={isPending}>
            {isPending && <LoaderCircle data-icon="inline-start" className="animate-spin" aria-hidden="true" />}
            {isPending ? 'Enregistrement…' : isEdit ? 'Enregistrer les modifications' : 'Ajouter le type'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function ProfilePictureTypesSettings() {
  const queryClient = useQueryClient()
  const { types, isLoading, isFetching, error, refetch } = useProfilePictureTypes()
  const [dialog, setDialog] = useState({ open: false, type: null })
  const save = useMutation({
    mutationFn: ({ id, label, driveFolderId }) => id
      ? apiPut(`/api/profile-picture-types/${encodeURIComponent(id)}`, { label, driveFolderId })
      : apiPost('/api/profile-picture-types', { label, driveFolderId }),
    onSuccess: async (_result, payload) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['profile-picture-types'] }),
        queryClient.invalidateQueries({ queryKey: ['identities'] }),
      ])
      setDialog({ open: false, type: null })
      toast.success(payload.id ? 'Type de photo de profil mis à jour.' : 'Type de photo de profil ajouté.')
    },
  })

  const openDialog = type => {
    save.reset()
    setDialog({ open: true, type })
  }
  const changeDialogOpen = open => {
    if (!save.isPending) setDialog(previous => ({ open, type: open ? previous.type : null }))
  }
  const actionsDisabled = isLoading || Boolean(error) || save.isPending

  return (
    <>
      <Card className="min-w-0 gap-5 py-6 ring-border">
        <CardHeader className="px-5 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2"><Image className="size-4 text-primary" aria-hidden="true" />Photos de profil</CardTitle>
            <Button type="button" size="sm" onClick={() => openDialog(null)} disabled={actionsDisabled}>
              <Plus data-icon="inline-start" aria-hidden="true" />Ajouter un type
            </Button>
          </div>
          <CardDescription>Gérez les types de photos et leurs dossiers Google Drive, puis choisissez un type pour chaque identité.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 px-5 sm:px-6">
          {error && <Alert variant="destructive"><AlertTriangle aria-hidden="true" /><AlertTitle>Types de photos indisponibles</AlertTitle>
            <AlertDescription className="flex flex-col items-start gap-3">
              <p>{error.status === 404
                ? 'Redémarrez le serveur pour activer la gestion des types de photos de profil, puis réessayez.'
                : `Impossible de charger les types de photos de profil : ${error.message}`}</p>
              <Button type="button" variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
                {isFetching ? 'Chargement…' : 'Réessayer'}
              </Button>
            </AlertDescription></Alert>}
          {isLoading ? <div className="flex flex-col gap-3" aria-label="Chargement des types de photos de profil">
            <Skeleton className="h-20 w-full" /><Skeleton className="h-20 w-full" />
          </div> : types.length ? <ul className="flex flex-col gap-3">
            {types.map(type => <li key={type.id} className="flex flex-col gap-3 rounded-xl border border-border bg-background/40 p-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex min-w-0 flex-col gap-2">
                <p className="break-words font-medium text-foreground">{type.label}</p>
                <div className="flex min-w-0 items-start gap-2 text-sm text-muted-foreground">
                  <FolderOpen className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  <span className="min-w-0 break-all"><span className="sr-only">Dossier Google Drive : </span>{type.driveFolderId || 'Aucun dossier Drive associé'}</span>
                </div>
              </div>
              <Button type="button" variant="outline" size="sm" className="self-start" disabled={actionsDisabled}
                onClick={() => openDialog(type)} aria-label={`Modifier le type ${type.label}`}>
                <Pencil data-icon="inline-start" aria-hidden="true" />Modifier
              </Button>
            </li>)}
          </ul> : !error && <p className="text-sm text-muted-foreground">Aucun type de photo de profil configuré. Ajoutez un type pour l’associer à vos identités.</p>}
        </CardContent>
      </Card>
      <ProfilePictureTypeDialog key={dialog.open ? dialog.type?.id || 'new' : 'closed'} open={dialog.open} type={dialog.type}
        onOpenChange={changeDialogOpen} onSave={save.mutate} isPending={save.isPending} error={save.error} />
    </>
  )
}
