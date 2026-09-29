import { useMemo, useState } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SETTINGS_THEME } from './settingsTheme'
import { AlertTriangle, ArrowRight, CalendarDays, Check, ChevronDown, ChevronRight, Code2, Info, LoaderCircle, MessageSquare, Plug, RotateCw, Save, Search, ShieldCheck, SlidersHorizontal, Smartphone, UserRoundPlus, Users, X } from 'lucide-react'
import useApplicationSettings from './useApplicationSettings'
import SettingField from './SettingField'
import SmsProvidersCard from './SmsProvidersCard'
import IdentitiesSettings from './IdentitiesSettings'
import ProfilePictureTypesSettings from './ProfilePictureTypesSettings'
import BackendRestartControl from './BackendRestartControl'
import { SETTINGS_SECTIONS, presentSettingsGroups, filterSettingsGroups } from './settingsPresentation'
import { cn } from '@/lib/utils'

const ICONS = { publications: CalendarDays, accounts: UserRoundPlus, sms: MessageSquare, identities: Users, connections: Plug, devices: Smartphone, security: ShieldCheck, system: SlidersHorizontal }

function SettingsGroup({ group, controller, technical, searching }) {
  const [expanded, setExpanded] = useState(false)
  const changed = group.fields.filter(field => controller.changes[field.key]).length
  const fields = <div className="min-w-0">{group.fields.map(field => <SettingField key={field.key} field={field}
    change={controller.changes[field.key]} technical={technical} controller={controller} />)}</div>
  if (group.advanced && !searching) return <Collapsible open={expanded} onOpenChange={setExpanded} className="rounded-xl border border-border bg-card">
    <CollapsibleTrigger className="flex w-full items-center gap-3 rounded-xl p-5 text-left outline-none hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring sm:px-6">
      <div className="min-w-0 flex-1"><h3 className="text-sm font-medium">{group.label}</h3><p className="mt-1 text-sm leading-relaxed text-muted-foreground">{group.description}</p></div>
      {changed > 0 ? <span className="rounded-full bg-blue-400/15 px-2 py-0.5 text-xs text-blue-300">{changed} modifié{changed > 1 ? 's' : ''}</span>
        : <span className="text-xs tabular-nums text-muted-foreground">{group.fields.length}</span>}
      <ChevronDown className={cn('size-4 shrink-0 text-muted-foreground', expanded && 'rotate-180')} />
    </CollapsibleTrigger>
    <CollapsibleContent><div className="border-t border-border p-5 sm:px-6">{fields}</div></CollapsibleContent>
  </Collapsible>
  return <Card className="gap-5 py-6 ring-border">
    <CardHeader className="px-5 sm:px-6">
      {searching && <p className="mb-1 text-xs font-medium text-blue-300">{SETTINGS_SECTIONS.find(section => section.id === group.section)?.label}</p>}
      <CardTitle><h3 className="text-base font-semibold">{group.label}</h3></CardTitle>
      <CardDescription className="leading-relaxed">{group.description}</CardDescription>
    </CardHeader>
    <CardContent className="px-5 sm:px-6">{fields}</CardContent>
  </Card>
}

function SettingsUnavailable({ controller }) {
  return <Card className="ring-border"><CardContent className="flex flex-col items-start gap-4 p-6">
    <div className="flex size-11 items-center justify-center rounded-xl bg-amber-400/10 text-amber-300"><Info className="size-5" /></div>
    <div><h3 className="font-semibold">Les réglages de l’application sont indisponibles</h3>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">{controller.error?.status === 404
        ? 'Le serveur doit charger la mise à jour de configuration. Quand les tâches en cours seront terminées, redémarrez-le depuis la rubrique Système.'
        : controller.error?.message || 'La connexion au serveur a échoué. Réessayez dans un instant.'}</p></div>
    <Button variant="outline" onClick={() => controller.refetch()}><RotateCw className="size-4" />Réessayer</Button>
  </CardContent></Card>
}

export default function ApplicationSettingsCard() {
  const controller = useApplicationSettings()
  const { snapshot, dirtyCount, needsReview, changes } = controller
  const [sectionId, setSectionId] = useState('publications')
  const [search, setSearch] = useState('')
  const [technical, setTechnical] = useState(false)
  // Keep immediately saved panels mounted once visited, preserving their local drafts.
  const [visited, setVisited] = useState([])
  const groups = useMemo(() => presentSettingsGroups((snapshot?.groups ?? []).map(group => ({
    ...group,
    fields: group.fields.filter(field => ![
      'profile.picture.blonde-drive-folder-id', 'profile.picture.brunette-drive-folder-id',
    ].includes(field.key)),
  }))), [snapshot])
  const searching = Boolean(search.trim())
  const pictureTypesMatch = searching && search.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .trim().split(/\s+/).every(term => 'photos de profil identites types dossiers drive'.includes(term))
  const visibleGroups = searching ? filterSettingsGroups(groups, search) : groups.filter(group => group.section === sectionId)
  const common = visibleGroups.filter(group => !group.advanced)
  const advanced = visibleGroups.filter(group => group.advanced)
  const section = SETTINGS_SECTIONS.find(item => item.id === sectionId)
  const SectionIcon = ICONS[sectionId]
  const resultCount = visibleGroups.reduce((total, group) => total + group.fields.length, 0) + (pictureTypesMatch ? 1 : 0)
  const goTo = id => {
    setSectionId(id)
    setSearch('')
    setVisited(previous => previous.includes(id) ? previous : [...previous, id])
  }

  return <div style={SETTINGS_THEME} className="settings-page [&_[data-slot=switch-thumb]]:bg-white mx-auto flex min-h-full max-w-[1400px] flex-col text-foreground">
    <header className="mb-5 flex flex-wrap items-center justify-between gap-5 border-b border-border pb-5 sm:pb-7 sm:mb-7">
      <div><p className="mb-2 hidden text-xs font-medium uppercase sm:block tracking-[0.16em] text-muted-foreground">Votre espace de travail</p>
        <h1 className="text-3xl font-semibold tracking-tight">Configuration</h1>
        <p className="mt-2 text-sm text-muted-foreground">Réglez vos automatisations, vos services et vos accès.</p></div>
      {snapshot && <div className="flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-2 text-xs text-muted-foreground">
        {dirtyCount ? <><span className="size-2 rounded-full bg-blue-400" />Brouillon en cours</>
          : snapshot.restartRequired ? <><RotateCw className="size-3.5 text-amber-300" />Redémarrage en attente</>
            : <><Check className="size-3.5 text-emerald-400" />Configuration à jour</>}
      </div>}
    </header>

    <div className="grid flex-1 items-start gap-7 lg:grid-cols-[210px_minmax(0,1fr)] xl:gap-10">
      <aside className="min-w-0 lg:sticky lg:top-0">
        <p className="mb-3 hidden px-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground lg:block">Réglages</p>
        <div className="lg:hidden">
          <label id="settings-section-label" className="mb-2 block text-xs font-medium text-muted-foreground">Rubrique</label>
          <Select value={sectionId} onValueChange={goTo}>
            <SelectTrigger className="h-11 w-full bg-card" aria-labelledby="settings-section-label"><SelectValue>{selected => SETTINGS_SECTIONS.find(item => item.id === selected)?.label}</SelectValue></SelectTrigger>
            <SelectContent style={SETTINGS_THEME}><SelectGroup>{SETTINGS_SECTIONS.map(item => <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>)}</SelectGroup></SelectContent>
          </Select>
        </div>
        <nav aria-label="Rubriques de configuration" className="hidden gap-1 lg:flex lg:flex-col">
          {SETTINGS_SECTIONS.map(item => {
            const Icon = ICONS[item.id]
            const count = groups.filter(group => group.section === item.id).flatMap(group => group.fields).filter(field => changes[field.key]).length
            const selected = item.id === sectionId && !searching
            return <button type="button" key={item.id} onClick={() => goTo(item.id)} aria-current={selected ? 'page' : undefined}
              className={cn('flex shrink-0 items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring',
                selected ? 'bg-blue-500/12 text-blue-300' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground')}>
              <Icon className="size-4 shrink-0" /><span className="whitespace-nowrap">{item.label}</span>
              {count > 0 ? <span className="ml-auto rounded bg-blue-500/20 px-1.5 text-xs text-blue-200">{count}</span>
                : selected && <ChevronRight className="ml-auto hidden size-3.5 lg:block" />}
            </button>
          })}
        </nav>
        <div className="mt-8 hidden border-t border-border px-3 pt-5 lg:block">
          <p className="flex items-center gap-2 text-xs font-medium"><Info className="size-3.5 text-muted-foreground" />Comment ça fonctionne</p>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">Enregistrez vos réglages, puis redémarrez le serveur pour les appliquer. Les exceptions sont indiquées.</p>
        </div>
      </aside>

      <div className="min-w-0 space-y-6 pb-8">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-0 flex-1 basis-40">
            <Search className="pointer-events-none absolute left-3.5 top-3 size-4 text-muted-foreground" />
            <Input type="search" className="h-10 bg-card pl-10 pr-10" aria-label="Rechercher un réglage" placeholder="Rechercher un réglage…" value={search} onChange={event => setSearch(event.target.value)} />
            {search && <button type="button" aria-label="Effacer la recherche" className="absolute right-3 top-3 text-muted-foreground hover:text-foreground" onClick={() => setSearch('')}><X className="size-4" /></button>}
          </div>
          <Button variant={technical ? 'secondary' : 'ghost'} className="h-10 text-xs text-muted-foreground" title="Afficher les clés YAML et les actions de réinitialisation" aria-pressed={technical} onClick={() => setTechnical(value => !value)}>
            <Code2 className="size-4" /><span className="sr-only sm:not-sr-only">Détails techniques</span>
          </Button>
        </div>

        <div className="flex items-start gap-3.5">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-blue-400/15 bg-blue-400/10 text-blue-300">{searching ? <Search className="size-5" /> : <SectionIcon className="size-5" />}</div>
          <div><h2 className="text-xl font-semibold tracking-tight">{searching ? 'Résultats de recherche' : section.label}</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{searching ? `${resultCount} réglage${resultCount > 1 ? 's' : ''} trouvé${resultCount > 1 ? 's' : ''} dans toutes les rubriques` : section.description}</p></div>
        </div>

        {snapshot?.restartRequired && <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-amber-300/15 bg-amber-400/5 px-4 py-3 text-sm">
          <RotateCw className="size-4 shrink-0 text-amber-300" /><p className="flex-1 basis-48 text-amber-100">{snapshot.pendingCount} réglage{snapshot.pendingCount > 1 ? 's' : ''} enregistré{snapshot.pendingCount > 1 ? 's' : ''} en attente de redémarrage.</p>
          {sectionId !== 'system' && <button className="flex items-center gap-1.5 text-xs font-medium text-amber-200" onClick={() => goTo('system')}>Aller au système <ArrowRight className="size-3.5" /></button>}
        </div>}
        {needsReview && <Alert className="border-amber-400/30 bg-amber-400/5"><AlertTriangle /><AlertTitle>La configuration a changé depuis votre première modification</AlertTitle><AlertDescription>
          Votre brouillon est conservé. Vérifiez les valeurs avant de reprendre sur la nouvelle version.
          <Button className="mt-3" variant="outline" size="sm" onClick={controller.rebase} disabled={controller.saving}>J’ai vérifié : reprendre mon brouillon</Button>
        </AlertDescription></Alert>}
        {snapshot && controller.error && <Alert variant="destructive"><AlertTriangle /><AlertTitle>Synchronisation interrompue</AlertTitle><AlertDescription>La dernière version connue reste affichée. {controller.error.message}</AlertDescription></Alert>}

        {visited.includes('sms') && <div hidden={searching || sectionId !== 'sms'}><SmsProvidersCard /></div>}
        {visited.includes('identities') && <div hidden={searching || sectionId !== 'identities'}><IdentitiesSettings /></div>}
        {(visited.includes('identities') || pictureTypesMatch) && <div hidden={searching ? !pictureTypesMatch : sectionId !== 'identities'}><ProfilePictureTypesSettings /></div>}
        {!searching && sectionId === 'system' && <Card className="ring-border"><CardHeader className="px-6"><CardTitle>Appliquer les réglages</CardTitle>
          <CardDescription className="leading-relaxed">Redémarrez le serveur après l’enregistrement, une fois les automatisations en cours terminées.</CardDescription></CardHeader>
          <CardContent className="px-6">{import.meta.env.DEV ? <BackendRestartControl /> : <p className="text-sm text-muted-foreground">Relancez le service backend depuis votre environnement d’hébergement.</p>}</CardContent></Card>}

        {controller.isLoading && !snapshot ? <div className="space-y-4"><Skeleton className="h-44 w-full rounded-xl" /><Skeleton className="h-64 w-full rounded-xl" /></div>
          : !snapshot ? sectionId !== 'identities' && <SettingsUnavailable controller={controller} />
            : searching ? resultCount ? visibleGroups.map(group => <SettingsGroup key={group.id} group={group} controller={controller} technical={technical} searching />)
              : <div className="rounded-xl border border-dashed border-border px-6 py-14 text-center"><Search className="mx-auto mb-4 size-6 text-muted-foreground" /><h3 className="font-medium">Aucun réglage trouvé</h3><p className="mt-2 text-sm text-muted-foreground">Essayez un autre mot, comme « délai », « SMS » ou « Drive ».</p><Button variant="outline" className="mt-5" onClick={() => setSearch('')}>Effacer la recherche</Button></div>
              : <>
                {common.map(group => <SettingsGroup key={group.id} group={group} controller={controller} technical={technical} />)}
                {advanced.length > 0 && <div className="space-y-3 pt-2"><div className="flex items-center gap-2 pb-1"><SlidersHorizontal className="size-3.5 text-muted-foreground" /><h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Réglages avancés</h3></div>
                  {advanced.map(group => <SettingsGroup key={group.id} group={group} controller={controller} technical={technical} />)}
                </div>}
              </>}
      </div>
    </div>

    {dirtyCount > 0 && <div className="sticky -bottom-4 z-20 -mx-4 border-t border-blue-400/25 bg-[#171e2c]/95 px-4 py-4 shadow-[0_-8px_30px_0_rgba(0,0,0,0.2)] backdrop-blur-lg lg:-bottom-6 lg:-mx-6 lg:px-6" role="region" aria-label="Enregistrer les modifications">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div aria-live="polite"><p className="text-sm font-medium">{dirtyCount} modification{dirtyCount > 1 ? 's' : ''} à enregistrer</p><p className="mt-1 text-xs text-muted-foreground">Vos changements seront appliqués après redémarrage.</p></div>
        <div className="flex items-center gap-2"><Button variant="ghost" onClick={controller.discard} disabled={controller.saving}>Annuler</Button>
          <Button className="h-10" onClick={controller.save} disabled={controller.saving || needsReview}>{controller.saving ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}{controller.saving ? 'Enregistrement…' : 'Enregistrer les modifications'}</Button></div>
      </div>
    </div>}
  </div>
}
