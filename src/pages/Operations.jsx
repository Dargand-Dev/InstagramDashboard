import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, Cell,
} from 'recharts'
import {
  Activity,
  AlertTriangle,
  DollarSign,
  Film,
  UserPlus,
  Smartphone,
  Users,
  Zap,
  RefreshCw,
  Loader2,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import EmptyState from '@/components/shared/EmptyState'
import { apiGet, apiPost } from '@/lib/api'
import { Blur, useIncognito } from '@/contexts/IncognitoContext'

const PERIODS = [
  { key: '1d',  label: 'Aujourd\'hui', days: 1 },
  { key: '7d',  label: '7 jours',      days: 7 },
  { key: '30d', label: '30 jours',     days: 30 },
]

const tooltipStyle = {
  contentStyle: { backgroundColor: '#111', border: '1px solid #1a1a1a', borderRadius: 8, fontSize: 12 },
  labelStyle: { color: '#999', marginBottom: 4 },
  itemStyle: { padding: '2px 0', color: '#ccc' },
}

function formatNumber(n) {
  if (n == null) return '—'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString()
}

function formatCents(cents) {
  if (cents == null) return '—'
  return `$${(cents / 100).toFixed(2)}`
}

function formatPercent(ratio) {
  if (ratio == null) return '—'
  return `${(ratio * 100).toFixed(1)}%`
}

function maskUdid(udid) {
  if (!udid) return '—'
  if (udid.length < 6) return udid
  return `...${udid.slice(-6)}`
}

function KpiCard({ label, value, icon, iconColor, accent }) {
  const Icon = icon
  return (
    <Card className="bg-[#111] border-[#1a1a1a]">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <span className="label-upper">{label}</span>
          <div className={`w-7 h-7 rounded-md flex items-center justify-center ${iconColor}`}>
            <Icon size={14} className={accent} />
          </div>
        </div>
        <div className="text-3xl font-extrabold text-white tracking-tight">{value}</div>
      </CardContent>
    </Card>
  )
}

function BlurredXTick({ x, y, payload, incognito }) {
  return (
    <text x={x} y={y} dy={14} textAnchor="middle" fill="#999" fontSize={11}>
      {incognito ? '•••' : payload.value}
    </text>
  )
}

export default function Operations() {
  const queryClient = useQueryClient()
  const [period, setPeriod] = useState('7d')
  const { isIncognito } = useIncognito()

  const currentPeriod = PERIODS.find(p => p.key === period) ?? PERIODS[1]
  const days = currentPeriod.days

  // L'ancien endpoint /api/analytics/overview (basé sur les rollups quotidiens) a été supprimé
  // avec la migration vers Scraper. La page Operations reste affichée en vue "dégradée" jusqu'à
  // ce qu'une vraie source de données operations soit rebranchée.
  const { data: overview, isLoading, error } = useQuery({
    queryKey: ['ops-overview', days],
    queryFn: async () => ({}),
    refetchInterval: 30_000,
  })

  const rebuild = useMutation({
    mutationFn: async () => ({}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ops-overview'] })
    },
  })

  const topDevices = useMemo(() => overview?.topDevices || [], [overview])
  const topIdentities = useMemo(() => overview?.topIdentities || [], [overview])

  // Chart data : success/fail par device
  const deviceChartData = useMemo(() => {
    return topDevices.slice(0, 10).map(d => ({
      name: maskUdid(d.deviceUdid),
      success: d.tasksSucceeded,
      failed: d.tasksFailed,
      utilization: Math.round((d.avgUtilizationRate || 0) * 100),
    }))
  }, [topDevices])

  const renderXTick = (props) => <BlurredXTick {...props} incognito={isIncognito} />

  if (error) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Operations</h1>
          <p className="text-xs text-[#333] mt-0.5">Device health & automation metrics</p>
        </div>
        <Card className="bg-red-500/5 border-red-500/30">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertTriangle size={16} className="text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-red-300">Impossible de charger les données</p>
              <p className="text-xs text-red-400/80 mt-1 font-mono">{error.message}</p>
              <p className="text-xs text-[#666] mt-2">
                Assure-toi que des rollups existent pour la période. Clique sur « Recalculer » ci-dessous.
              </p>
              <Button
                size="sm"
                onClick={() => rebuild.mutate()}
                disabled={rebuild.isPending}
                className="mt-3 bg-red-500/10 border border-red-500/30 text-red-300 hover:bg-red-500/20"
              >
                {rebuild.isPending ? <Loader2 size={12} className="animate-spin mr-2" /> : <RefreshCw size={12} className="mr-2" />}
                Recalculer le rollup d'hier
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <Activity size={22} className="text-emerald-400" />
            Operations
          </h1>
          <p className="text-xs text-[#333] mt-0.5">Device health & automation metrics</p>
        </div>
        <Button
          onClick={() => rebuild.mutate()}
          disabled={rebuild.isPending}
          variant="ghost"
          size="sm"
          className="border border-[#1a1a1a] text-[#888] hover:text-white hover:border-[#333]"
        >
          {rebuild.isPending ? (
            <>
              <Loader2 size={12} className="animate-spin mr-2" />
              Calcul…
            </>
          ) : (
            <>
              <RefreshCw size={12} className="mr-2" />
              Recalculer rollup
            </>
          )}
        </Button>
      </div>

      {/* Period selector */}
      <div className="flex gap-1.5 mb-6">
        {PERIODS.map(p => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            className={`px-2.5 py-1 rounded-md text-[11px] font-semibold tracking-wide transition-colors border ${
              period === p.key
                ? 'bg-white/10 text-white border-[#333]'
                : 'bg-transparent text-[#555] border-[#1a1a1a] hover:text-white hover:border-[#333]'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <KpiCard
          label="Comptes créés"
          value={isLoading ? '…' : formatNumber(overview?.totalAccountsCreated)}
          icon={UserPlus}
          iconColor="bg-emerald-500/10"
          accent="text-emerald-400"
        />
        <KpiCard
          label="Reels postés"
          value={isLoading ? '…' : formatNumber(overview?.totalReelsPosted)}
          icon={Film}
          iconColor="bg-purple-500/10"
          accent="text-purple-400"
        />
        <KpiCard
          label="Ban rate"
          value={isLoading ? '…' : formatPercent(overview?.globalBanRate)}
          icon={AlertTriangle}
          iconColor="bg-red-500/10"
          accent="text-red-400"
        />
        <KpiCard
          label="Coût SMS"
          value={isLoading ? '…' : formatCents(overview?.totalSmsCostCents)}
          icon={DollarSign}
          iconColor="bg-amber-500/10"
          accent="text-amber-400"
        />
      </div>

      {/* Chart : tasks par device */}
      <Card className="bg-[#111] border-[#1a1a1a] mb-3">
        <CardContent className="p-4">
          <span className="label-upper block mb-4">Tasks par device ({currentPeriod.label})</span>
          {deviceChartData.length === 0 ? (
            <EmptyState
              icon={Smartphone}
              title="Aucune donnée device"
              description="Aucun rollup trouvé. Déclenche un rollup ou attends qu'un workflow tourne."
            />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={deviceChartData} margin={{ left: 10 }}>
                <CartesianGrid stroke="#1a1a1a" strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={renderXTick} axisLine={{ stroke: '#1a1a1a' }} tickLine={false} />
                <YAxis tick={{ fill: '#555', fontSize: 11 }} axisLine={{ stroke: '#1a1a1a' }} tickLine={false} tickFormatter={formatNumber} />
                <RechartsTooltip
                  {...tooltipStyle}
                  cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                  formatter={(v, name) => [formatNumber(v), name]}
                  labelFormatter={isIncognito ? () => '•••' : undefined}
                />
                <Bar dataKey="success" name="Succès" fill="#10b981" stackId="tasks" radius={[0, 0, 0, 0]} />
                <Bar dataKey="failed" name="Échecs" fill="#ef4444" stackId="tasks" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* 2 tables : devices + identities */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Devices table */}
        <Card className="bg-[#111] border-[#1a1a1a]">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Smartphone size={14} className="text-[#888]" />
              <span className="label-upper !mb-0">Top devices</span>
            </div>
            {topDevices.length === 0 ? (
              <p className="text-xs text-[#333] py-6 text-center">Aucune donnée</p>
            ) : (
              <div className="overflow-hidden rounded-md border border-[#1a1a1a]">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[#1a1a1a]">
                      <th className="px-3 py-2 text-left label-upper !text-[10px] !mb-0">Device</th>
                      <th className="px-3 py-2 text-right label-upper !text-[10px] !mb-0">Tasks</th>
                      <th className="px-3 py-2 text-right label-upper !text-[10px] !mb-0">Success rate</th>
                      <th className="px-3 py-2 text-right label-upper !text-[10px] !mb-0">Utilization</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topDevices.map((d, i) => {
                      const successRate = d.tasksExecuted === 0 ? 0 : d.tasksSucceeded / d.tasksExecuted
                      const rateColor = successRate >= 0.9 ? 'text-emerald-400' : successRate >= 0.7 ? 'text-amber-400' : 'text-red-400'
                      return (
                        <tr key={d.deviceUdid || i} className="border-b border-[#141414] last:border-0 hover:bg-[#0f0f0f]">
                          <td className="px-3 py-2.5 text-white font-mono text-[10px]">
                            <Blur>{maskUdid(d.deviceUdid)}</Blur>
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono text-[#ccc]">{formatNumber(d.tasksExecuted)}</td>
                          <td className={`px-3 py-2.5 text-right font-mono ${rateColor}`}>{formatPercent(successRate)}</td>
                          <td className="px-3 py-2.5 text-right font-mono text-[#555]">{formatPercent(d.avgUtilizationRate)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Identities table */}
        <Card className="bg-[#111] border-[#1a1a1a]">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Users size={14} className="text-[#888]" />
              <span className="label-upper !mb-0">Top identities</span>
            </div>
            {topIdentities.length === 0 ? (
              <p className="text-xs text-[#333] py-6 text-center">Aucune donnée</p>
            ) : (
              <div className="overflow-hidden rounded-md border border-[#1a1a1a]">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[#1a1a1a]">
                      <th className="px-3 py-2 text-left label-upper !text-[10px] !mb-0">Identity</th>
                      <th className="px-3 py-2 text-right label-upper !text-[10px] !mb-0">Active</th>
                      <th className="px-3 py-2 text-right label-upper !text-[10px] !mb-0">Banned</th>
                      <th className="px-3 py-2 text-right label-upper !text-[10px] !mb-0">Reels</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topIdentities.map((id, i) => (
                      <tr key={id.identityId || i} className="border-b border-[#141414] last:border-0 hover:bg-[#0f0f0f]">
                        <td className="px-3 py-2.5 text-white font-medium">
                          <Blur>{id.identityId}</Blur>
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono text-emerald-400">{id.accountsActive}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-red-400">{id.accountsBanned}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-purple-400">{formatNumber(id.reelsPosted)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Period footer */}
      {overview?.periodStart && overview?.periodEnd && (
        <div className="mt-4 text-[10px] text-[#444] text-center">
          Période : {overview.periodStart} — {overview.periodEnd}
        </div>
      )}
    </div>
  )
}
