import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle, CardAction } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select'
import EmptyState from '@/components/shared/EmptyState'
import SmsProvidersCard from '@/components/settings/SmsProvidersCard'
import ApplicationSettingsCard from '@/components/settings/ApplicationSettingsCard'
import BackendRestartControl from '@/components/settings/BackendRestartControl'
import { toast } from 'sonner'
import {
  Users, Server,
  Lock, Plus, Pencil, Trash2, Eye, EyeOff,
} from 'lucide-react'

function IdentityRow({ identity, onEdit, onDelete }) {
  const hairLabel = identity.hairColor === 'BLONDE'
    ? 'Blonde'
    : identity.hairColor === 'BRUNETTE'
      ? 'Brune'
      : null
  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-[#0A0A0A] border border-[#1a1a1a] group">
      <div className="min-w-0 flex items-center gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-[#FAFAFA]">{identity.identityId || identity.name || identity.identityName}</p>
          {(identity.driveFolderId || identity.driveFolder) && (
            <p className="text-xs text-[#52525B] mt-0.5 truncate">{identity.driveFolderId || identity.driveFolder}</p>
          )}
        </div>
        {hairLabel && (
          <Badge variant="outline" className="bg-[#1a1a1a] text-[#A1A1AA] border-[#27272A] text-[10px] uppercase">
            {hairLabel}
          </Badge>
        )}
        {identity.contentLoop && (
          <Badge variant="outline" className="bg-[#1a1a1a] text-[#A1A1AA] border-[#27272A] text-[10px] uppercase">
            Boucle
          </Badge>
        )}
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button variant="ghost" size="icon-xs" className="text-[#52525B] hover:text-[#A1A1AA]" onClick={() => onEdit(identity)}>
          <Pencil className="w-3 h-3" />
        </Button>
        <Button variant="ghost" size="icon-xs" className="text-[#52525B] hover:text-[#EF4444]" onClick={() => onDelete(identity)}>
          <Trash2 className="w-3 h-3" />
        </Button>
      </div>
    </div>
  )
}

function IdentityDialog({ open, onOpenChange, identity, onSave, isPending }) {
  const [name, setName] = useState(identity?.identityId || identity?.name || identity?.identityName || '')
  const [driveFolder, setDriveFolder] = useState(identity?.driveFolderId || identity?.driveFolder || '')
  const [hairColor, setHairColor] = useState(identity?.hairColor || '')
  const [gmsSourceLinkId, setGmsSourceLinkId] = useState(identity?.gmsSourceLinkId || '')
  const [contentLoop, setContentLoop] = useState(!!identity?.contentLoop)

  const isEdit = !!identity?.id

  const handleSave = () => {
    if (!name.trim()) { toast.error('Le nom est obligatoire'); return }
    onSave({
      ...identity,
      identityId: name.trim(),
      driveFolderId: driveFolder.trim(),
      hairColor: hairColor || null,
      gmsSourceLinkId: gmsSourceLinkId.trim() || null,
      contentLoop,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#111111] border-[#1a1a1a] text-[#FAFAFA] max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm">{isEdit ? 'Modifier une identité' : 'Ajouter une identité'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label className="text-xs text-[#A1A1AA]">Nom</Label>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Nom de l’identité"
              className="bg-[#0A0A0A] border-[#1a1a1a] text-[#FAFAFA]"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-[#A1A1AA]">Dossier Drive (facultatif)</Label>
            <Input
              value={driveFolder}
              onChange={e => setDriveFolder(e.target.value)}
              placeholder="Identifiant ou chemin du dossier Google Drive"
              className="bg-[#0A0A0A] border-[#1a1a1a] text-[#FAFAFA]"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-[#A1A1AA]">Identifiant du modèle GetMySocial (facultatif)</Label>
            <Input
              value={gmsSourceLinkId}
              onChange={e => setGmsSourceLinkId(e.target.value)}
              placeholder="lnk_…"
              className="bg-[#0A0A0A] border-[#1a1a1a] text-[#FAFAFA]"
            />
          </div>
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-[#A1A1AA]">Contenu en boucle (spoofé)</Label>
              <p className="text-[11px] text-[#52525B]">
                Les vidéos ne sont plus mises à la corbeille : chaque compte les reposte en boucle, et chaque post est une variante unique.
              </p>
            </div>
            <Switch checked={contentLoop} onCheckedChange={setContentLoop} size="sm" />
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-[#A1A1AA]">Couleur de cheveux</Label>
            <Select value={hairColor || 'NONE'} onValueChange={(v) => setHairColor(v === 'NONE' ? '' : v)}>
              <SelectTrigger className="bg-[#0A0A0A] border-[#1a1a1a] text-[#FAFAFA]">
                <SelectValue placeholder="Non défini" />
              </SelectTrigger>
              <SelectContent className="bg-[#111111] border-[#1a1a1a] text-[#FAFAFA]">
                <SelectItem value="NONE">— Non défini —</SelectItem>
                <SelectItem value="BLONDE">Blonde</SelectItem>
                <SelectItem value="BRUNETTE">Brune</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="text-[#A1A1AA]">Annuler</Button>
          <Button size="sm" className="bg-[#3B82F6] hover:bg-[#2563EB] text-white" onClick={handleSave} disabled={isPending}>
            {isPending ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function Settings() {
  const queryClient = useQueryClient()
  const [identityDialog, setIdentityDialog] = useState({ open: false, identity: null })
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [showPassword, setShowPassword] = useState(false)
  const [passwordForm, setPasswordForm] = useState({ current: '', new: '', confirm: '' })

  // Queries
  const { data: identitiesData, isLoading: identitiesLoading } = useQuery({
    queryKey: ['identities'],
    queryFn: () => apiGet('/api/identities'),
  })

  const identities = useMemo(() => {
    const raw = identitiesData?.data || identitiesData || []
    return Array.isArray(raw) ? raw : []
  }, [identitiesData])

  // Identity mutations
  const createIdentity = useMutation({
    mutationFn: (data) => apiPost('/api/identities', data),
    onSuccess: () => {
      toast.success('Identité créée')
      queryClient.invalidateQueries({ queryKey: ['identities'] })
      setIdentityDialog({ open: false, identity: null })
    },
  })

  const updateIdentity = useMutation({
    mutationFn: (data) => apiPut(`/api/identities/${data.identityId}`, data),
    onSuccess: () => {
      toast.success('Identité mise à jour')
      queryClient.invalidateQueries({ queryKey: ['identities'] })
      setIdentityDialog({ open: false, identity: null })
    },
  })

  const deleteIdentity = useMutation({
    mutationFn: (id) => apiDelete(`/api/identities/${id}`),
    onSuccess: () => {
      toast.success('Identité supprimée')
      queryClient.invalidateQueries({ queryKey: ['identities'] })
      setDeleteTarget(null)
    },
  })

  const handleSaveIdentity = (data) => {
    if (data.id) updateIdentity.mutate(data)
    else createIdentity.mutate(data)
  }

  // Password change
  const changePassword = useMutation({
    mutationFn: (data) => apiPost('/api/auth/change-password', data),
    onSuccess: () => {
      toast.success('Mot de passe modifié')
      setPasswordForm({ current: '', new: '', confirm: '' })
    },
  })

  const handleChangePassword = () => {
    if (!passwordForm.current || !passwordForm.new) {
      toast.error('Renseignez tous les champs')
      return
    }
    if (passwordForm.new !== passwordForm.confirm) {
      toast.error('Les mots de passe ne correspondent pas')
      return
    }
    if (passwordForm.new.length < 6) {
      toast.error('Le mot de passe doit contenir au moins 6 caractères')
      return
    }
    changePassword.mutate({
      currentPassword: passwordForm.current,
      newPassword: passwordForm.new,
    })
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-[#FAFAFA]">Configuration</h1>

      <ApplicationSettingsCard />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* SMS Providers */}
        <SmsProvidersCard />

        {/* Identities */}
        <Card className="bg-[#111111] border-[#1a1a1a]">
          <CardHeader>
            <CardTitle className="text-sm text-[#A1A1AA] flex items-center gap-2">
              <Users className="w-4 h-4 text-[#8B5CF6]" />
              Identités
            </CardTitle>
            <CardAction>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-[#3B82F6] hover:text-[#3B82F6] hover:bg-[#3B82F6]/10"
                onClick={() => setIdentityDialog({ open: true, identity: null })}
              >
                <Plus className="w-3 h-3 mr-1" />Ajouter
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            {identitiesLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full bg-[#1a1a1a]" />)}
              </div>
            ) : identities.length > 0 ? (
              <div className="space-y-2">
                {identities.map(id => (
                  <IdentityRow
                    key={id.id || id.name}
                    identity={id}
                    onEdit={(identity) => setIdentityDialog({ open: true, identity })}
                    onDelete={(identity) => setDeleteTarget(identity)}
                  />
                ))}
              </div>
            ) : (
              <EmptyState icon={Users} title="Aucune identité" description="Ajoutez une première identité pour commencer" />
            )}
          </CardContent>
        </Card>

        {/* Auth Settings */}
        <Card className="bg-[#111111] border-[#1a1a1a]">
          <CardHeader>
            <CardTitle className="text-sm text-[#A1A1AA] flex items-center gap-2">
              <Lock className="w-4 h-4 text-[#F59E0B]" />
              Authentification
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs text-[#A1A1AA]">Mot de passe actuel</Label>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={passwordForm.current}
                    onChange={e => setPasswordForm(p => ({ ...p, current: e.target.value }))}
                    className="bg-[#0A0A0A] border-[#1a1a1a] text-[#FAFAFA] pr-9"
                  />
                  <button
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#52525B] hover:text-[#A1A1AA]"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-[#A1A1AA]">Nouveau mot de passe</Label>
                <Input
                  type="password"
                  value={passwordForm.new}
                  onChange={e => setPasswordForm(p => ({ ...p, new: e.target.value }))}
                  className="bg-[#0A0A0A] border-[#1a1a1a] text-[#FAFAFA]"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-[#A1A1AA]">Confirmer le nouveau mot de passe</Label>
                <Input
                  type="password"
                  value={passwordForm.confirm}
                  onChange={e => setPasswordForm(p => ({ ...p, confirm: e.target.value }))}
                  className="bg-[#0A0A0A] border-[#1a1a1a] text-[#FAFAFA]"
                />
              </div>
              <Button
                size="sm"
                className="bg-[#3B82F6] hover:bg-[#2563EB] text-white"
                onClick={handleChangePassword}
                disabled={changePassword.isPending}
              >
                {changePassword.isPending ? 'Modification…' : 'Modifier le mot de passe'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* System Info */}
        <Card className="bg-[#111111] border-[#1a1a1a]">
          <CardHeader>
            <CardTitle className="text-sm text-[#A1A1AA] flex items-center gap-2">
              <Server className="w-4 h-4 text-[#22C55E]" />
              Système
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { label: 'Dashboard', value: 'v2.0.0' },
                { label: 'API Backend', value: 'localhost:8081' },
                { label: 'Framework', value: 'React 19 + Vite' },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between py-2 border-b border-[#1a1a1a] last:border-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[#52525B]">{label}</span>
                  </div>
                  <span className="text-xs text-[#A1A1AA] font-mono">{value}</span>
                </div>
              ))}
              {import.meta.env.DEV && <BackendRestartControl />}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Identity Dialog */}
      <IdentityDialog
        // Remonte la modale à chaque ouverture : ses useState ne lisent `identity` qu'au montage,
        // sans cette clé l'édition affichait (et renvoyait) les valeurs d'une autre identity.
        key={identityDialog.open ? (identityDialog.identity?.id ?? 'new') : 'closed'}
        open={identityDialog.open}
        onOpenChange={(open) => setIdentityDialog({ open, identity: open ? identityDialog.identity : null })}
        identity={identityDialog.identity}
        onSave={handleSaveIdentity}
        isPending={createIdentity.isPending || updateIdentity.isPending}
      />

      {/* Delete Confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="bg-[#111111] border-[#1a1a1a] text-[#FAFAFA] max-w-sm">
          <DialogHeader>
          <DialogTitle className="text-sm">Supprimer l’identité</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-[#A1A1AA]">
            Voulez-vous supprimer <span className="text-[#FAFAFA] font-medium">{deleteTarget?.identityId || deleteTarget?.name || deleteTarget?.identityName}</span> ?
          </p>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(null)} className="text-[#A1A1AA]">Annuler</Button>
            <Button
              size="sm"
              className="bg-[#EF4444] hover:bg-[#DC2626] text-white"
              onClick={() => deleteIdentity.mutate(deleteTarget.identityId)}
              disabled={deleteIdentity.isPending}
            >
              {deleteIdentity.isPending ? 'Suppression…' : 'Supprimer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
