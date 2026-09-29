import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPut } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { SETTINGS_THEME } from './settingsTheme'
import { namePoolPayload, parseUsernames } from './identityNamePoolDraft'

function NamePoolForm({ pool, onSave, isPending, conflict, onReload, reloading }) {
  const [version] = useState(pool.version)
  const [enabled, setEnabled] = useState(pool.enabled)
  const [firstName, setFirstName] = useState(pool.firstName || '')
  const [text, setText] = useState((pool.usernames || []).join('\n'))
  const [error, setError] = useState('')
  const count = parseUsernames(text).length

  function submit(event) {
    event.preventDefault()
    try {
      const payload = namePoolPayload({ enabled, firstName, text, version })
      setError('')
      onSave(payload)
    } catch (failure) {
      setError(failure.message)
    }
  }

  return <form id="identity-name-pool-form" onSubmit={submit} className="flex flex-col gap-5">
    <div className="flex items-start justify-between gap-4">
      <div className="flex flex-col gap-1">
        <Label htmlFor="identity-name-pool-enabled">Utiliser une liste personnalisée</Label>
        <p id="identity-name-pool-mode-help" className="text-sm text-muted-foreground">
          {enabled ? 'Cette identité utilisera uniquement les pseudos ci-dessous.' : 'Cette identité utilise la liste commune actuelle.'}
        </p>
      </div>
      <Switch id="identity-name-pool-enabled" checked={enabled} onCheckedChange={setEnabled}
        disabled={isPending} aria-describedby="identity-name-pool-mode-help" />
    </div>
    {enabled && <>
      <div className="flex flex-col gap-2">
        <Label htmlFor="identity-name-pool-first-name">Prénom à l’inscription</Label>
        <Input id="identity-name-pool-first-name" value={firstName} maxLength={64} required
          onChange={event => setFirstName(event.target.value)} disabled={isPending} placeholder="Ex. Tommy" />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="identity-name-pool-usernames">Pseudos disponibles — {count}</Label>
        <Textarea id="identity-name-pool-usernames" className="field-sizing-fixed h-56 resize-y" rows={10} value={text}
          onChange={event => setText(event.target.value)} disabled={isPending}
          placeholder={'tommy.kvx\ntommy.zrle'} aria-describedby="identity-name-pool-help" />
        <p id="identity-name-pool-help" className="text-xs leading-relaxed text-muted-foreground">
          Un pseudo par ligne. Les doublons sont retirés. Chaque pseudo est consommé dès sa sélection,
          même si l’inscription échoue. Quand la liste est vide, les créations de cette identité s’arrêtent.
        </p>
      </div>
    </>}
    {!enabled && <p className="text-xs text-muted-foreground">La liste personnalisée reste conservée pour une prochaine activation.</p>}
    {error && <Alert variant="destructive"><AlertDescription role="alert">{error}</AlertDescription></Alert>}
    {conflict && <Alert variant="destructive"><AlertDescription className="flex flex-col gap-3" role="alert">
      <p>La liste a changé depuis son ouverture. Rechargez le stock restant avant de modifier à nouveau la liste.</p>
      <Button type="button" variant="outline" onClick={onReload} disabled={reloading}>
        {reloading ? 'Chargement…' : 'Recharger et abandonner ce brouillon'}
      </Button>
    </AlertDescription></Alert>}
  </form>
}

export default function IdentityNamePoolDialog({ identityId, onClose }) {
  const queryClient = useQueryClient()
  const queryKey = ['identity-name-pool', identityId]
  const url = `/api/identities/${encodeURIComponent(identityId)}/name-pool`
  const [generation, setGeneration] = useState(0)
  const [conflict, setConflict] = useState(false)
  const { data: pool, isLoading, error, refetch, isFetching, isFetchedAfterMount } = useQuery({
    queryKey, queryFn: () => apiGet(url), refetchOnWindowFocus: false, refetchOnMount: 'always',
  })
  const loadingFreshPool = isLoading || (!isFetchedAfterMount && isFetching)
  const save = useMutation({
    mutationFn: payload => apiPut(url, payload),
    onSuccess: saved => {
      queryClient.setQueryData(queryKey, saved)
      toast.success('Liste de pseudos enregistrée. Elle sera utilisée aux prochaines sélections.')
      onClose()
    },
    onError: failure => {
      if (failure.status === 409) setConflict(true)
      toast.error(failure.message || 'Impossible d’enregistrer les pseudos.')
    },
  })
  async function reload() {
    const result = await refetch()
    if (result.isError) {
      toast.error('Impossible de recharger la liste. Le brouillon est conservé.')
      return
    }
    setConflict(false)
    setGeneration(value => value + 1)
  }

  return <Dialog open onOpenChange={open => { if (!open && !save.isPending) onClose() }}>
    <DialogContent style={SETTINGS_THEME} className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
      <DialogHeader>
        <DialogTitle>Pseudos de création — {identityId}</DialogTitle>
        <DialogDescription>Choisissez la liste utilisée pour les nouveaux comptes de cette identité.</DialogDescription>
      </DialogHeader>
      {loadingFreshPool ? <Skeleton className="h-56 w-full" /> : error ? <Alert variant="destructive">
        <AlertDescription className="flex flex-col gap-3" role="alert">
          <p>{error.status === 404 ? 'La liste est indisponible. Vérifiez que le serveur a chargé la mise à jour et que cette identité existe toujours.' : error.message}</p>
          <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>Réessayer</Button>
        </AlertDescription>
      </Alert> : pool && <NamePoolForm key={generation} pool={pool} onSave={save.mutate}
        isPending={save.isPending} conflict={conflict} onReload={reload} reloading={isFetching} />}
      <DialogFooter>
        <Button variant="outline" onClick={onClose} disabled={save.isPending}>Fermer</Button>
        <Button type="submit" form="identity-name-pool-form" disabled={loadingFreshPool || Boolean(error) || !pool || save.isPending || conflict}>
          {save.isPending ? 'Enregistrement…' : 'Enregistrer la liste'}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
}
