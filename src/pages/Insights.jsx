import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import HealthScoreBadge from '@/components/shared/HealthScoreBadge'
import EmptyState from '@/components/shared/EmptyState'
import TimeAgo from '@/components/shared/TimeAgo'
import { apiGet, apiPost } from '@/lib/api'
import {
  Sparkles,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Lightbulb,
  GitCompare,
  HelpCircle,
  Clock,
  Loader2,
  ServerCrash,
  Database,
  FileJson,
  Brain,
  Save,
} from 'lucide-react'

const PHASE_STEPS = [
  { key: 'rollup',           label: 'Rollup',           icon: Database },
  { key: 'digest',           label: 'Digest',           icon: FileJson },
  { key: 'ollama_inference', label: 'AI Inference',     icon: Brain },
  { key: 'parsing',          label: 'Parsing',          icon: FileJson },
  { key: 'persisting',       label: 'Persisting',       icon: Save },
]

const SEVERITY_STYLES = {
  CRITICAL: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/30' },
  WARNING:  { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30' },
  INFO:     { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30' },
}

function formatDuration(ms) {
  if (ms == null) return '—'
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  return `${m}m ${s % 60}s`
}

function PhaseProgress({ currentPhase, status }) {
  const currentIndex = PHASE_STEPS.findIndex(p => p.key === currentPhase)
  const isDone = status === 'DONE'
  const isFailed = status === 'FAILED'

  return (
    <div className="flex items-center gap-2">
      {PHASE_STEPS.map((step, i) => {
        const Icon = step.icon
        const isActive = !isDone && !isFailed && i === currentIndex
        const isCompleted = isDone || (i < currentIndex && !isFailed)
        const isError = isFailed && i === currentIndex

        return (
          <div key={step.key} className="flex items-center gap-2 flex-1">
            <div
              className={`flex items-center gap-1.5 px-2 py-1 rounded-md border transition-colors ${
                isCompleted
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : isActive
                    ? 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                    : isError
                      ? 'bg-red-500/10 border-red-500/30 text-red-400'
                      : 'bg-[#0a0a0a] border-[#1a1a1a] text-[#333]'
              }`}
            >
              {isActive ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Icon size={12} />
              )}
              <span className="text-[10px] font-semibold uppercase tracking-wide">{step.label}</span>
            </div>
            {i < PHASE_STEPS.length - 1 && (
              <div className={`h-px flex-1 ${isCompleted ? 'bg-emerald-500/40' : 'bg-[#1a1a1a]'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

function ListCard({ title, items, icon, color }) {
  const Icon = icon
  return (
    <Card className="bg-[#111] border-[#1a1a1a]">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className={`w-7 h-7 rounded-md flex items-center justify-center ${color.bg}`}>
            <Icon size={14} className={color.text} />
          </div>
          <span className="label-upper !mb-0">{title}</span>
        </div>
        {(!items || items.length === 0) ? (
          <p className="text-xs text-[#333]">—</p>
        ) : (
          <ul className="space-y-2">
            {items.map((item, i) => (
              <li key={i} className="flex gap-2 text-xs text-[#ccc] leading-relaxed">
                <span className={`mt-1 w-1 h-1 rounded-full ${color.dot} shrink-0`} />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

export default function Insights() {
  const queryClient = useQueryClient()
  const [selectedReportId, setSelectedReportId] = useState(null)
  const [generationError, setGenerationError] = useState(null)

  // Liste des rapports
  const { data: listData, refetch: refetchList } = useQuery({
    queryKey: ['ai-insights-list'],
    queryFn: () => apiGet('/api/insights?limit=30'),
    refetchInterval: 10_000,
  })

  const reports = Array.isArray(listData) ? listData : []

  // Derive active report id : selection explicite sinon premier de la liste
  const activeReportId = selectedReportId ?? reports[0]?.id ?? null

  // Rapport actif
  const { data: activeReport } = useQuery({
    queryKey: ['ai-insight', activeReportId],
    queryFn: () => apiGet(`/api/insights/${activeReportId}`),
    enabled: !!activeReportId,
    refetchInterval: (q) => {
      const r = q.state.data
      if (!r) return 3000
      if (r.status === 'DONE' || r.status === 'FAILED') return false
      return 3000
    },
  })

  // Invalider la liste quand le rapport actif passe DONE/FAILED
  useEffect(() => {
    if (activeReport?.status === 'DONE' || activeReport?.status === 'FAILED') {
      queryClient.invalidateQueries({ queryKey: ['ai-insights-list'] })
    }
  }, [activeReport?.status, queryClient])

  const generate = useMutation({
    mutationFn: () => apiPost('/api/insights/generate?trailingDays=30&force=false'),
    onSuccess: (data) => {
      setGenerationError(null)
      if (data?.reportId) {
        setSelectedReportId(data.reportId)
        refetchList()
      }
    },
    onError: (err) => {
      const msg = err?.message || 'Génération échouée'
      if (msg.includes('409') || msg.includes('analysis_in_progress')) {
        setGenerationError('Une analyse est déjà en cours — attends qu\'elle se termine.')
      } else if (msg.includes('503') || msg.toLowerCase().includes('ollama')) {
        setGenerationError('Ollama indisponible. Lance-le via `ollama serve` puis réessaie.')
      } else {
        setGenerationError(msg)
      }
    },
  })

  const isGenerating = activeReport && (activeReport.status === 'PENDING' || activeReport.status === 'RUNNING')
  const isFailed = activeReport?.status === 'FAILED'
  const isDone = activeReport?.status === 'DONE'

  // Détecter Ollama down dans le failureReason
  const ollamaDown = isFailed && (
    activeReport.failureReason?.toLowerCase().includes('unreachable') ||
    activeReport.failureReason?.toLowerCase().includes('timeout')
  )

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <Sparkles size={22} className="text-purple-400" />
            AI Insights
          </h1>
          <p className="text-xs text-[#333] mt-0.5">Analyses quotidiennes générées par Ollama local</p>
        </div>
        <Button
          onClick={() => generate.mutate()}
          disabled={generate.isPending || isGenerating}
          className="bg-purple-500/10 border border-purple-500/30 text-purple-300 hover:bg-purple-500/20"
        >
          {generate.isPending || isGenerating ? (
            <>
              <Loader2 size={14} className="animate-spin mr-2" />
              Génération…
            </>
          ) : (
            <>
              <RefreshCw size={14} className="mr-2" />
              Générer un rapport
            </>
          )}
        </Button>
      </div>

      {/* Generation error banner */}
      {generationError && (
        <Card className="bg-red-500/5 border-red-500/30 mb-4">
          <CardContent className="p-3 flex items-start gap-3">
            <ServerCrash size={16} className="text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-xs font-semibold text-red-300">Erreur de génération</p>
              <p className="text-xs text-red-400/80 mt-0.5">{generationError}</p>
            </div>
            <button
              onClick={() => setGenerationError(null)}
              className="text-red-400/60 hover:text-red-300 text-xs"
            >
              ✕
            </button>
          </CardContent>
        </Card>
      )}

      {/* Phase progress (pendant génération) */}
      {isGenerating && activeReport && (
        <Card className="bg-[#111] border-[#1a1a1a] mb-4">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="label-upper !mb-0">Génération en cours</span>
              <Badge variant="outline" className="text-[10px] border-blue-500/30 text-blue-400">
                {activeReport.status}
              </Badge>
            </div>
            <PhaseProgress currentPhase={activeReport.currentPhase} status={activeReport.status} />
          </CardContent>
        </Card>
      )}

      {/* Failed state */}
      {isFailed && activeReport && (
        <Card className="bg-red-500/5 border-red-500/30 mb-4">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <ServerCrash size={20} className="text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-red-300">
                  {ollamaDown ? 'Ollama indisponible' : 'Génération échouée'}
                </p>
                <p className="text-xs text-red-400/80 mt-1 font-mono">
                  {activeReport.failureReason || 'Raison inconnue'}
                </p>
                {ollamaDown && (
                  <div className="mt-3 p-2 rounded bg-[#0a0a0a] border border-[#1a1a1a]">
                    <p className="text-[10px] text-[#555] uppercase tracking-wide mb-1">Comment résoudre</p>
                    <p className="text-xs text-[#ccc]">
                      Lance Ollama dans un terminal :
                    </p>
                    <code className="block mt-1 text-xs text-purple-300 bg-black/50 px-2 py-1 rounded">
                      ollama serve
                    </code>
                    <p className="text-xs text-[#666] mt-2">
                      Vérifie aussi que le modèle est téléchargé : <code className="text-[#888]">ollama pull gemma4:e4b</code>
                    </p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Rapport actif (DONE) */}
      {isDone && activeReport && (
        <>
          {/* Health score + meta */}
          <Card className="bg-[#111] border-[#1a1a1a] mb-4">
            <CardContent className="p-6">
              <div className="flex items-center gap-6 flex-wrap">
                <HealthScoreBadge score={activeReport.healthScore ?? 0} size={80} />
                <div className="flex-1 min-w-[200px]">
                  <p className="label-upper">Focus day</p>
                  <p className="text-xl font-bold text-white">{activeReport.focusDay}</p>
                  <div className="flex gap-4 mt-2 text-xs text-[#555]">
                    <span className="flex items-center gap-1">
                      <Clock size={11} />
                      Généré <TimeAgo date={activeReport.generatedAt} />
                    </span>
                    <span>Durée : {formatDuration(activeReport.generationDurationMs)}</span>
                    <span>Modèle : <span className="text-[#888]">{activeReport.model}</span></span>
                  </div>
                </div>
                {!activeReport.parseSucceeded && (
                  <Badge variant="outline" className="border-amber-500/30 text-amber-400 text-[10px]">
                    Parse partiel
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Anomalies */}
          {activeReport.digestSnapshot?.anomalies?.length > 0 && (
            <Card className="bg-[#111] border-[#1a1a1a] mb-4">
              <CardContent className="p-4">
                <span className="label-upper block mb-3">Anomalies détectées</span>
                <div className="space-y-2">
                  {activeReport.digestSnapshot.anomalies.map((a, i) => {
                    const style = SEVERITY_STYLES[a.severity] || SEVERITY_STYLES.INFO
                    return (
                      <div
                        key={i}
                        className={`p-3 rounded-md border ${style.bg} ${style.border}`}
                      >
                        <div className="flex items-start gap-2">
                          <AlertTriangle size={14} className={`${style.text} shrink-0 mt-0.5`} />
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`text-[10px] font-bold uppercase tracking-wide ${style.text}`}>
                                {a.severity}
                              </span>
                              <span className="text-[10px] text-[#666] font-mono">{a.type}</span>
                            </div>
                            <p className="text-xs text-[#ccc]">{a.description}</p>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* 3 columns : Highlights / Concerns / Recommendations */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-4">
            <ListCard
              title="Highlights"
              items={activeReport.highlights}
              icon={CheckCircle2}
              color={{ bg: 'bg-emerald-500/10', text: 'text-emerald-400', dot: 'bg-emerald-400' }}
            />
            <ListCard
              title="Concerns"
              items={activeReport.concerns}
              icon={AlertCircle}
              color={{ bg: 'bg-red-500/10', text: 'text-red-400', dot: 'bg-red-400' }}
            />
            <ListCard
              title="Recommendations"
              items={activeReport.recommendations}
              icon={Lightbulb}
              color={{ bg: 'bg-blue-500/10', text: 'text-blue-400', dot: 'bg-blue-400' }}
            />
          </div>

          {/* Comparative + Ask clarification */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-4">
            <ListCard
              title="Comparative analysis"
              items={activeReport.comparativeAnalysis}
              icon={GitCompare}
              color={{ bg: 'bg-purple-500/10', text: 'text-purple-400', dot: 'bg-purple-400' }}
            />
            <ListCard
              title="Questions ouvertes"
              items={activeReport.askClarification}
              icon={HelpCircle}
              color={{ bg: 'bg-cyan-500/10', text: 'text-cyan-400', dot: 'bg-cyan-400' }}
            />
          </div>
        </>
      )}

      {/* History table */}
      <Card className="bg-[#111] border-[#1a1a1a]">
        <CardContent className="p-4">
          <span className="label-upper block mb-3">Historique des rapports</span>
          {reports.length === 0 ? (
            <EmptyState
              icon={Sparkles}
              title="Aucun rapport généré"
              description="Clique sur « Générer un rapport » pour créer le premier."
            />
          ) : (
            <div className="overflow-hidden rounded-md border border-[#1a1a1a]">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#1a1a1a]">
                    <th className="px-3 py-2 text-left label-upper !text-[10px] !mb-0">Focus day</th>
                    <th className="px-3 py-2 text-left label-upper !text-[10px] !mb-0">Status</th>
                    <th className="px-3 py-2 text-right label-upper !text-[10px] !mb-0">Health</th>
                    <th className="px-3 py-2 text-right label-upper !text-[10px] !mb-0">Durée</th>
                    <th className="px-3 py-2 text-left label-upper !text-[10px] !mb-0">Généré</th>
                    <th className="px-3 py-2 text-left label-upper !text-[10px] !mb-0">Modèle</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map((r) => {
                    const isActive = r.id === activeReportId
                    const statusColor =
                      r.status === 'DONE' ? 'text-emerald-400' :
                      r.status === 'FAILED' ? 'text-red-400' :
                      r.status === 'RUNNING' ? 'text-blue-400' :
                      'text-[#888]'
                    return (
                      <tr
                        key={r.id}
                        onClick={() => setSelectedReportId(r.id)}
                        className={`border-b border-[#141414] last:border-0 cursor-pointer transition-colors ${
                          isActive ? 'bg-purple-500/5' : 'hover:bg-[#0f0f0f]'
                        }`}
                      >
                        <td className="px-3 py-2.5 text-white font-medium">{r.focusDay}</td>
                        <td className={`px-3 py-2.5 font-mono ${statusColor}`}>{r.status}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-[#ccc]">
                          {r.healthScore != null ? r.healthScore : '—'}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono text-[#555]">
                          {formatDuration(r.generationDurationMs)}
                        </td>
                        <td className="px-3 py-2.5 text-[#555]">
                          <TimeAgo date={r.generatedAt} />
                        </td>
                        <td className="px-3 py-2.5 text-[#555] font-mono text-[10px]">{r.model}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
