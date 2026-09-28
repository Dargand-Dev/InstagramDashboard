import { SETTINGS_THEME } from './settingsTheme'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { LockKeyhole, Plus, RotateCcw, Trash2 } from 'lucide-react'

const OPTION_LABELS = {
  graceful: 'Terminer les tâches avant l’arrêt', immediate: 'Arrêt immédiat',
  always: 'Toujours', never: 'Jamais', on_param: 'Sur demande', when_authorized: 'Utilisateurs autorisés',
  'oauth2-user': 'Compte Google personnel (OAuth)', 'service-account': 'Compte de service Google',
}

function ListControl({ field, value, onChange, disabled }) {
  const entries = Array.isArray(value) ? value : []
  const windows = field.type === 'windows'
  const replace = (index, entry) => onChange(entries.map((current, i) => i === index ? entry : current))
  return <div className="space-y-2">
    {!entries.length && <p className="text-sm text-muted-foreground">{windows ? 'Aucun créneau défini.' : 'Aucun élément.'}</p>}
    {entries.map((entry, index) => <div key={index} className="flex min-w-0 items-center gap-2">
      {windows ? <div className="flex min-w-0 flex-1 items-center gap-2">
        <Input type="time" className="h-10" step="60" aria-label={`${field.label}, créneau ${index + 1}, début`}
          value={entry.start ?? ''} onChange={event => replace(index, { ...entry, start: event.target.value })} disabled={disabled} />
        <span className="text-sm text-muted-foreground">à</span>
        <Input type="time" className="h-10" step="60" aria-label={`${field.label}, créneau ${index + 1}, fin`}
          value={entry.end ?? ''} onChange={event => replace(index, { ...entry, end: event.target.value })} disabled={disabled} />
      </div> : <Input className="h-10 min-w-0 flex-1" aria-label={`${field.label}, élément ${index + 1}`}
        value={entry} onChange={event => replace(index, event.target.value)} disabled={disabled} />}
      <Button type="button" variant="ghost" size="icon" aria-label={`Supprimer ${windows ? 'le créneau' : 'l’élément'} ${index + 1} de ${field.label}`}
        onClick={() => onChange(entries.filter((_, i) => i !== index))} disabled={disabled}><Trash2 className="size-4" /></Button>
    </div>)}
    <Button type="button" variant="outline" size="sm" onClick={() => onChange([...entries, windows ? { start: '', end: '' } : ''])} disabled={disabled}>
      <Plus className="size-4" />{windows ? 'Ajouter un créneau' : 'Ajouter un élément'}
    </Button>
  </div>
}

function Control({ field, value, change, onChange, onClearSecret, disabled }) {
  const id = `setting-${field.key}`
  const describedBy = `${id}-help`
  if (change?.action === 'reset') return <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">La valeur d’origine sera rétablie à l’enregistrement.</p>
  if (field.type === 'boolean') return <div className="flex items-center justify-end gap-3">
    <span className="text-sm text-muted-foreground" aria-hidden="true">{value ? 'Activé' : 'Désactivé'}</span>
    <Switch id={id} checked={Boolean(value)} onCheckedChange={onChange} disabled={disabled} aria-label={field.label} aria-describedby={describedBy} />
  </div>
  if (field.type === 'string-list' || field.type === 'windows') return <ListControl field={field} value={value} onChange={onChange} disabled={disabled} />
  if (field.options?.length) return <Select value={String(value ?? '')} onValueChange={onChange} disabled={disabled}>
    <SelectTrigger id={id} className="h-10 w-full" aria-label={field.label} aria-describedby={describedBy}>
      <SelectValue placeholder="Choisir">{selected => OPTION_LABELS[selected] || selected || 'Choisir'}</SelectValue>
    </SelectTrigger>
    <SelectContent style={SETTINGS_THEME}><SelectGroup>{field.options.map(option => <SelectItem key={option} value={option}>{OPTION_LABELS[option] || option}</SelectItem>)}</SelectGroup></SelectContent>
  </Select>
  if (field.secret) return <div className="space-y-2">
    <div className="relative">
      <LockKeyhole className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" />
      <Input id={id} type="password" autoComplete="new-password" className="h-10 pl-9" aria-describedby={describedBy}
        value={change?.action === 'update' ? change.value : ''} onChange={event => onChange(event.target.value)}
        placeholder={field.configured ? '•••••••• — enregistré' : 'Saisir une valeur'} disabled={disabled} />
    </div>
    {(field.configured || change) && <Button type="button" variant="ghost" size="sm" className="h-auto px-0 py-1 text-muted-foreground" onClick={onClearSecret} disabled={disabled}>
      {change?.action === 'update' && change.value === '' ? 'Annuler la suppression' : 'Supprimer le secret enregistré'}
    </Button>}
  </div>
  return <div className="relative">
    <Input id={id} aria-describedby={describedBy} className={`h-10 ${field.unit ? 'pr-20' : ''}`}
      type={['integer', 'number'].includes(field.type) ? 'number' : 'text'}
      step={field.type === 'integer' ? '1' : field.type === 'number' ? 'any' : undefined}
      min={field.min ?? undefined} max={field.max ?? undefined} value={value ?? ''}
      onChange={event => onChange(event.target.value)} disabled={disabled} />
    {field.unit && <span className="pointer-events-none absolute right-7 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{field.unit}</span>}
  </div>
}

function activeValue(field) {
  if (field.type === 'boolean') return field.activeValue ? 'activé' : 'désactivé'
  if (field.type === 'windows') return field.activeValue?.map(w => `${w.start}–${w.end}`).join(', ') || 'aucun créneau'
  if (Array.isArray(field.activeValue)) return field.activeValue.join(', ') || 'liste vide'
  return String(field.activeValue ?? 'non défini')
}

export default function SettingField({ field, change, technical, controller }) {
  const value = change?.action === 'update' ? change.value : field.value
  return <div className="grid min-w-0 gap-4 border-b border-border py-5 first:pt-1 last:border-0 last:pb-0 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)] xl:gap-8" data-setting-key={field.key}>
    <div className="min-w-0 space-y-1.5">
      <div className="flex items-center gap-2">
        <Label htmlFor={`setting-${field.key}`} className="text-sm font-medium leading-5">{field.label}</Label>
        {change && <span className="size-1.5 shrink-0 rounded-full bg-blue-400" aria-label="Modifié" />}
      </div>
      <p id={`setting-${field.key}-help`} className="text-sm leading-relaxed text-muted-foreground">{field.description}</p>
      {technical && <code className="block break-all pt-1 text-xs text-muted-foreground">{field.key}</code>}
      {field.blockedByExternalOverride ? <p className="text-xs leading-5 text-amber-300">Une valeur définie au lancement reste prioritaire sur ce réglage.</p>
        : field.pendingRestart && <p className="break-words text-xs leading-5 text-amber-300">En attente de redémarrage{!field.secret && ` · Actuellement : ${activeValue(field)}`}</p>}
    </div>
    <div className="min-w-0 space-y-2">
      <Control field={field} value={value} change={change} onChange={next => controller.setValue(field, next)}
        onClearSecret={() => controller.clearSecret(field)} disabled={controller.saving} />
      {change?.action === 'update' && field.secret && change.value === '' && <p className="text-xs text-amber-300">Le secret sera supprimé à l’enregistrement.</p>}
      {(change || (technical && field.overridden)) && <div className="flex flex-wrap gap-x-4 gap-y-1">
        {change && <Button type="button" variant="ghost" size="sm" className="h-auto px-0 py-1 text-xs text-muted-foreground" onClick={() => controller.undo(field)} disabled={controller.saving}>
          <RotateCcw className="size-3" />Annuler ce changement
        </Button>}
        {technical && field.overridden && change?.action !== 'reset' && <Button type="button" variant="ghost" size="sm" className="h-auto px-0 py-1 text-xs text-muted-foreground" onClick={() => controller.setReset(field)} disabled={controller.saving}>Rétablir la valeur d’origine</Button>}
      </div>}
    </div>
  </div>
}
