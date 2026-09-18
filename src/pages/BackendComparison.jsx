import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer,
  Tooltip as RechartsTooltip, XAxis, YAxis,
} from 'recharts'
import { apiGet } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import EmptyState from '@/components/shared/EmptyState'
import { Box, Info, Scale } from 'lucide-react'
import { backendColor, backendLabel } from '@/hooks/useDeviceBackend'

const WINDOWS = [
  { days: 30, label: '30 j' },
  { days: 90, label: '90 j' },
  { days: 365, label: '1 an' },
]

/** Au-delà de cette date, tout tournait sur doritos ; avant, sur Crane. */
const CUTOVER_LABEL = '1er septembre 2026'

export default function BackendComparison() {
  const [days, setDays] = useState(90)

  const { data, isLoading, error } = useQuery({
    queryKey: ['backend-comparison', days],
    queryFn: () => apiGet(`/api/stats/backend-comparison?days=${days}`),
  })

  // Mémoïsé : `data?.backends || []` rend un tableau neuf à chaque render, ce qui invaliderait
  // le useMemo du graphe en permanence.
  const backends = useMemo(() => data?.backends || [], [data])
  const hasData = backends.some((b) => b.runs.total > 0 || b.accounts.created > 0)

  // Un point par workflow, une barre par backend : c'est la lecture qui répond à la question
  // « laquelle des deux stacks fait passer mes runs », workflow par workflow.
  const chartData = useMemo(() => {
    const byWorkflow = new Map()
    for (const backend of backends) {
      for (const w of backend.runs.byWorkflowType || []) {
        if (!byWorkflow.has(w.workflowType)) byWorkflow.set(w.workflowType, { workflowType: w.workflowType })
        byWorkflow.get(w.workflowType)[backend.backend] = w.successRate
      }
    }
    return [...byWorkflow.values()]
  }, [backends])

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-lg font-semibold text-[#FAFAFA] flex items-center gap-2">
            <Scale className="w-4 h-4 text-[#A1A1AA]" />
            Doritos vs Crane + Ghost
          </h1>
          <p className="text-xs text-[#52525B] mt-1">
            Taux de succès des runs et durée de vie des comptes, par outillage de containers.
          </p>
        </div>
        <div className="flex gap-1">
          {WINDOWS.map((w) => (
            <button
              key={w.days}
              type="button"
              onClick={() => setDays(w.days)}
              className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${
                days === w.days
                  ? 'bg-[#1a1a1a] border-[#2a2a2a] text-[#FAFAFA]'
                  : 'bg-transparent border-[#1a1a1a] text-[#52525B] hover:text-[#A1A1AA]'
              }`}
            >
              {w.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-start gap-2 p-3 rounded-lg bg-[#111111] border border-[#1a1a1a]">
        <Info className="w-3.5 h-3.5 text-[#52525B] shrink-0 mt-0.5" />
        <p className="text-xs text-[#52525B]">
          Chaque run et chaque compte porte l'outillage utilisé <em>au moment de sa création</em>,
          pas le réglage actuel du téléphone — basculer un device ne réécrit donc pas son passé.
          Les données antérieures au {CUTOVER_LABEL} sont attribuées par date : avant cette
          bascule, seule la stack Crane + Ghost existait.
        </p>
      </div>

      {error ? (
        <EmptyState
          icon={Box}
          title="Comparaison indisponible"
          description={error.message || 'Impossible de charger les statistiques.'}
        />
      ) : isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-80 w-full bg-[#111111]" />
          <Skeleton className="h-80 w-full bg-[#111111]" />
        </div>
      ) : !hasData ? (
        <EmptyState
          icon={Box}
          title="Pas encore de données"
          description={`Aucun run ni compte estampillé sur les ${days} derniers jours.`}
        />
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {backends.map((b) => <BackendColumn key={b.backend} summary={b} />)}
          </div>

          {chartData.length > 0 && (
            <Card className="bg-[#111111] border-[#1a1a1a]">
              <CardContent className="p-4">
                <span className="text-xs text-[#52525B] uppercase tracking-wider font-medium block mb-4">
                  Taux de succès par workflow (%)
                </span>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={chartData}>
                    <CartesianGrid stroke="#1a1a1a" strokeDasharray="3 3" />
                    <XAxis dataKey="workflowType" tick={{ fill: '#A1A1AA', fontSize: 11 }} axisLine={{ stroke: '#1a1a1a' }} tickLine={false} />
                    <YAxis domain={[0, 100]} unit="%" tick={{ fill: '#52525B', fontSize: 10 }} axisLine={{ stroke: '#1a1a1a' }} tickLine={false} />
                    <RechartsTooltip
                      contentStyle={{ backgroundColor: '#111', border: '1px solid #1a1a1a', borderRadius: 8, fontSize: 12 }}
                      labelStyle={{ color: '#999' }}
                      formatter={(value, name) => [`${value} %`, backendLabel(name)]}
                    />
                    <Legend iconType="square" wrapperStyle={{ fontSize: 11, color: '#A1A1AA' }} formatter={backendLabel} />
                    <Bar dataKey="DORITOS" fill={backendColor('DORITOS')} radius={[4, 4, 0, 0]} barSize={28} />
                    <Bar dataKey="CRANE_GHOST" fill={backendColor('CRANE_GHOST')} radius={[4, 4, 0, 0]} barSize={28} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}

function BackendColumn({ summary }) {
  const color = backendColor(summary.backend)
  const { runs, accounts } = summary
  const empty = runs.total === 0 && accounts.created === 0

  return (
    <Card className="bg-[#111111] border-[#1a1a1a]">
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Box className="w-4 h-4" style={{ color }} />
            <span className="text-sm font-semibold" style={{ color }}>
              {backendLabel(summary.backend)}
            </span>
          </div>
          <span className="text-xs text-[#52525B]">
            {summary.devices.length > 0 ? summary.devices.join(', ') : 'aucun device'}
          </span>
        </div>

        {empty ? (
          <p className="text-xs text-[#3f3f46] py-6 text-center">Aucune donnée sur cette période.</p>
        ) : (
          <>
            <Section title="Runs">
              <Stat label="Taux de succès" value={`${runs.successRate} %`} highlight={color} />
              <Stat label="Total" value={runs.total} />
              <Stat label="Échecs" value={runs.failure} />
              <Stat label="Durée moyenne" value={formatDuration(runs.avgDurationMs)} />
            </Section>

            {runs.byWorkflowType.length > 0 && (
              <div className="space-y-1">
                {runs.byWorkflowType.map((w) => (
                  <div key={w.workflowType} className="flex items-center justify-between text-xs">
                    <span className="text-[#A1A1AA]">{w.workflowType}</span>
                    <span className="text-[#52525B]">
                      <span style={{ color }}>{w.successRate} %</span> · {w.total} run(s)
                    </span>
                  </div>
                ))}
              </div>
            )}

            <Section title="Comptes">
              <Stat label="Créés" value={accounts.created} />
              <Stat label="Bannis" value={accounts.banned} />
              <Stat label="Taux de ban" value={`${accounts.banRate} %`} />
              <Stat label="Encore actifs" value={accounts.alive} />
            </Section>

            <Section title="Durée de vie">
              <Stat
                label="Médiane avant ban"
                value={accounts.banned > 0 ? `${accounts.medianLifetimeDays} j` : '—'}
                highlight={color}
              />
              <Stat
                label="Moyenne avant ban"
                value={accounts.banned > 0 ? `${accounts.avgLifetimeDays} j` : '—'}
              />
              <Stat
                label="Âge des survivants"
                value={accounts.alive > 0 ? `${accounts.avgAgeOfLivingDays} j` : '—'}
              />
            </Section>
          </>
        )}
      </CardContent>
    </Card>
  )
}

function Section({ title, children }) {
  return (
    <div className="space-y-2">
      <p className="text-[11px] uppercase tracking-wide text-[#52525B]">{title}</p>
      <div className="grid grid-cols-2 gap-2">{children}</div>
    </div>
  )
}

function Stat({ label, value, highlight }) {
  return (
    <div className="p-2.5 rounded-md bg-[#0A0A0A] border border-[#1a1a1a]">
      <p className="text-[10px] text-[#52525B] uppercase tracking-wide">{label}</p>
      <p className="text-sm font-medium mt-0.5" style={{ color: highlight || '#FAFAFA' }}>{value}</p>
    </div>
  )
}

function formatDuration(ms) {
  if (!ms) return '—'
  const minutes = Math.round(ms / 60000)
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  return `${hours} h ${String(minutes % 60).padStart(2, '0')}`
}
