import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine,
} from 'recharts'
import { FlaskConical, RefreshCw, Link2Off } from 'lucide-react'
import { toast } from 'sonner'
import { apiGet, apiPost } from '@/lib/api'
import { Blur } from '@/contexts/IncognitoContext'
import EmptyState from '@/components/shared/EmptyState'

// A/B test sur l'emplacement du lien GetMySocial au seuil highlight (backend : service/linkab).
const GROUPS = {
  HIGHLIGHT: { label: 'Highlight', hint: 'Story avec lien épinglée en Story à la Une', color: '#3B82F6' },
  PROFILE: { label: 'Lien profil', hint: 'Lien dans « Links » du profil, plus de Story avec lien', color: '#10B981' },
}

const STAGES = {
  BELOW_THRESHOLD: { label: 'Sous le seuil', className: 'bg-[#141414] text-[#666] border-[#1a1a1a]' },
  AT_THRESHOLD: { label: 'Lien à poser', className: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  PLACED: { label: 'Lien posé', className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
}

function fmt(n, digits = 1) {
  if (n == null || Number.isNaN(n)) return '—'
  return Number(n).toLocaleString('fr-FR', { maximumFractionDigits: digits, minimumFractionDigits: 0 })
}

function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function shortDay(day) {
  return `${day.slice(8)}/${day.slice(5, 7)}`
}

function Stat({ label, value, sub }) {
  return (
    <div>
      <p className="text-[11px] text-[#555] uppercase tracking-wide">{label}</p>
      <p className="text-lg font-semibold text-white tabular-nums">{value}</p>
      {sub && <p className="text-[11px] text-[#555]">{sub}</p>}
    </div>
  )
}

function GroupCard({ variant, summary }) {
  const group = GROUPS[variant]
  const lift = summary.avgDailyPageviewsBeforePlacement > 0
    ? summary.avgDailyPageviewsAfterPlacement / summary.avgDailyPageviewsBeforePlacement
    : null
  return (
    <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-[10px] p-5 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: group.color }} />
          <h2 className="text-base font-bold text-white">{group.label}</h2>
        </div>
        <span className="text-xs text-[#555]">{group.hint}</span>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Stat label="Comptes" value={summary.assigned}
              sub={`${summary.active} actifs · ${summary.autoSuspended} auto-susp. · ${summary.banned} bannis`} />
        <Stat label="Sous le seuil" value={summary.belowThreshold} />
        <Stat label="Lien à poser" value={summary.atThreshold} />
        <Stat label="Lien posé" value={summary.placed} />
      </div>

      <div className="grid grid-cols-3 gap-4 border-t border-[#1a1a1a] pt-4">
        <Stat label="Vues / compte / jour" value={fmt(summary.avgDailyPageviewsAfterPlacement)}
              sub={`après pose · ${summary.accountDaysAfterPlacement} comptes-jours`} />
        <Stat label="Clics / compte / jour" value={fmt(summary.avgDailyClicksAfterPlacement, 2)} sub="après pose" />
        <Stat label="Avant pose" value={fmt(summary.avgDailyPageviewsBeforePlacement)}
              sub={lift != null ? `vues/jour · ×${fmt(lift, 2)} après` : 'vues/jour, mêmes comptes'} />
      </div>

      <div className="grid grid-cols-3 gap-4 border-t border-[#1a1a1a] pt-4">
        <Stat label="Vues 7 j" value={fmt(summary.pageviewsLast7Days, 0)} />
        <Stat label="Clics 7 j" value={fmt(summary.clicksLast7Days, 0)} />
        <Stat label="Liens restreints" value={summary.restricted} sub="Instagram refuse les liens" />
      </div>
    </div>
  )
}

function DailyChart({ daily, launchDay }) {
  const [metric, setMetric] = useState('pageviews')
  const [mode, setMode] = useState('perPlaced')

  const data = useMemo(() => (daily || []).map(point => {
    const row = { day: shortDay(point.day) }
    for (const variant of Object.keys(GROUPS)) {
      const g = point.groups?.[variant]
      if (!g) continue
      if (mode === 'perPlaced') {
        const total = metric === 'pageviews' ? g.placedPageviews : g.placedButtonClicks
        row[variant] = g.placedAccounts > 0 ? Number((total / g.placedAccounts).toFixed(2)) : null
      } else {
        row[variant] = metric === 'pageviews' ? g.pageviews : g.buttonClicks
      }
    }
    return row
  }), [daily, metric, mode])

  const toggle = (value, current, set, label) => (
    <button
      key={value}
      onClick={() => set(value)}
      className={`px-2.5 py-1 rounded-md text-[11px] font-semibold border transition-colors ${
        current === value ? 'bg-white/10 text-white border-[#333]' : 'text-[#555] border-[#1a1a1a] hover:text-white'
      }`}
    >
      {label}
    </button>
  )

  return (
    <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-[10px] p-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h3 className="label-upper !mb-0">Jour par jour</h3>
        <div className="flex gap-1.5">
          {toggle('pageviews', metric, setMetric, 'Vues')}
          {toggle('clicks', metric, setMetric, 'Clics')}
          <span className="w-2" />
          {toggle('perPlaced', mode, setMode, 'Moyenne par compte au lien posé')}
          {toggle('total', mode, setMode, 'Total du groupe')}
        </div>
      </div>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#1a1a1a" vertical={false} />
            <XAxis dataKey="day" tick={{ fill: '#555', fontSize: 11 }} tickLine={false} axisLine={{ stroke: '#1a1a1a' }} />
            <YAxis tick={{ fill: '#555', fontSize: 11 }} tickLine={false} axisLine={false} width={40} />
            <Tooltip
              contentStyle={{ backgroundColor: '#111', border: '1px solid #1a1a1a', borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: '#888' }}
            />
            <Legend formatter={value => GROUPS[value]?.label || value} wrapperStyle={{ fontSize: 12 }} />
            {launchDay && (
              <ReferenceLine x={shortDay(launchDay)} stroke="#555" strokeDasharray="4 4"
                             label={{ value: 'Lancement', fill: '#666', fontSize: 11, position: 'insideTopLeft' }} />
            )}
            {Object.entries(GROUPS).map(([variant, group]) => (
              <Line key={variant} type="monotone" dataKey={variant} stroke={group.color} strokeWidth={2}
                    dot={false} connectNulls={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="text-[11px] text-[#555] mt-2">
        Trafic GetMySocial (heure de Paris), collecté chaque matin. « Moyenne par compte au lien posé » ne compte que
        les comptes dont le lien propre au groupe était déjà en place ce jour-là.
      </p>
    </div>
  )
}

export default function LinkAbTest() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [variantFilter, setVariantFilter] = useState('ALL')

  const { data: raw, isLoading, error } = useQuery({
    queryKey: ['ab-tests', 'link-placement'],
    queryFn: () => apiGet('/api/ab-tests/link-placement'),
    refetchInterval: 60_000,
  })
  const report = raw?.data || raw

  const collect = useMutation({
    mutationFn: () => apiPost('/api/ab-tests/link-placement/collect'),
    onSuccess: res => {
      const r = res?.data || res
      toast.success(`Collecte GMS : ${r?.rowsWritten ?? 0} lignes (${r?.accounts ?? 0} comptes)`)
      if (r?.linkNotFound?.length) toast.warning(`Liens GMS introuvables : ${r.linkNotFound.join(', ')}`)
      queryClient.invalidateQueries({ queryKey: ['ab-tests', 'link-placement'] })
    },
    onError: err => toast.error(`Collecte GMS échouée : ${err.message}`),
  })

  const accounts = useMemo(
    () => (report?.accounts || []).filter(a => variantFilter === 'ALL' || a.variant === variantFilter),
    [report, variantFilter],
  )

  if (isLoading) return <p className="text-xs text-[#555] p-8">Chargement…</p>
  if (error) return <p className="text-xs text-red-400 p-8">Erreur : {error.message}</p>
  if (!report || report.launched === false) {
    return (
      <EmptyState
        icon={FlaskConical}
        title="A/B test non lancé"
        description="La répartition des comptes se fait au prochain démarrage du backend."
      />
    )
  }

  const launchDay = report.launchedAt
    ? new Date(report.launchedAt).toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' })
    : null

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <FlaskConical size={20} className="text-[#888]" />
            A/B test lien
          </h1>
          <p className="text-xs text-[#555] mt-0.5">
            Au seuil highlight : lien épinglé en highlight ou lien dans le profil. Lancé le {formatDate(report.launchedAt)} ·
            données du {shortDay(report.from)} au {shortDay(report.to)}
          </p>
        </div>
        <button
          onClick={() => collect.mutate()}
          disabled={collect.isPending}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold border border-[#1a1a1a] text-[#888] hover:text-white hover:border-[#333] disabled:opacity-50 transition-colors"
        >
          <RefreshCw size={12} className={collect.isPending ? 'animate-spin' : ''} />
          Recollecter GMS
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {Object.keys(GROUPS).map(variant => report.groups?.[variant] && (
          <GroupCard key={variant} variant={variant} summary={report.groups[variant]} />
        ))}
      </div>

      <DailyChart daily={report.daily} launchDay={launchDay} />

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_3fr] gap-4">
        <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-[10px] p-5">
          <h3 className="label-upper">Répartition par identité</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] text-[#555] uppercase">
                <th className="text-left font-medium pb-2">Identité</th>
                <th className="text-right font-medium pb-2">Highlight</th>
                <th className="text-right font-medium pb-2">Profil</th>
              </tr>
            </thead>
            <tbody>
              {(report.identities || []).map(row => (
                <tr key={row.identityId} className="border-t border-[#141414]">
                  <td className="py-1.5 text-white"><Blur>{row.identityId}</Blur></td>
                  <td className="py-1.5 text-right tabular-nums text-[#3B82F6]">{row.highlight}</td>
                  <td className="py-1.5 text-right tabular-nums text-[#10B981]">{row.profile}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-[10px] p-5 overflow-x-auto">
          <div className="flex items-center justify-between mb-3">
            <h3 className="label-upper !mb-0">Comptes ({accounts.length})</h3>
            <div className="flex gap-1.5">
              {['ALL', ...Object.keys(GROUPS)].map(v => (
                <button
                  key={v}
                  onClick={() => setVariantFilter(v)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold border transition-colors ${
                    variantFilter === v ? 'bg-white/10 text-white border-[#333]' : 'text-[#555] border-[#1a1a1a] hover:text-white'
                  }`}
                >
                  {v === 'ALL' ? 'Tous' : GROUPS[v].label}
                </button>
              ))}
            </div>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] text-[#555] uppercase">
                <th className="text-left font-medium pb-2">Compte</th>
                <th className="text-left font-medium pb-2">Groupe</th>
                <th className="text-left font-medium pb-2">Statut</th>
                <th className="text-left font-medium pb-2">Étape</th>
                <th className="text-left font-medium pb-2">Lien posé</th>
                <th className="text-right font-medium pb-2">Vues 7 j</th>
                <th className="text-right font-medium pb-2">Clics 7 j</th>
                <th className="text-right font-medium pb-2" title="Vues GMS moyennes par jour depuis la pose / avant la pose">
                  Vues/j après · avant
                </th>
              </tr>
            </thead>
            <tbody>
              {accounts.map(a => (
                <tr
                  key={a.username}
                  onClick={() => navigate(`/accounts?username=${encodeURIComponent(a.username)}`)}
                  className="border-t border-[#141414] hover:bg-[#111] cursor-pointer"
                >
                  <td className="py-1.5 text-white">
                    <span className="inline-flex items-center gap-1.5">
                      <Blur>{a.username}</Blur>
                      {a.restricted && <Link2Off size={12} className="text-red-400" aria-label="Liens restreints" />}
                    </span>
                    <span className="block text-[11px] text-[#555]"><Blur>{a.identityId}</Blur></span>
                  </td>
                  <td className="py-1.5">
                    <span className="text-xs font-semibold" style={{ color: GROUPS[a.variant]?.color }}>
                      {GROUPS[a.variant]?.label || a.variant}
                    </span>
                  </td>
                  <td className="py-1.5 text-xs text-[#888]">{a.status}</td>
                  <td className="py-1.5">
                    <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-md border ${STAGES[a.stage]?.className || ''}`}>
                      {STAGES[a.stage]?.label || a.stage}
                    </span>
                  </td>
                  <td className="py-1.5 text-xs text-[#888]">{formatDate(a.linkPlacedAt)}</td>
                  <td className="py-1.5 text-right tabular-nums text-white">{fmt(a.pageviewsLast7Days, 0)}</td>
                  <td className="py-1.5 text-right tabular-nums text-white">{fmt(a.clicksLast7Days, 0)}</td>
                  <td className="py-1.5 text-right tabular-nums text-[#888]">
                    {fmt(a.avgDailyPageviewsAfterPlacement)} · {fmt(a.avgDailyPageviewsBeforePlacement)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
