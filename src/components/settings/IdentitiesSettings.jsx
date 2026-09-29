import { SETTINGS_THEME } from './settingsTheme'
import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiDelete, apiGet, apiPost, apiPut } from '@/lib/api'
import useProfilePictureTypes from '@/hooks/useProfilePictureTypes'
import { getProfilePictureType, profilePictureSelection, profilePictureTypeLabel } from './profilePictureSelection'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import {
  AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { FolderOpen, Pencil, Plus, Trash2, Users } from 'lucide-react'
import { toast } from 'sonner'

function identityName(identity) {
  return identity.identityId || identity.name || identity.identityName || 'Identité sans nom'
}

function initials(name) {
  const words = name.trim().split(/[\s_-]+/).filter(Boolean)
  return words.slice(0, 2).map(word => word[0].toUpperCase()).join('') || '?'
}

function IdentityRow({ identity, pictureTypes, onEdit, onDelete }) {
  const name = identityName(identity)
  const folder = identity.driveFolderId || identity.driveFolder
  const pictureType = getProfilePictureType(identity)

  return (
    <li className="flex flex-col gap-3 rounded-xl border border-border bg-background/40 p-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 gap-3">
        <Avatar size="lg" className="bg-primary/15 text-primary">
          <AvatarFallback className="bg-primary/15 font-semibold text-primary">{initials(name)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 space-y-2">
          <p className="font-medium text-foreground">{name}</p>
          <div className="flex min-w-0 items-start gap-2 text-sm text-muted-foreground">
            <FolderOpen className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span className="min-w-0">
              <span className="sr-only">Dossier Google Drive : </span>
              {folder ? <span className="break-all" title={folder}>{folder}</span> : 'Aucun dossier Drive associé'}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {pictureType && <Badge variant="secondary">Photo : {profilePictureTypeLabel(pictureType, pictureTypes)}</Badge>}
            {identity.contentLoop && <Badge variant="secondary">Contenu en boucle</Badge>}
            {identity.gmsSourceLinkId && <Badge variant="outline" title={identity.gmsSourceLinkId}>Modèle GetMySocial lié</Badge>}
          </div>
        </div>
      </div>
      <div className="flex shrink-0 gap-2 pl-13 sm:pl-0">
        <Button type="button" variant="outline" size="sm" onClick={() => onEdit(identity)} aria-label={`Modifier ${name}`} title={`Modifier ${name}`}>
          <Pencil data-icon="inline-start" aria-hidden="true" />Modifier
        </Button>
        <Button type="button" variant="ghost" size="sm" className="text-destructive hover:text-destructive"
          onClick={() => onDelete(identity)} aria-label={`Supprimer ${name}`} title={`Supprimer ${name}`}>
          <Trash2 data-icon="inline-start" aria-hidden="true" />Supprimer
        </Button>
      </div>
    </li>
  )
}

function IdentityDialog({ open, onOpenChange, identity, onSave, isPending, pictureTypes, pictureTypesLoading, pictureTypesError }) {
  const [identityId, setIdentityId] = useState(identity?.identityId || identity?.name || identity?.identityName || '')
  const [driveFolderId, setDriveFolderId] = useState(identity?.driveFolderId || identity?.driveFolder || '')
  const [pictureType, setPictureType] = useState(() => getProfilePictureType(identity))
  const [gmsSourceLinkId, setGmsSourceLinkId] = useState(identity?.gmsSourceLinkId || '')
  const [contentLoop, setContentLoop] = useState(Boolean(identity?.contentLoop))
  const isEdit = Boolean(identity?.id)
  const pictureOptions = [{ value: 'NONE', label: 'Non définie' },
    ...pictureTypes.map(type => ({ value: type.id, label: type.label }))]
  if (pictureType && !pictureTypes.some(type => type.id === pictureType)) {
    pictureOptions.push({ value: pictureType, label: profilePictureTypeLabel(pictureType, pictureTypes) })
  }

  const handleSave = (event) => {
    event.preventDefault()
    if (!identityId.trim()) {
      toast.error('Renseignez un nom pour cette identité.')
      return
    }
    onSave({
      ...identity,
      identityId: identityId.trim(),
      driveFolderId: driveFolderId.trim(),
      ...profilePictureSelection(pictureType),
      gmsSourceLinkId: gmsSourceLinkId.trim() || null,
      contentLoop,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent style={SETTINGS_THEME} className="[&_[data-slot=input]]:h-10 [&_[data-slot=select-trigger]]:h-10 [&_[data-slot=switch-thumb]]:bg-white max-h-[min(90vh,48rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? `Modifier ${identityName(identity)}` : 'Nouvelle identité'}</DialogTitle>
          <DialogDescription>Les changements sont appliqués immédiatement après l’enregistrement.</DialogDescription>
        </DialogHeader>
        <form id="identity-settings-form" className="space-y-6" onSubmit={handleSave}>
          <fieldset className="space-y-4">
            <legend className="mb-3 text-sm font-semibold text-foreground">Identité et source de contenu</legend>
            <div className="space-y-2">
              <Label htmlFor="identity-settings-id">Nom de l’identité</Label>
              <Input id="identity-settings-id" value={identityId} onChange={event => setIdentityId(event.target.value)}
                placeholder="Ex. Sofia" disabled={isEdit || isPending} required aria-describedby={isEdit ? 'identity-settings-id-help' : undefined} />
              {isEdit && <p id="identity-settings-id-help" className="text-xs text-muted-foreground">L’identifiant ne peut pas être renommé après création.</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="identity-settings-folder">Dossier Google Drive</Label>
              <Input id="identity-settings-folder" value={driveFolderId} onChange={event => setDriveFolderId(event.target.value)}
                placeholder="Identifiant du dossier Drive" disabled={isPending} aria-describedby="identity-settings-folder-help" />
              <p id="identity-settings-folder-help" className="text-xs text-muted-foreground">Les Reels de cette identité seront lus dans ce dossier. Laissez vide si aucun dossier n’est associé.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="identity-settings-gms">Identifiant du modèle GetMySocial</Label>
              <Input id="identity-settings-gms" value={gmsSourceLinkId} onChange={event => setGmsSourceLinkId(event.target.value)}
                placeholder="lnk_…" disabled={isPending} aria-describedby="identity-settings-gms-help" />
              <p id="identity-settings-gms-help" className="text-xs text-muted-foreground">Facultatif. Lien vers le modèle utilisé pour les variantes de contenu.</p>
            </div>
          </fieldset>
          <fieldset className="space-y-4 border-t border-border pt-5">
            <legend className="mb-3 text-sm font-semibold text-foreground">Apparence et publication</legend>
            <div className="space-y-2">
              <Label htmlFor="identity-settings-picture">Photo de profil</Label>
              <Select items={pictureOptions} value={pictureType || 'NONE'} onValueChange={value => setPictureType(value === 'NONE' ? '' : value)}
                disabled={isPending || pictureTypesLoading || Boolean(pictureTypesError)}>
                <SelectTrigger id="identity-settings-picture" className="w-full" aria-label="Photo de profil" aria-describedby="identity-settings-picture-help">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent style={SETTINGS_THEME}><SelectGroup>
                  {pictureOptions.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                </SelectGroup></SelectContent>
              </Select>
              <p id="identity-settings-picture-help" className="text-xs text-muted-foreground">
                {pictureTypesLoading ? 'Chargement des types de photos…' : pictureTypesError
                  ? 'Types de photos indisponibles. Réessayez depuis la section Photos de profil.'
                  : 'Choisissez un type de photos. Ajoutez vos types et leurs dossiers Drive dans la section Photos de profil ci-dessous.'}
              </p>
            </div>
            <div className="flex items-start justify-between gap-4 rounded-lg border border-border p-4">
              <div className="space-y-1">
                <Label htmlFor="identity-settings-loop">Contenu en boucle</Label>
                <p id="identity-settings-loop-help" className="text-xs leading-relaxed text-muted-foreground">Les vidéos restent disponibles et chaque compte les republie avec une variante unique.</p>
              </div>
              <Switch id="identity-settings-loop" checked={contentLoop} onCheckedChange={setContentLoop}
                disabled={isPending} aria-describedby="identity-settings-loop-help" />
            </div>
          </fieldset>
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>Annuler</Button>
          <Button type="submit" form="identity-settings-form" disabled={isPending}>
            {isPending ? 'Enregistrement…' : isEdit ? 'Enregistrer les modifications' : 'Créer l’identité'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function IdentitiesSettings() {
  const queryClient = useQueryClient()
  const { types: pictureTypes, isLoading: pictureTypesLoading, error: pictureTypesError } = useProfilePictureTypes()
  const [identityDialog, setIdentityDialog] = useState({ open: false, identity: null })
  const [deleteTarget, setDeleteTarget] = useState(null)
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['identities'],
    queryFn: () => apiGet('/api/identities'),
  })
  const identities = useMemo(() => {
    const raw = data?.data || data || []
    return Array.isArray(raw) ? raw : []
  }, [data])

  const createIdentity = useMutation({
    mutationFn: payload => apiPost('/api/identities', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['identities'] })
      setIdentityDialog({ open: false, identity: null })
      toast.success('Identité créée. Changements appliqués immédiatement.')
    },
    onError: failure => toast.error(failure.message || 'Impossible de créer l’identité.'),
  })
  const updateIdentity = useMutation({
    mutationFn: payload => apiPut(`/api/identities/${encodeURIComponent(payload.identityId)}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['identities'] })
      setIdentityDialog({ open: false, identity: null })
      toast.success('Identité mise à jour. Changements appliqués immédiatement.')
    },
    onError: failure => toast.error(failure.message || 'Impossible de modifier l’identité.'),
  })
  const deleteIdentity = useMutation({
    mutationFn: identityId => apiDelete(`/api/identities/${encodeURIComponent(identityId)}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['identities'] })
      setDeleteTarget(null)
      toast.success('Identité supprimée. Changement appliqué immédiatement.')
    },
    onError: failure => toast.error(failure.message || 'Impossible de supprimer l’identité.'),
  })

  const saveIdentity = payload => {
    if (payload.id) updateIdentity.mutate(payload)
    else createIdentity.mutate(payload)
  }

  return (
    <>
      <Card className="min-w-0 gap-5 py-6 ring-border">
        <CardHeader className="px-5 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2"><Users className="size-4 text-primary" aria-hidden="true" />Identités</CardTitle>
            <Button type="button" size="sm" onClick={() => setIdentityDialog({ open: true, identity: null })}>
              <Plus data-icon="inline-start" aria-hidden="true" />Nouvelle identité
            </Button>
          </div>
          <CardDescription>Associez chaque identité à ses sources de contenu. Les modifications sont appliquées immédiatement.</CardDescription>
        </CardHeader>
        <CardContent className="px-5 sm:px-6">
          {isLoading && !data ? (
            <div className="space-y-3" aria-label="Chargement des identités">
              {[1, 2, 3].map(index => <Skeleton key={index} className="h-20 w-full" />)}
            </div>
          ) : error && !data ? (
            <div className="space-y-3 rounded-xl border border-destructive/30 p-5">
              <p className="text-sm text-destructive">Impossible de charger les identités : {error.message}</p>
              <Button type="button" variant="outline" size="sm" onClick={() => refetch()}>Réessayer</Button>
            </div>
          ) : identities.length ? (
            <ul className="space-y-3">
              {identities.map(identity => <IdentityRow key={identity.id || identity.identityId} identity={identity} pictureTypes={pictureTypes}
                onEdit={selected => setIdentityDialog({ open: true, identity: selected })} onDelete={setDeleteTarget} />)}
            </ul>
          ) : (
            <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed border-border p-6">
              <Users className="size-6 text-muted-foreground" aria-hidden="true" />
              <div>
                <p className="font-medium text-foreground">Aucune identité configurée</p>
                <p className="mt-1 text-sm text-muted-foreground">Créez une identité pour regrouper vos comptes et choisir leur dossier de Reels.</p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => setIdentityDialog({ open: true, identity: null })}>
                <Plus data-icon="inline-start" aria-hidden="true" />Créer une identité
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <IdentityDialog key={identityDialog.open ? (identityDialog.identity?.id ?? 'new') : 'closed'}
        open={identityDialog.open} identity={identityDialog.identity}
        onOpenChange={open => setIdentityDialog({ open, identity: open ? identityDialog.identity : null })}
        onSave={saveIdentity} isPending={createIdentity.isPending || updateIdentity.isPending}
        pictureTypes={pictureTypes} pictureTypesLoading={pictureTypesLoading} pictureTypesError={pictureTypesError} />

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={open => { if (!open && !deleteIdentity.isPending) setDeleteTarget(null) }}>
        <AlertDialogContent style={SETTINGS_THEME}>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette identité ?</AlertDialogTitle>
            <AlertDialogDescription>
              L’identité <strong className="text-foreground">{deleteTarget ? identityName(deleteTarget) : ''}</strong> sera supprimée immédiatement.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleteIdentity.isPending}>Annuler</Button>
            <Button type="button" variant="destructive" disabled={deleteIdentity.isPending || !deleteTarget}
              onClick={() => deleteIdentity.mutate(deleteTarget.identityId)}>
              {deleteIdentity.isPending ? 'Suppression…' : 'Supprimer l’identité'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
