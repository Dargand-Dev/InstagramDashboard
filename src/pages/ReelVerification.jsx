import { useState, useEffect, useMemo, useCallback } from 'react'
import { useQueryClient, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  useStartScan, useScanStatus, useMissingReels, useRecheckOne, useDismissOne,
} from '@/hooks/useReelVerification'
import { apiGet, apiPost } from '@/lib/api'
import DataTable from '@/components/shared/DataTable'
import EmptyState from '@/components/shared/EmptyState'
import TimeAgo from '@/components/shared/TimeAgo'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  ShieldCheck, RefreshCw, CheckCircle2, AlertCircle, Clock, EyeOff, Smartphone, Container,
} from 'lucide-react'

const ALL_DEVICES = '__all__'
const NO_DEVICE = '__none__'

const WINDOWS = [
  { value: 1,  label: '1 heure' },
  { value: 6,  label: '6 heures' },
  { value: 24, label: '24 heures' },
]

export default function ReelVerification() {
  const [hours, setHours] = useState(6)
  const [scanId, setScanId] = useState(null)
  const [deviceFilter, setDeviceFilter] = useState(ALL_DEVICES)
  const [bulkRecheck, setBulkRecheck] = useState(null) // { done, total } pendant un re-check global

  const qc = useQueryClient()
  const startScan = useStartScan()
  const scanStatus = useScanStatus(scanId)
  const missing = useMissingReels(hours)
  const recheck = useRecheckOne()
  const dismiss = useDismissOne()

  // Comptes + devices pour résoudre containerId / craneContainer / rotatingUrl
  // afin de permettre l'ouverture du conteneur directement depuis la ligne.
  const accounts = useQuery({
    queryKey: ['accounts'],
    queryFn: () => apiGet('/api/accounts'),
    staleTime: 30_000,
  })
  const devices = useQuery({
    queryKey: ['devices'],
    queryFn: () => apiGet('/api/devices'),
    staleTime: 30_000,
  })
  // Historique utilisé comme dénominateur pour le taux de fail par device
  // sur la fenêtre courante. limit=500 max côté backend.
  const postingHistory = useQuery({
    queryKey: ['posting-history', 500],
    queryFn: () => apiGet('/api/automation/posting-history?limit=500'),
    staleTime: 30_000,
  })

  const accountByUsername = useMemo(() => {
    const list = Array.isArray(accounts.data) ? accounts.data : (accounts.data?.data || [])
    const map = new Map()
    for (const a of list) if (a.username) map.set(a.username, a)
    return map
  }, [accounts.data])

  const deviceByUdid = useMemo(() => {
    const list = Array.isArray(devices.data) ? devices.data : (devices.data?.data || [])
    const map = new Map()
    for (const d of list) if (d.udid) map.set(d.udid, d)
    return map
  }, [devices.data])

  // Surface l'erreur de polling (scanId expiré / backend down) et reset le spinner.
  // setScanId est différé via setTimeout pour éviter un setState synchrone dans l'effet.
  useEffect(() => {
    if (!scanId || !scanStatus.isError) return
    toast.error('Impossible de suivre le scan — statut indisponible')
    const id = setTimeout(() => setScanId(null), 0)
    return () => clearTimeout(id)
  }, [scanId, scanStatus.isError])

  // Gère la notification de fin + reset du scanId (pour masquer le spinner) +
  // invalide la liste MISSING pour qu'elle reflète les nouveaux résultats.
  useEffect(() => {
    const status = scanStatus.data?.status
    if (!scanId || !status) return
    if (status !== 'RUNNING') {
      const errors = scanStatus.data.errors ?? 0
      const missingCount = scanStatus.data.missingCount ?? 0
      if (status === 'COMPLETED') {
        toast.success(`Scan terminé — ${missingCount} manquant(s)${errors > 0 ? `, ${errors} erreur(s)` : ''}`)
        // Refresh la liste MISSING côté page — les entries ont été mises à jour en base
        // pendant le scan async, donc invalider ici (et pas seulement onSuccess de startScan).
        qc.invalidateQueries({ queryKey: ['reel-verification', 'missing'] })
      } else if (status === 'FAILED') {
        toast.error(`Scan échoué — ${scanStatus.data.error || 'erreur inconnue'}`)
      }
      const id = setTimeout(() => setScanId(null), 5000)
      return () => clearTimeout(id)
    }
  }, [scanId, scanStatus.data?.status, scanStatus.data?.missingCount, scanStatus.data?.errors, scanStatus.data?.error, qc])

  const handleScan = async () => {
    try {
      const resp = await startScan.mutateAsync(hours)
      if (resp?.locked) {
        toast.error('Système verrouillé, réessayer plus tard')
        return
      }
      if (resp?.total === 0) {
        toast.info('Aucun post récent dans la fenêtre — rien à scanner')
        return
      }
      setScanId(resp.scanId)
    } catch (e) {
      toast.error(`Scan impossible — ${e.message}`)
    }
  }

  const handleRecheck = useCallback(async (entryId) => {
    try {
      const resp = await recheck.mutateAsync(entryId)
      if (resp?.verificationStatus === 'VERIFIED') {
        toast.success('Reel retrouvé sur Instagram')
      } else {
        toast.info('Toujours introuvable sur Instagram')
      }
    } catch (e) {
      toast.error(`Re-vérif KO — ${e.message}`)
    }
  }, [recheck])

  // Re-vérifie en masse toutes les entries actuellement listées (après filtre device).
  // Concurrence limitée (3) pour ne pas saturer le backend / RapidAPI côté scraper.
  const handleRecheckAll = useCallback(async (entryIds) => {
    if (entryIds.length === 0) return
    const CONCURRENCY = 3
    let done = 0
    let verified = 0
    let stillMissing = 0
    let errors = 0
    setBulkRecheck({ done: 0, total: entryIds.length })

    const queue = entryIds.slice()
    const workers = Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
      while (queue.length > 0) {
        const id = queue.shift()
        if (!id) break
        try {
          const resp = await recheck.mutateAsync(id)
          if (resp?.verificationStatus === 'VERIFIED') verified++
          else stillMissing++
        } catch {
          errors++
        }
        done++
        setBulkRecheck({ done, total: entryIds.length })
      }
    })
    await Promise.all(workers)
    setBulkRecheck(null)

    if (errors > 0) {
      toast.error(`Re-vérif terminée — ${verified} retrouvé(s), ${stillMissing} introuvable(s), ${errors} erreur(s)`)
    } else if (verified > 0) {
      toast.success(`Re-vérif terminée — ${verified} retrouvé(s), ${stillMissing} toujours introuvable(s)`)
    } else {
      toast.info(`Re-vérif terminée — ${stillMissing} toujours introuvable(s)`)
    }
  }, [recheck])

  const handleDismiss = useCallback(async (entryId) => {
    try {
      await dismiss.mutateAsync(entryId)
      toast.success('Reel ignoré')
    } catch (e) {
      toast.error(`Impossible d'ignorer — ${e.message}`)
    }
  }, [dismiss])

  const handleOpenContainer = useCallback(async (row) => {
    const account = accountByUsername.get(row.username)
    if (!account) {
      toast.error('Compte introuvable')
      return
    }
    if (!account.deviceUdid || !account.containerId) {
      toast.error('Aucun conteneur assigné à ce compte')
      return
    }
    const device = deviceByUdid.get(account.deviceUdid)
    try {
      const resp = await apiPost('/api/automation/execute', {
        actionName: 'SwitchCraneContainer',
        deviceUdid: account.deviceUdid,
        parameters: {
          containerId: account.containerId,
          containerName: account.craneContainer,
          proxyRotateUrl: device?.rotatingUrl || undefined,
        },
      })
      if (resp?.locked) {
        toast.error('Système verrouillé, réessayer plus tard')
        return
      }
      toast.success('Ouverture du conteneur en file')
    } catch (e) {
      toast.error(`Échec : ${e.message}`)
    }
  }, [accountByUsername, deviceByUdid])

  const scanRunning = scanStatus.data?.status === 'RUNNING'
  const allRecords = useMemo(
    () => (Array.isArray(missing.data) ? missing.data : (missing.data?.data || [])),
    [missing.data],
  )

  // Liste triée et dédupliquée des devices présents dans les résultats, pour alimenter le filtre.
  // Les entries sans device sont regroupées sous NO_DEVICE (option "Sans téléphone").
  const devicesInResults = useMemo(() => {
    const byUdid = new Map()
    let hasOrphan = false
    for (const r of allRecords) {
      if (r.deviceUdid) {
        if (!byUdid.has(r.deviceUdid)) {
          byUdid.set(r.deviceUdid, r.deviceName || r.deviceUdid)
        }
      } else {
        hasOrphan = true
      }
    }
    const sorted = Array.from(byUdid, ([udid, name]) => ({ udid, name }))
      .sort((a, b) => a.name.localeCompare(b.name))
    return { list: sorted, hasOrphan }
  }, [allRecords])

  const records = useMemo(() => {
    if (deviceFilter === ALL_DEVICES) return allRecords
    if (deviceFilter === NO_DEVICE) return allRecords.filter(r => !r.deviceUdid)
    return allRecords.filter(r => r.deviceUdid === deviceFilter)
  }, [allRecords, deviceFilter])

  const uniqueUsers = useMemo(
    () => new Set(records.map(r => r.username)).size,
    [records],
  )

  // Taux de fail par device sur la fenêtre courante :
  //   fail% = manquants_device / total_posté_device (sur `hours`).
  // On utilise allRecords (pas records) pour ne pas dépendre du filtre device.
  // Dénominateur via /posting-history (500 dernières entries) croisé avec
  // accountByUsername pour résoudre username → deviceUdid.
  // Borne basse de la fenêtre : on s'aligne sur dataUpdatedAt de React Query
  // (timestamp stable qui change quand la data est rafraîchie) — évite d'appeler
  // Date.now() dans un useMemo (règle react-hooks/purity). Si la query n'a pas
  // encore fetché, dataUpdatedAt = 0 → cutoff très négatif → pas de filtrage
  // (mais entries sera vide de toute façon, donc pas d'impact).
  const cutoffMs = useMemo(
    () => postingHistory.dataUpdatedAt - hours * 3600_000,
    [postingHistory.dataUpdatedAt, hours],
  )

  const deviceFailStats = useMemo(() => {
    const entries = postingHistory.data?.entries || []
    const totalsByUdid = new Map() // udid → count posté sur la fenêtre
    for (const e of entries) {
      if (!e.postedAt) continue
      const t = new Date(e.postedAt).getTime()
      if (isNaN(t) || t < cutoffMs) continue
      const acc = accountByUsername.get(e.username)
      const udid = acc?.deviceUdid
      if (!udid) continue
      totalsByUdid.set(udid, (totalsByUdid.get(udid) || 0) + 1)
    }
    const missingByUdid = new Map()
    const nameByUdid = new Map()
    for (const r of allRecords) {
      if (!r.deviceUdid) continue
      missingByUdid.set(r.deviceUdid, (missingByUdid.get(r.deviceUdid) || 0) + 1)
      if (r.deviceName) nameByUdid.set(r.deviceUdid, r.deviceName)
    }
    const list = []
    for (const [udid, total] of totalsByUdid) {
      const missingCount = missingByUdid.get(udid) || 0
      const name = nameByUdid.get(udid) || deviceByUdid.get(udid)?.name || udid.slice(-8)
      list.push({
        udid,
        name,
        missing: missingCount,
        total,
        failPct: total > 0 ? (missingCount / total) * 100 : 0,
      })
    }
    // Tri : fail% décroissant, puis nb de manquants décroissant
    return list.sort((a, b) => b.failPct - a.failPct || b.missing - a.missing)
  }, [postingHistory.data, allRecords, accountByUsername, deviceByUdid, cutoffMs])

  const columns = useMemo(() => [
    {
      accessorKey: 'username',
      header: 'Compte',
      cell: ({ row }) => <span className="font-mono">@{row.original.username}</span>,
    },
    {
      accessorKey: 'deviceName',
      header: 'Téléphone',
      cell: ({ row }) => (
        row.original.deviceName
          ? <span className="text-sm">{row.original.deviceName}</span>
          : <span className="text-xs text-muted-foreground italic">—</span>
      ),
    },
    {
      accessorKey: 'baseVideo',
      header: 'Fichier',
      cell: ({ row }) => <span className="text-sm">{row.original.baseVideo}</span>,
    },
    {
      accessorKey: 'postedAt',
      header: 'Posté à',
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="text-sm">{new Date(row.original.postedAt).toLocaleTimeString('fr-FR')}</span>
          <TimeAgo date={row.original.postedAt} className="text-xs text-muted-foreground" />
        </div>
      ),
    },
    {
      accessorKey: 'verificationStatus',
      header: 'Statut',
      cell: () => (
        <Badge variant="destructive" className="gap-1">
          <AlertCircle className="h-3 w-3" />
          MANQUANT
        </Badge>
      ),
    },
    {
      id: 'action',
      header: '',
      cell: ({ row }) => {
        const account = accountByUsername.get(row.original.username)
        const canOpenContainer = !!(account?.containerId && account?.deviceUdid)
        return (
          <div className="flex gap-2 justify-end">
            <Button
              size="sm"
              variant="outline"
              disabled={!canOpenContainer}
              onClick={() => handleOpenContainer(row.original)}
              title={canOpenContainer ? 'Rotate proxy & ouvrir le conteneur' : 'Aucun conteneur assigné à ce compte'}
            >
              <Container className="h-3 w-3 mr-1" />
              Ouvrir conteneur
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={dismiss.isPending}
              onClick={() => handleDismiss(row.original.entryId)}
            >
              <EyeOff className="h-3 w-3 mr-1" />
              Ignorer
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={recheck.isPending}
              onClick={() => handleRecheck(row.original.entryId)}
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Re-vérifier
            </Button>
          </div>
        )
      },
    },
  ], [recheck.isPending, dismiss.isPending, handleRecheck, handleDismiss, handleOpenContainer, accountByUsername])

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <ShieldCheck className="h-6 w-6" />
            Vérification Reels
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Comptes ACTIVE ayant posté récemment — vérifie la présence du reel sur Instagram.
          </p>
        </div>
      </div>

      {/* Controls */}
      <Card>
        <CardContent className="pt-6 flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Fenêtre :</span>
            <div className="flex gap-1">
              {WINDOWS.map(w => (
                <Button
                  key={w.value}
                  size="sm"
                  variant={hours === w.value ? 'default' : 'outline'}
                  onClick={() => setHours(w.value)}
                  disabled={scanRunning}
                >
                  {w.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Smartphone className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Téléphone :</span>
            <Select value={deviceFilter} onValueChange={setDeviceFilter}>
              <SelectTrigger className="h-8 w-[200px]">
                <SelectValue placeholder="Tous" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_DEVICES}>Tous les téléphones</SelectItem>
                {devicesInResults.hasOrphan && (
                  <SelectItem value={NO_DEVICE}>Sans téléphone</SelectItem>
                )}
                {devicesInResults.list.map(d => (
                  <SelectItem key={d.udid} value={d.udid}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => handleRecheckAll(records.map(r => r.entryId))}
              disabled={
                !!bulkRecheck
                || scanRunning
                || records.length === 0
              }
              title="Re-vérifie toutes les entries actuellement listées"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${bulkRecheck ? 'animate-spin' : ''}`} />
              {bulkRecheck
                ? `Re-vérif… (${bulkRecheck.done}/${bulkRecheck.total})`
                : `Tout re-vérifier${records.length > 0 ? ` (${records.length})` : ''}`}
            </Button>
            <Button
              onClick={handleScan}
              disabled={scanRunning || startScan.isPending || !!bulkRecheck}
            >
              {scanRunning
                ? `Scan en cours… (${scanStatus.data?.done ?? 0}/${scanStatus.data?.total ?? 0})`
                : 'Scanner maintenant'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <AlertCircle className="h-4 w-4" /> Reels manquants
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-3xl font-semibold">{records.length}</span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" /> Fenêtre
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-3xl font-semibold">{hours}h</span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Comptes concernés</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-3xl font-semibold">{uniqueUsers}</span>
          </CardContent>
        </Card>
      </div>

      {/* Taux de fail par device sur la fenêtre courante */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
            <Smartphone className="h-4 w-4" /> Taux de fail par téléphone ({hours}h)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {postingHistory.isLoading ? (
            <Skeleton className="h-16 w-full" />
          ) : deviceFailStats.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucun post sur la fenêtre — rien à mesurer.
            </p>
          ) : (
            <div className="space-y-2">
              {deviceFailStats.map(d => {
                const pctColor =
                  d.failPct >= 50 ? 'text-red-400'
                  : d.failPct >= 20 ? 'text-amber-400'
                  : d.failPct > 0 ? 'text-yellow-400'
                  : 'text-emerald-400'
                const barColor =
                  d.failPct >= 50 ? 'bg-red-500'
                  : d.failPct >= 20 ? 'bg-amber-500'
                  : d.failPct > 0 ? 'bg-yellow-500'
                  : 'bg-emerald-500'
                return (
                  <div key={d.udid} className="flex items-center gap-3">
                    <span className="text-sm font-medium w-[140px] truncate">{d.name}</span>
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full ${barColor}`}
                        style={{ width: `${Math.min(d.failPct, 100)}%` }}
                      />
                    </div>
                    <span className={`text-sm font-mono font-semibold w-[60px] text-right ${pctColor}`}>
                      {d.failPct.toFixed(0)}%
                    </span>
                    <span className="text-xs text-muted-foreground font-mono w-[70px] text-right">
                      {d.missing}/{d.total}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Table / empty state */}
      {missing.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : records.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="Aucun reel manquant"
          description="Tous les reels récents sont bien visibles sur Instagram."
        />
      ) : (
        <DataTable columns={columns} data={records} pageSize={25} />
      )}
    </div>
  )
}
