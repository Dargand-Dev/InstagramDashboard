import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPut } from '@/lib/api'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { AlertTriangle, Plus, RotateCcw, Save, Search, Settings2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { changeForValue, makeApplicationSettingsPayload, updateApplicationSettingsDraft } from './applicationSettingsDraft'

const SETTINGS_URL = '/api/settings/application'

function displayValue(field, value) {
  if (field.secret) return field.activeConfigured ? 'Secret configuré' : 'Secret absent'
  if (value == null) return 'Non défini'
  if (field.type === 'boolean') return value ? 'Activé' : 'Désactivé'
  if (field.type === 'string-list') return value.length ? value.join(', ') : 'Liste vide'
  if (field.type === 'windows') return value.length ? value.map(w => `${w.start}–${w.end}`).join(', ') : 'Aucun créneau'
  return String(value)
}

function ArrayEditor({ field, value, onChange, disabled }) {
  const entries = Array.isArray(value) ? value : []
  const isWindows = field.type === 'windows'
  const replace = (index, entry) => onChange(entries.map((current, i) => i === index ? entry : current))

  return (
    <div className="flex flex-col gap-2">
      {entries.map((entry, index) => (
        <div key={index} className="flex min-w-0 items-center gap-2">
          {isWindows ? (
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <Input type="time" step="60" aria-label={`${field.label}, créneau ${index + 1}, début`} value={entry.start ?? ''}
                onChange={event => replace(index, { ...entry, start: event.target.value })} disabled={disabled} />
              <span className="text-muted-foreground">–</span>
              <Input type="time" step="60" aria-label={`${field.label}, créneau ${index + 1}, fin`} value={entry.end ?? ''}
                onChange={event => replace(index, { ...entry, end: event.target.value })} disabled={disabled} />
            </div>
          ) : (
            <Input className="min-w-0 flex-1" aria-label={`${field.label}, élément ${index + 1}`} value={entry}
              onChange={event => replace(index, event.target.value)} disabled={disabled} />
          )}
          <Button type="button" variant="ghost" size="icon-sm" aria-label={`Supprimer ${isWindows ? 'le créneau' : "l'élément"} ${index + 1}`}
            onClick={() => onChange(entries.filter((_, i) => i !== index))} disabled={disabled}>
            <Trash2 />
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => onChange([...entries, isWindows ? { start: '', end: '' } : ''])} disabled={disabled}>
        <Plus data-icon="inline-start" />Ajouter {isWindows ? 'un créneau' : 'un élément'}
      </Button>
    </div>
  )
}

function FieldControl({ field, value, change, onChange, onClearSecret, disabled }) {
  if (change?.action === 'reset') {
    return <p className="text-sm text-muted-foreground">Valeur héritée après enregistrement</p>
  }
  if (field.type === 'boolean') {
    return <Switch id={`setting-${field.key}`} checked={Boolean(value)} onCheckedChange={onChange} disabled={disabled} aria-label={field.label} />
  }
  if (field.type === 'string-list' || field.type === 'windows') {
    return <ArrayEditor field={field} value={value} onChange={onChange} disabled={disabled} />
  }
  if (field.options?.length) {
    return (
      <Select value={String(value ?? '')} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger className="w-full" aria-label={field.label}>
          <SelectValue placeholder="Choisir une valeur">{selected => selected || 'Choisir une valeur'}</SelectValue>
        </SelectTrigger>
        <SelectContent><SelectGroup>{field.options.map(option => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectGroup></SelectContent>
      </Select>
    )
  }
  if (field.secret) {
    return (
      <div className="flex min-w-0 gap-2">
        <Input id={`setting-${field.key}`} type="password" autoComplete="new-password" className="min-w-0 flex-1"
          value={change?.action === 'update' ? change.value : ''} onChange={event => onChange(event.target.value)}
          placeholder={field.configured ? 'Secret configuré — vide = inchangé' : 'Saisir un secret'} disabled={disabled} />
        <Button type="button" variant="outline" size="sm" onClick={onClearSecret} disabled={disabled || (!field.configured && !change)}>
          {change?.action === 'update' && change.value === '' ? 'Annuler' : 'Effacer'}
        </Button>
      </div>
    )
  }
  return (
    <Input id={`setting-${field.key}`} type={field.type === 'integer' || field.type === 'number' ? 'number' : 'text'}
      step={field.type === 'integer' ? '1' : field.type === 'number' ? 'any' : undefined}
      min={field.min ?? undefined} max={field.max ?? undefined} value={value ?? ''}
      onChange={event => onChange(event.target.value)} disabled={disabled} />
  )
}

function SettingRow({ field, change, onChange, onReset, onUndo, onClearSecret, disabled }) {
  const value = change?.action === 'update' ? change.value : field.value
  const showActive = field.pendingRestart && !field.secret

  return (
    <div className="grid min-w-0 gap-3 border-b border-border py-4 last:border-b-0 md:grid-cols-[minmax(0,1fr)_minmax(16rem,1fr)] md:gap-6">
      <div className="min-w-0 flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <Label htmlFor={`setting-${field.key}`} className="font-medium">{field.label || field.key}</Label>
          {field.overridden && <Badge variant="secondary">Personnalisé</Badge>}
          {field.pendingRestart && <Badge variant="outline">En attente</Badge>}
          {field.blockedByExternalOverride && <Badge variant="outline">Surcharge au lancement</Badge>}
          {change && <Badge>Modifié</Badge>}
        </div>
        <code className="break-all text-xs text-muted-foreground">{field.key}</code>
        {field.description && <p className="text-xs leading-relaxed text-muted-foreground">{field.description}</p>}
        {showActive && <p className="text-xs text-muted-foreground">Valeur actuellement active : {displayValue(field, field.activeValue)}</p>}
        {field.secret && <p className="text-xs text-muted-foreground">{field.configured ? 'Secret enregistré' : 'Aucun secret enregistré'} · La valeur n’est jamais affichée.</p>}
      </div>
      <div className="flex min-w-0 flex-col gap-2">
        <FieldControl field={field} value={value} change={change} onChange={onChange} onClearSecret={onClearSecret} disabled={disabled} />
        <div className="flex flex-wrap gap-2">
          {change && <Button type="button" variant="ghost" size="sm" onClick={onUndo} disabled={disabled}>Annuler la modification</Button>}
          {field.overridden && change?.action !== 'reset' && (
            <Button type="button" variant="ghost" size="sm" onClick={onReset} disabled={disabled}>
              <RotateCcw data-icon="inline-start" />Valeur héritée
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

function DraftActions({ dirtyCount, isPending, needsReview, onDiscard, onSave }) {
  return (
    <div className="flex w-full flex-wrap items-center justify-between gap-3">
      <span className="text-sm text-muted-foreground">
        {dirtyCount ? `${dirtyCount} modification${dirtyCount > 1 ? 's' : ''} non enregistrée${dirtyCount > 1 ? 's' : ''}` : 'Aucune modification en cours'}
      </span>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={onDiscard} disabled={!dirtyCount || isPending}>Tout annuler</Button>
        <Button type="button" onClick={onSave} disabled={!dirtyCount || isPending || needsReview}>
          <Save data-icon="inline-start" />{isPending ? 'Enregistrement…' : 'Enregistrer'}
        </Button>
      </div>
    </div>
  )
}

export default function ApplicationSettingsCard() {
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState({ baseRevision: null, changes: {}, conflict: false })
  const [category, setCategory] = useState('all')
  const [search, setSearch] = useState('')
  const { data: response, isLoading, error, refetch } = useQuery({
    queryKey: ['application-settings'],
    queryFn: () => apiGet(SETTINGS_URL),
  })
  const snapshot = response?.data ?? response
  const changes = draft.changes
  const groups = useMemo(() => snapshot?.groups ?? [], [snapshot])
  const fieldCount = groups.reduce((count, group) => count + group.fields.length, 0)
  const visibleGroups = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('fr-FR')
    return groups
      .filter(group => category === 'all' || group.id === category)
      .map(group => ({ ...group, fields: group.fields.filter(field => !term ||
        `${field.key} ${field.label ?? ''} ${field.description ?? ''}`.toLocaleLowerCase('fr-FR').includes(term)) }))
      .filter(group => group.fields.length)
  }, [groups, category, search])
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
      save.mutate(makeApplicationSettingsPayload(snapshot, changes, draft.baseRevision))
    } catch (failure) {
      toast.error(failure.message)
    }
  }

  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Settings2 />Configuration de l’application</CardTitle>
        <CardDescription>Paramètres du backend enregistrés pour le prochain démarrage. Les valeurs modifiées ne s’appliquent pas immédiatement.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {isLoading && !snapshot ? (
          <div className="flex flex-col gap-3"><Skeleton className="h-9 w-full" /><Skeleton className="h-20 w-full" /><Skeleton className="h-20 w-full" /></div>
        ) : !snapshot ? (
          <Alert variant="destructive"><AlertTriangle /><AlertTitle>Configuration indisponible</AlertTitle><AlertDescription>{error?.status === 404
            ? 'Redémarrez le backend pour charger la nouvelle page de configuration, une fois les tâches en cours terminées.'
            : error?.message || 'Impossible de charger les paramètres.'}</AlertDescription></Alert>
        ) : (
          <>
            {error && <Alert variant="destructive"><AlertTriangle /><AlertTitle>Synchronisation échouée</AlertTitle><AlertDescription>La dernière version connue reste affichée : {error.message}</AlertDescription></Alert>}
            {snapshot.restartRequired && (
              <Alert><AlertTriangle /><AlertTitle>Redémarrage nécessaire</AlertTitle><AlertDescription>
                {snapshot.pendingCount} paramètre{snapshot.pendingCount > 1 ? 's' : ''} enregistré{snapshot.pendingCount > 1 ? 's' : ''} en attente. Redémarrez le backend quand vous serez prêt à appliquer ces valeurs.
              </AlertDescription></Alert>
            )}
            {needsReview && <Alert><AlertTriangle /><AlertTitle>Une version plus récente est disponible</AlertTitle><AlertDescription>
              Votre brouillon est conservé. Vérifiez les modifications affichées, puis confirmez leur reprise sur la version actuelle avant d’enregistrer.
              <Button type="button" variant="outline" size="sm" className="mt-2" onClick={rebase} disabled={save.isPending}>J’ai vérifié : reprendre le brouillon</Button>
            </AlertDescription></Alert>}
            <DraftActions dirtyCount={dirtyCount} isPending={save.isPending} needsReview={needsReview} onDiscard={discard} onSave={handleSave} />
            <div className="grid gap-3 sm:grid-cols-[minmax(12rem,18rem)_minmax(0,1fr)]">
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="w-full" aria-label="Catégorie des paramètres">
                  <SelectValue>{selected => selected === 'all' ? `Toutes les catégories (${fieldCount})` : groups.find(group => group.id === selected)?.label || selected}</SelectValue>
                </SelectTrigger>
                <SelectContent><SelectGroup>
                  <SelectItem value="all">Toutes les catégories ({fieldCount})</SelectItem>
                  {groups.map(group => <SelectItem key={group.id} value={group.id}>{group.label} ({group.fields.length})</SelectItem>)}
                </SelectGroup></SelectContent>
              </Select>
              <div className="relative min-w-0">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input className="pl-9" type="search" aria-label="Rechercher un paramètre" placeholder="Rechercher par nom, clé ou description…" value={search} onChange={event => setSearch(event.target.value)} />
              </div>
            </div>
            {visibleGroups.length ? visibleGroups.map(group => (
              <section key={group.id} aria-label={group.label} className="min-w-0">
                <div className="flex items-center justify-between border-b border-border pb-2">
                  <h2 className="font-medium">{group.label}</h2>
                  <Badge variant="secondary">{group.fields.length}</Badge>
                </div>
                {group.fields.map(field => <SettingRow key={field.key} field={field} change={changes[field.key]}
                  onChange={value => setValue(field, value)} onReset={() => setReset(field)} onUndo={() => undo(field)}
                  onClearSecret={() => clearSecret(field)} disabled={save.isPending} />)}
              </section>
            )) : <p className="py-8 text-center text-sm text-muted-foreground">Aucun paramètre ne correspond à cette recherche.</p>}
          </>
        )}
      </CardContent>
      {snapshot && <CardFooter>
        <DraftActions dirtyCount={dirtyCount} isPending={save.isPending} needsReview={needsReview} onDiscard={discard} onSave={handleSave} />
      </CardFooter>}
    </Card>
  )
}
