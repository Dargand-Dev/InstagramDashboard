import { useState, useEffect, useMemo } from 'react'
import { toast } from 'sonner'
import {
  useStartScan, useScanStatus, useMissingReels, useRecheckOne,
} from '@/hooks/useReelVerification'
import DataTable from '@/components/shared/DataTable'
import EmptyState from '@/components/shared/EmptyState'
import TimeAgo from '@/components/shared/TimeAgo'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ShieldCheck, RefreshCw, CheckCircle2, AlertCircle, Clock,
} from 'lucide-react'

const WINDOWS = [
  { value: 1,  label: '1 heure' },
  { value: 6,  label: '6 heures' },
  { value: 24, label: '24 heures' },
]

export default function ReelVerification() {
  const [hours, setHours] = useState(6)
  const [scanId, setScanId] = useState(null)

  const startScan = useStartScan()
  const scanStatus = useScanStatus(scanId)
  const missing = useMissingReels(hours)
  const recheck = useRecheckOne()

  // Gère la notification de fin + reset du scanId (pour masquer le spinner)
  useEffect(() => {
    const status = scanStatus.data?.status
    if (!scanId || !status) return
    if (status !== 'RUNNING') {
      const errors = scanStatus.data.errors ?? 0
      const missingCount = scanStatus.data.missingCount ?? 0
      if (status === 'COMPLETED') {
        toast.success(`Scan terminé — ${missingCount} manquant(s)${errors > 0 ? `, ${errors} erreur(s)` : ''}`)
      } else if (status === 'FAILED') {
        toast.error(`Scan échoué — ${scanStatus.data.error || 'erreur inconnue'}`)
      }
      const id = setTimeout(() => setScanId(null), 5000)
      return () => clearTimeout(id)
    }
  }, [scanId, scanStatus.data?.status, scanStatus.data?.missingCount, scanStatus.data?.errors, scanStatus.data?.error])

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

  const handleRecheck = async (entryId) => {
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
  }

  const scanRunning = scanStatus.data?.status === 'RUNNING'
  const records = useMemo(
    () => (Array.isArray(missing.data) ? missing.data : (missing.data?.data || [])),
    [missing.data],
  )
  const uniqueUsers = useMemo(
    () => new Set(records.map(r => r.username)).size,
    [records],
  )

  const columns = [
    {
      accessorKey: 'username',
      header: 'Compte',
      cell: ({ row }) => <span className="font-mono">@{row.original.username}</span>,
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
      cell: ({ row }) => (
        <Button
          size="sm"
          variant="outline"
          disabled={recheck.isPending}
          onClick={() => handleRecheck(row.original.entryId)}
        >
          <RefreshCw className="h-3 w-3 mr-1" />
          Re-vérifier
        </Button>
      ),
    },
  ]

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

          <Button
            onClick={handleScan}
            disabled={scanRunning || startScan.isPending}
            className="ml-auto"
          >
            {scanRunning
              ? `Scan en cours… (${scanStatus.data?.done ?? 0}/${scanStatus.data?.total ?? 0})`
              : 'Scanner maintenant'}
          </Button>
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
