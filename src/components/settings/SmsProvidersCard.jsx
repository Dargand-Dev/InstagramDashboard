import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPut } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle, CardAction } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select'
import { toast } from 'sonner'
import {
  MessageSquare, ArrowUp, ArrowDown, X, Plus, AlertTriangle, Shuffle, ListOrdered,
} from 'lucide-react'

const MODES = [
  { value: 'PRIORITY', label: 'Priorité stricte', icon: ListOrdered, hint: 'Le principal est toujours tenté en premier, puis la chaîne de secours.' },
  { value: 'RANDOM', label: 'Aléatoire', icon: Shuffle, hint: "L'ordre du pool est mélangé à chaque location de numéro." },
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
    <span className="flex items-center gap-2 min-w-0">
      <span className="text-sm text-[#FAFAFA] truncate">{label}</span>
      {descriptor && !descriptor.credentialsReady && (
        <Badge variant="outline" className="bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/20 text-[10px]">
          clé manquante
        </Badge>
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
      toast.success('Providers SMS mis à jour')
    },
    onError: (e) => toast.error(e.message || 'Échec de la mise à jour'),
  })

  if (isLoading || (!form && !error)) {
    return (
      <Card className="bg-[#111111] border-[#1a1a1a] lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-sm text-[#A1A1AA] flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-[#10B981]" />
            SMS Providers
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full bg-[#1a1a1a]" />)}
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="bg-[#111111] border-[#1a1a1a] lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-sm text-[#A1A1AA] flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-[#10B981]" />
            SMS Providers
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-[#EF4444]">Configuration SMS indisponible : {error.message}</p>
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
      toast.error('Sélectionnez au moins un provider dans le pool')
      return
    }
    if (!isRandom && !form.primaryProvider) {
      toast.error('Sélectionnez un provider principal')
      return
    }
    save.mutate(form)
  }

  return (
    <Card className="bg-[#111111] border-[#1a1a1a] lg:col-span-2">
      <CardHeader>
        <CardTitle className="text-sm text-[#A1A1AA] flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-[#10B981]" />
          SMS Providers
        </CardTitle>
        <CardAction>
          <Button
            size="sm"
            className="bg-[#3B82F6] hover:bg-[#2563EB] text-white disabled:opacity-40"
            onClick={handleSave}
            disabled={!dirty || save.isPending}
          >
            {save.isPending ? 'Enregistrement...' : 'Enregistrer'}
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Chaîne effectivement appliquée */}
        <div className="p-3 rounded-lg bg-[#0A0A0A] border border-[#1a1a1a]">
          <p className="text-xs text-[#52525B] mb-2">
            {isRandom ? 'Tirage aléatoire parmi' : "Ordre d'essai"}
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            {activeChain.length === 0 && (
              <span className="text-xs text-[#EF4444]">Aucun provider actif</span>
            )}
            {activeChain.map((name, i) => (
              <span key={name} className="flex items-center gap-2">
                {i > 0 && <span className="text-[#3F3F46] text-xs">{isRandom ? '·' : '→'}</span>}
                <Badge
                  variant="outline"
                  className={i === 0 && !isRandom
                    ? 'bg-[#10B981]/10 text-[#10B981] border-[#10B981]/20'
                    : 'bg-[#1a1a1a] text-[#A1A1AA] border-[#27272A]'}
                >
                  {byName[name]?.label || name}
                </Badge>
              </span>
            ))}
          </div>
          {data.updatedAt && (
            <p className="text-[10px] text-[#3F3F46] mt-2">
              Dernière modification {new Date(data.updatedAt).toLocaleString('fr-FR')}
              {data.updatedBy ? ` par ${data.updatedBy}` : ''}
            </p>
          )}
        </div>

        {missingCredentials.length > 0 && (
          <div className="flex items-start gap-2 rounded-lg border border-[#F59E0B]/20 bg-[#F59E0B]/5 p-3">
            <AlertTriangle className="w-3.5 h-3.5 text-[#F59E0B] mt-0.5 shrink-0" />
            <p className="text-xs text-[#F59E0B]">
              {missingCredentials.map(n => byName[n]?.label || n).join(', ')} —
              identifiants API absents côté backend : ce provider échouera à chaque location.
            </p>
          </div>
        )}

        {/* Mode de sélection */}
        <div className="space-y-2">
          <Label className="text-xs text-[#A1A1AA]">Mode de sélection</Label>
          <div className="flex gap-2">
            {MODES.map(mode => (
              <Button
                key={mode.value}
                variant="ghost"
                size="sm"
                onClick={() => setField({ mode: mode.value })}
                className={form.mode === mode.value
                  ? 'bg-[#3B82F6]/10 text-[#3B82F6] hover:bg-[#3B82F6]/15 hover:text-[#3B82F6]'
                  : 'text-[#52525B] hover:text-[#A1A1AA]'}
              >
                <mode.icon className="w-3 h-3 mr-1.5" />{mode.label}
              </Button>
            ))}
          </div>
          <p className="text-[10px] text-[#3F3F46]">
            {MODES.find(m => m.value === form.mode)?.hint}
          </p>
        </div>

        {isRandom ? (
          <div className="space-y-2">
            <Label className="text-xs text-[#A1A1AA]">Pool de providers</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {providers.map(p => (
                <label
                  key={p.name}
                  className="flex items-center gap-3 p-3 rounded-lg bg-[#0A0A0A] border border-[#1a1a1a] cursor-pointer hover:border-[#27272A]"
                >
                  <Checkbox
                    checked={form.randomPool.includes(p.name)}
                    onCheckedChange={(checked) => togglePool(p.name, checked === true)}
                  />
                  <ProviderName descriptor={p} name={p.name} />
                </label>
              ))}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="space-y-2">
              <Label className="text-xs text-[#A1A1AA]">Provider principal</Label>
              <Select value={form.primaryProvider || undefined} onValueChange={setPrimary}>
                <SelectTrigger className="bg-[#0A0A0A] border-[#1a1a1a] text-[#FAFAFA]">
                  <SelectValue placeholder="Choisir un provider" />
                </SelectTrigger>
                <SelectContent className="bg-[#111111] border-[#1a1a1a] text-[#FAFAFA]">
                  {providers.map(p => (
                    <SelectItem key={p.name} value={p.name}>
                      {p.label}{p.credentialsReady ? '' : ' — clé manquante'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.primaryProvider && byName[form.primaryProvider] && (
                <p className="text-[10px] text-[#3F3F46]">
                  service {byName[form.primaryProvider].service}
                  {byName[form.primaryProvider].country ? ` · pays ${byName[form.primaryProvider].country}` : ''}
                  {byName[form.primaryProvider].maxPrice ? ` · max ${byName[form.primaryProvider].maxPrice}` : ''}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-[#A1A1AA]">Chaîne de secours</Label>
              {form.fallbackProviders.length === 0 ? (
                <p className="text-xs text-[#52525B] p-3 rounded-lg bg-[#0A0A0A] border border-[#1a1a1a]">
                  Aucun secours — si le principal échoue, la création de compte échoue.
                </p>
              ) : (
                <div className="space-y-2">
                  {form.fallbackProviders.map((name, i) => (
                    <div
                      key={name}
                      className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-[#0A0A0A] border border-[#1a1a1a]"
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <span className="text-[10px] text-[#3F3F46] font-mono w-4 shrink-0">{i + 1}</span>
                        <ProviderName descriptor={byName[name]} name={name} />
                      </span>
                      <span className="flex items-center gap-0.5 shrink-0">
                        <Button
                          variant="ghost" size="icon-xs"
                          className="text-[#52525B] hover:text-[#A1A1AA] disabled:opacity-20"
                          disabled={i === 0}
                          onClick={() => moveFallback(i, -1)}
                        >
                          <ArrowUp className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost" size="icon-xs"
                          className="text-[#52525B] hover:text-[#A1A1AA] disabled:opacity-20"
                          disabled={i === form.fallbackProviders.length - 1}
                          onClick={() => moveFallback(i, 1)}
                        >
                          <ArrowDown className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost" size="icon-xs"
                          className="text-[#52525B] hover:text-[#EF4444]"
                          onClick={() => setField({
                            fallbackProviders: form.fallbackProviders.filter(f => f !== name),
                          })}
                        >
                          <X className="w-3 h-3" />
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
                  <SelectTrigger className="bg-[#0A0A0A] border-[#1a1a1a] text-[#52525B]">
                    <span className="flex items-center gap-1.5 text-xs">
                      <Plus className="w-3 h-3" />Ajouter un secours
                    </span>
                  </SelectTrigger>
                  <SelectContent className="bg-[#111111] border-[#1a1a1a] text-[#FAFAFA]">
                    {availableFallbacks.map(name => (
                      <SelectItem key={name} value={name}>
                        {byName[name]?.label || name}
                        {byName[name]?.credentialsReady ? '' : ' — clé manquante'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        )}

        <p className="text-[10px] text-[#3F3F46]">
          Appliqué à la prochaine location de numéro, sans redémarrage du backend. Les clés API,
          services et pays de chaque provider restent dans <span className="font-mono">application.yml</span>.
        </p>
      </CardContent>
    </Card>
  )
}
