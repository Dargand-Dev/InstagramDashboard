import { SETTINGS_THEME } from './settingsTheme'
import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPut } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Checkbox } from '@/components/ui/checkbox'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectGroup, SelectItem,
} from '@/components/ui/select'
import { toast } from 'sonner'
import {
  MessageSquare, ArrowUp, ArrowDown, X, Plus, AlertTriangle, Shuffle, ListOrdered, Save,
} from 'lucide-react'

const MODES = [
  { value: 'PRIORITY', label: 'Par priorité', icon: ListOrdered, hint: 'Le fournisseur principal est essayé en premier, puis les secours dans l’ordre indiqué.' },
  { value: 'RANDOM', label: 'Aléatoire', icon: Shuffle, hint: 'Un fournisseur est choisi au hasard parmi ceux du groupe sélectionné.' },
]

/** Les 4 champs pilotés par le formulaire, extraits de la réponse API. */
function toForm(settings) {
  return {
    mode: settings.mode || 'PRIORITY',
    primaryProvider: settings.primaryProvider || '',
    fallbackProviders: settings.fallbackProviders || [],
    randomPool: settings.randomPool || [],
  }
}

function ProviderName({ descriptor, name }) {
  const label = descriptor?.label || name
  return (
    <span className="flex min-w-0 flex-wrap items-center gap-2">
      <span className="truncate font-medium text-foreground">{label}</span>
      {descriptor && !descriptor.credentialsReady && (
        <Badge variant="destructive">Identifiants manquants</Badge>
      )}
    </span>
  )
}

export default function SmsProvidersCard() {
  const queryClient = useQueryClient()

  const { data, isLoading, error } = useQuery({
    queryKey: ['sms-settings'],
    queryFn: () => apiGet('/api/sms/settings'),
  })

  // Brouillon local : tant qu'il est null, le formulaire reflète la config serveur.
  // Dérivé au rendu plutôt que synchronisé par un effet, pour qu'un refetch
  // (focus fenêtre, invalidation) n'écrase jamais une saisie en cours.
  const [draft, setDraft] = useState(null)
  const form = draft ?? (data ? toForm(data) : null)

  const providers = useMemo(() => data?.providers || [], [data])
  const byName = useMemo(
    () => Object.fromEntries(providers.map(p => [p.name, p])),
    [providers],
  )

  const save = useMutation({
    mutationFn: (payload) => apiPut('/api/sms/settings', payload),
    onSuccess: (saved) => {
      queryClient.setQueryData(['sms-settings'], saved)
      setDraft(null)
      toast.success('Fournisseurs SMS mis à jour')
    },
    onError: (e) => toast.error(e.message || 'Échec de la mise à jour'),
  })

  if (isLoading || (!form && !error)) {
    return (
      <Card className="gap-5 py-6 ring-border">
        <CardHeader className="px-5 sm:px-6">
          <CardTitle className="flex items-center gap-2"><MessageSquare />Fournisseurs SMS</CardTitle>
          <CardDescription>Chargement de la stratégie de sélection des numéros…</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
        </CardContent>
      </Card>
    )
  }

  // Erreur bloquante uniquement quand il n'y a rien à afficher. Si une config est déjà
  // en cache, un refetch en échec (retour sur l'onglet après 30 s, backend redémarré)
  // ne doit pas faire disparaître le formulaire ni la saisie en cours : on dégrade en
  // bandeau au-dessus de la carte.
  if (!form) {
    return (
      <Card className="gap-5 py-6 ring-border">
        <CardHeader className="px-5 sm:px-6">
          <CardTitle className="flex items-center gap-2"><MessageSquare />Fournisseurs SMS</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive"><AlertTriangle /><AlertTitle>Configuration SMS indisponible</AlertTitle><AlertDescription>{error.message}</AlertDescription></Alert>
        </CardContent>
      </Card>
    )
  }

  const isRandom = form.mode === 'RANDOM'
  const activeChain = isRandom
    ? form.randomPool
    : [form.primaryProvider, ...form.fallbackProviders].filter(Boolean)

  const dirty = data && JSON.stringify(form) !== JSON.stringify(toForm(data))
  const missingCredentials = activeChain.filter(name => byName[name] && !byName[name].credentialsReady)

  const availableFallbacks = providers
    .map(p => p.name)
    .filter(name => name !== form.primaryProvider && !form.fallbackProviders.includes(name))

  const setField = (patch) => setDraft({ ...form, ...patch })

  const moveFallback = (index, delta) => {
    const next = [...form.fallbackProviders]
    const target = index + delta
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    setField({ fallbackProviders: next })
  }

  const setPrimary = (name) => setField({
    primaryProvider: name,
    // Un provider ne peut pas être à la fois principal et secours.
    fallbackProviders: form.fallbackProviders.filter(f => f !== name),
  })

  const togglePool = (name, checked) => setField({
    randomPool: checked
      ? [...form.randomPool, name]
      : form.randomPool.filter(p => p !== name),
  })

  const handleSave = () => {
    if (isRandom && form.randomPool.length === 0) {
      toast.error('Sélectionnez au moins un fournisseur dans le groupe aléatoire')
      return
    }
    if (!isRandom && !form.primaryProvider) {
      toast.error('Sélectionnez un fournisseur principal')
      return
    }
    save.mutate(form)
  }

  return (
    <Card className="gap-5 py-6 ring-border">
      <CardHeader className="px-5 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2"><MessageSquare />Fournisseurs SMS</CardTitle>
          <Button size="sm" onClick={handleSave} disabled={!dirty || save.isPending}>
            <Save data-icon="inline-start" />{save.isPending ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        </div>
        <CardDescription>
          Choisissez comment l’application obtient un numéro lors de la création d’un compte.
          Les changements enregistrés s’appliquent dès la prochaine demande de numéro.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-6 px-5 sm:px-6">
        {error && (
          <Alert variant="destructive"><AlertTriangle /><AlertTitle>Synchronisation interrompue</AlertTitle><AlertDescription>
            La dernière configuration connue reste affichée : {error.message}
          </AlertDescription></Alert>
        )}

        <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/30 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-medium text-foreground">{isRandom ? 'Groupe de tirage' : 'Ordre de sélection'}</p>
              <p className="text-xs text-muted-foreground">{dirty ? 'Aperçu des changements non enregistrés' : 'Configuration enregistrée'}</p>
            </div>
            <Badge variant={dirty ? 'secondary' : 'outline'}>{dirty ? 'À enregistrer' : 'Actif'}</Badge>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {activeChain.length === 0 && (
              <span className="text-sm text-destructive">Aucun fournisseur sélectionné</span>
            )}
            {activeChain.map((name, i) => (
              <span key={name} className="flex items-center gap-2">
                {i > 0 && <span aria-hidden="true" className="text-muted-foreground">{isRandom ? '·' : '→'}</span>}
                <Badge variant={i === 0 && !isRandom ? 'default' : 'outline'}>{byName[name]?.label || name}</Badge>
              </span>
            ))}
          </div>
          {data.updatedAt && (
            <p className="text-xs text-muted-foreground">
              Dernière modification {new Date(data.updatedAt).toLocaleString('fr-FR')}
              {data.updatedBy ? ` par ${data.updatedBy}` : ''}
            </p>
          )}
        </div>

        {missingCredentials.length > 0 && (
          <Alert variant="destructive"><AlertTriangle /><AlertTitle>Identifiants manquants</AlertTitle><AlertDescription>
            {missingCredentials.map(n => byName[n]?.label || n).join(', ')} : ces fournisseurs échoueront tant que leurs identifiants API ne seront pas configurés.
          </AlertDescription></Alert>
        )}

        <section className="flex flex-col gap-3" aria-labelledby="sms-mode-title">
          <div>
            <h3 id="sms-mode-title" className="font-medium text-foreground">Stratégie de sélection</h3>
            <p className="text-sm text-muted-foreground">Définissez dans quel ordre les fournisseurs seront sollicités.</p>
          </div>
          <ToggleGroup multiple={false} value={[form.mode]} onValueChange={values => values[0] && setField({ mode: values[0] })}
            variant="outline" spacing={2} aria-label="Stratégie de sélection"
            className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
            {MODES.map(mode => (
              <ToggleGroupItem key={mode.value} value={mode.value}
                className="h-auto min-w-0 items-start justify-start gap-3 whitespace-normal px-4 py-3 text-left aria-pressed:border-primary aria-pressed:bg-primary/10 aria-pressed:text-foreground">
                <mode.icon />
                <span className="flex flex-col gap-1">
                  <span className="font-medium">{mode.label}</span>
                  <span className="text-xs leading-relaxed text-muted-foreground">{mode.hint}</span>
                </span>
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </section>

        {isRandom ? (
          <section className="flex flex-col gap-3" aria-labelledby="sms-pool-title">
            <div>
              <h3 id="sms-pool-title" className="font-medium text-foreground">Fournisseurs du groupe aléatoire</h3>
              <p className="text-sm text-muted-foreground">Cochez les fournisseurs éligibles. Le tirage a lieu à chaque demande de numéro.</p>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {providers.map(p => (
                <label
                  key={p.name}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-muted/20 p-4 hover:bg-muted/40 has-data-checked:border-primary"
                >
                  <Checkbox
                    checked={form.randomPool.includes(p.name)}
                    onCheckedChange={(checked) => togglePool(p.name, checked === true)}
                  />
                  <ProviderName descriptor={p} name={p.name} />
                </label>
              ))}
            </div>
          </section>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
            <section className="flex min-w-0 flex-col gap-3" aria-labelledby="sms-primary-title">
              <div>
                <Label id="sms-primary-title" htmlFor="sms-primary-provider" className="font-medium text-foreground">Fournisseur principal</Label>
                <p className="text-sm text-muted-foreground">Toujours essayé en premier pour obtenir un numéro.</p>
              </div>
              <Select value={form.primaryProvider ?? null} onValueChange={setPrimary}>
                <SelectTrigger id="sms-primary-provider" className="w-full">
                  {/* Base UI (pas Radix) : sans enfant, SelectValue sérialise la valeur brute
                      et afficherait "smsbower" au lieu de "SMSBower". */}
                  <SelectValue placeholder="Choisir un fournisseur">
                    {(value) => (value ? byName[value]?.label || value : 'Choisir un fournisseur')}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent style={SETTINGS_THEME}><SelectGroup>
                  {providers.map(p => (
                    <SelectItem key={p.name} value={p.name}>
                      {p.label}{p.credentialsReady ? '' : ' — identifiants manquants'}
                    </SelectItem>
                  ))}
                </SelectGroup></SelectContent>
              </Select>
              {form.primaryProvider && byName[form.primaryProvider] && (
                <p className="text-xs text-muted-foreground">
                  Service : {byName[form.primaryProvider].service || 'non défini'}
                  {byName[form.primaryProvider].country ? ` · Pays : ${byName[form.primaryProvider].country}` : ''}
                  {byName[form.primaryProvider].maxPrice ? ` · Prix max. : ${byName[form.primaryProvider].maxPrice}` : ''}
                </p>
              )}
            </section>

            <section className="flex min-w-0 flex-col gap-3" aria-labelledby="sms-fallback-title">
              <div>
                <h3 id="sms-fallback-title" className="font-medium text-foreground">Fournisseurs de secours</h3>
                <p className="text-sm text-muted-foreground">Essayés de haut en bas si le principal échoue. Ajustez leur ordre avec les flèches.</p>
              </div>
              {form.fallbackProviders.length === 0 ? (
                <p className="rounded-lg border border-border bg-muted/20 p-4 text-sm text-muted-foreground">
                  Aucun secours sélectionné. Si le principal échoue, la demande de numéro échoue.
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {form.fallbackProviders.map((name, i) => (
                    <div
                      key={name}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/20 p-3"
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <Badge variant="secondary">{i + 1}</Badge>
                        <ProviderName descriptor={byName[name]} name={name} />
                      </span>
                      <span className="flex shrink-0 items-center gap-1">
                        <Button
                          type="button" variant="ghost" size="icon-sm"
                          aria-label={`Monter ${byName[name]?.label || name} dans les secours`}
                          disabled={i === 0}
                          onClick={() => moveFallback(i, -1)}
                        >
                          <ArrowUp />
                        </Button>
                        <Button
                          type="button" variant="ghost" size="icon-sm"
                          aria-label={`Descendre ${byName[name]?.label || name} dans les secours`}
                          disabled={i === form.fallbackProviders.length - 1}
                          onClick={() => moveFallback(i, 1)}
                        >
                          <ArrowDown />
                        </Button>
                        <Button
                          type="button" variant="ghost" size="icon-sm"
                          aria-label={`Retirer ${byName[name]?.label || name} des secours`}
                          onClick={() => setField({
                            fallbackProviders: form.fallbackProviders.filter(f => f !== name),
                          })}
                        >
                          <X />
                        </Button>
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {availableFallbacks.length > 0 && (
                <Select value="" onValueChange={(name) => setField({
                  fallbackProviders: [...form.fallbackProviders, name],
                })}>
                  <SelectTrigger className="w-full" aria-label="Ajouter un fournisseur de secours">
                    <span className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Plus />Ajouter un fournisseur de secours
                    </span>
                  </SelectTrigger>
                  <SelectContent style={SETTINGS_THEME}><SelectGroup>
                    {availableFallbacks.map(name => (
                      <SelectItem key={name} value={name}>
                        {byName[name]?.label || name}
                        {byName[name]?.credentialsReady ? '' : ' — identifiants manquants'}
                      </SelectItem>
                    ))}
                  </SelectGroup></SelectContent>
                </Select>
              )}
            </section>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex flex-wrap items-start gap-3 text-sm text-muted-foreground">
        <Badge variant="secondary">Sans redémarrage</Badge>
        <p className="min-w-0 flex-1">
          La stratégie et l’ordre enregistrés ici prennent effet dès la prochaine demande de numéro.
          Les identifiants API et autres paramètres techniques se modifient dans la configuration de l’application et nécessitent un redémarrage.
        </p>
      </CardFooter>
    </Card>
  )
}
