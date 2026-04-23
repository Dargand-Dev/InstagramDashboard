import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { AlertOctagon, Calendar, CalendarClock, Ban, ExternalLink, Smartphone, User, TrendingDown, Clock, Instagram } from 'lucide-react'
import { toast } from 'sonner'
import { apiGet, apiPost, apiPut } from '@/lib/api'
import { Blur } from '@/contexts/IncognitoContext'
import EmptyState from '@/components/shared/EmptyState'

function formatDate(d) {
  if (!d) return null
  return new Date(d).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function formatShortDate(d) {
  if (!d) return null
  return new Date(d).toLocaleDateString('fr-FR', {
    day: '2-digit', month: '2-digit',
  })
}

function computeKpis(suspended) {
  if (!Array.isArray(suspended)) return { total: 0, inGrace: 0, recent24h: 0 }
  const now = Date.now()
  return {
    total: suspended.length,
    inGrace: suspended.filter(a => a.autoSuspendGraceUntil
      && new Date(a.autoSuspendGraceUntil).getTime() > now).length,
    recent24h: suspended.filter(a => a.autoSuspendedAt
      && now - new Date(a.autoSuspendedAt).getTime() < 86400000).length,
  }
}

function formatRelative(d) {
  if (!d) return null
  const diffMs = Date.now() - new Date(d).getTime()
  const diffDays = Math.floor(diffMs / 86400000)
  if (diffDays === 0) return "aujourd'hui"
  if (diffDays === 1) return 'hier'
  if (diffDays < 30) return `il y a ${diffDays}j`
  const diffMonths = Math.floor(diffDays / 30)
  return `il y a ${diffMonths}mois`
}

export default function AutoSuspended() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [pendingAction, setPendingAction] = useState(null) // { id, kind }

  const { data: suspended, isLoading, error } = useQuery({
    queryKey: ['accounts', 'auto-suspended'],
    queryFn: () => apiGet('/api/accounts/suspended'),
    refetchInterval: 15_000,
  })

  const reactivate = useMutation({
    mutationFn: ({ id, graceDays }) =>
      apiPost(`/api/accounts/${id}/reactivate`, { graceDays }),
    onSuccess: (_, variables) => {
      toast.success(
        variables.graceDays
          ? `Compte réactivé (grâce ${variables.graceDays}j)`
          : 'Compte réactivé sans période de grâce',
      )
      queryClient.invalidateQueries({ queryKey: ['accounts'] })
    },
    onError: (err) => {
      toast.error('Échec de la réactivation', { description: err.message })
    },
    onSettled: () => setPendingAction(null),
  })

  const ban = useMutation({
    mutationFn: (id) => apiPut(`/api/accounts/${id}/status`, { status: 'BANNED' }),
    onSuccess: () => {
      toast.success('Compte banni (container nettoyé)')
      queryClient.invalidateQueries({ queryKey: ['accounts'] })
    },
    onError: (err) => {
      toast.error('Échec du bannissement', { description: err.message })
    },
    onSettled: () => setPendingAction(null),
  })

  const kpis = computeKpis(suspended)

  function handleReactivate2d(account) {
    setPendingAction({ id: account.id, kind: 'reactivate2' })
    reactivate.mutate({ id: account.id, graceDays: 2 })
  }

  function handleReactivate10d(account) {
    setPendingAction({ id: account.id, kind: 'reactivate10' })
    reactivate.mutate({ id: account.id, graceDays: 10 })
  }

  function handleBan(account) {
    if (!confirm(`Bannir définitivement ${account.username} ?\nLe container Crane sera supprimé du device.`)) return
    setPendingAction({ id: account.id, kind: 'ban' })
    ban.mutate(account.id)
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-5">
        <div className="flex items-center gap-3 mb-1">
          <AlertOctagon className="w-6 h-6 text-purple-400" />
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Auto-Suspended</h1>
        </div>
        <p className="text-xs text-[#555]">
          Comptes automatiquement suspendus par le système (moyenne des vues trop faible).
          Réactive en grâce 2j, 10j, ou bannis-les.
        </p>
      </div>

      {/* KPI bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-[10px] p-4">
          <div className="flex items-center gap-2 mb-1.5">
            <AlertOctagon size={13} className="text-purple-400" />
            <span className="text-[10px] text-[#555] uppercase tracking-wide">Total suspendus</span>
          </div>
          <p className="text-2xl font-bold text-white">{kpis.total}</p>
        </div>
        <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-[10px] p-4">
          <div className="flex items-center gap-2 mb-1.5">
            <Clock size={13} className="text-amber-400" />
            <span className="text-[10px] text-[#555] uppercase tracking-wide">Dernières 24h</span>
          </div>
          <p className="text-2xl font-bold text-white">{kpis.recent24h}</p>
        </div>
        <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-[10px] p-4">
          <div className="flex items-center gap-2 mb-1.5">
            <Calendar size={13} className="text-emerald-400" />
            <span className="text-[10px] text-[#555] uppercase tracking-wide">En grâce active</span>
          </div>
          <p className="text-2xl font-bold text-white">{kpis.inGrace}</p>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-[10px] p-8 text-center">
          <p className="text-sm text-[#555]">Chargement...</p>
        </div>
      ) : error ? (
        <div className="bg-[#0a0a0a] border border-red-500/20 rounded-[10px] p-8 text-center">
          <p className="text-sm text-red-400">Erreur : {error.message}</p>
        </div>
      ) : !suspended || suspended.length === 0 ? (
        <EmptyState
          icon={AlertOctagon}
          title="Aucun compte auto-suspendu"
          description="Tous les comptes performent au-dessus du seuil minimum."
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {suspended.map(account => (
            <SuspendedCard
              key={account.id}
              account={account}
              onOpenDetails={() => navigate(`/accounts?username=${encodeURIComponent(account.username)}`)}
              onReactivate2d={() => handleReactivate2d(account)}
              onReactivate10d={() => handleReactivate10d(account)}
              onBan={() => handleBan(account)}
              pending={pendingAction?.id === account.id ? pendingAction.kind : null}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function SuspendedCard({ account, onOpenDetails, onReactivate2d, onReactivate10d, onBan, pending }) {
  const now = Date.now()
  const graceActive = account.autoSuspendGraceUntil
    && new Date(account.autoSuspendGraceUntil).getTime() > now
  const graceEndsInDays = graceActive
    ? Math.ceil((new Date(account.autoSuspendGraceUntil).getTime() - now) / 86400000)
    : 0

  const currentGraceUntilMs = graceActive ? new Date(account.autoSuspendGraceUntil).getTime() : null
  const pastGraces = Array.isArray(account.autoSuspendGraceHistory)
    ? [...account.autoSuspendGraceHistory]
        .filter(g => currentGraceUntilMs === null
          || new Date(g.graceUntil).getTime() !== currentGraceUntilMs)
        .sort((a, b) => new Date(b.grantedAt).getTime() - new Date(a.grantedAt).getTime())
    : []

  return (
    <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-[10px] overflow-hidden hover:border-[#333] transition-colors">
      {/* Header */}
      <div className="px-5 py-4 border-b border-[#1a1a1a] flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
            {account.username?.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white truncate">
                <Blur>{account.username}</Blur>
              </span>
              <a
                href={`https://instagram.com/${account.username}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#444] hover:text-pink-400 transition-colors shrink-0"
                title="Ouvrir le profil Instagram"
              >
                <Instagram size={12} />
              </a>
              <button
                onClick={onOpenDetails}
                className="text-[#444] hover:text-blue-400 transition-colors shrink-0"
                title="Ouvrir la fiche détaillée"
              >
                <ExternalLink size={12} />
              </button>
            </div>
            <div className="flex items-center gap-2 mt-0.5 text-[11px] text-[#555]">
              {account.identityId && (
                <span className="flex items-center gap-1">
                  <User size={10} />
                  <Blur>{account.identityId}</Blur>
                </span>
              )}
              {account.deviceUdid && (
                <span className="flex items-center gap-1">
                  <Smartphone size={10} />
                  {account.deviceUdid.slice(-8)}
                </span>
              )}
            </div>
          </div>
        </div>
        {graceActive && (
          <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-semibold uppercase bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
            <Clock size={10} />
            Grâce {graceEndsInDays}j
          </span>
        )}
      </div>

      {/* Raison & méta */}
      <div className="px-5 py-4 space-y-2.5 bg-purple-500/[0.02]">
        {account.autoSuspendReason && (
          <div className="flex items-start gap-2">
            <TrendingDown size={12} className="text-purple-400 mt-0.5 shrink-0" />
            <p className="text-xs text-white leading-relaxed">{account.autoSuspendReason}</p>
          </div>
        )}
        <div className="grid grid-cols-3 gap-3 pt-1">
          <div>
            <p className="text-[9px] text-[#555] uppercase tracking-wide mb-0.5">Moy. 5 derniers</p>
            <p className="text-sm font-bold text-purple-400 font-mono">
              {account.autoSuspendAvgViewsLast5?.toLocaleString() ?? '—'}
            </p>
          </div>
          <div>
            <p className="text-[9px] text-[#555] uppercase tracking-wide mb-0.5">Followers</p>
            <p className="text-sm font-bold text-white font-mono">
              {(account.followerCount ?? 0).toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-[9px] text-[#555] uppercase tracking-wide mb-0.5">Vues 30j</p>
            <p className="text-sm font-bold text-white font-mono">
              {(account.viewsLast30Days ?? 0).toLocaleString()}
            </p>
          </div>
        </div>
        {pastGraces.length > 0 && (
          <div className="pt-1.5 border-t border-[#1a1a1a]">
            <p className="text-[9px] text-[#555] uppercase tracking-wide mb-1">Grâces précédentes</p>
            <div className="flex flex-wrap gap-1.5">
              {pastGraces.slice(0, 3).map((g, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-[#222] bg-[#0f0f0f] text-[10px] text-[#888]"
                  title={`Grâce de ${g.graceDays}j accordée le ${formatDate(g.grantedAt)}`}
                >
                  <Clock size={9} className="text-[#666]" />
                  {g.graceDays}j le {formatShortDate(g.grantedAt)}
                </span>
              ))}
              {pastGraces.length > 3 && (
                <span className="text-[10px] text-[#555] self-center">+{pastGraces.length - 3}</span>
              )}
            </div>
          </div>
        )}
        <div className="flex items-center gap-3 pt-1.5 text-[10px] text-[#555]">
          {account.autoSuspendedAt && (
            <span>Suspendu {formatRelative(account.autoSuspendedAt)} · {formatDate(account.autoSuspendedAt)}</span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="px-5 py-3 border-t border-[#1a1a1a] grid grid-cols-3 gap-2">
        <button
          onClick={onReactivate2d}
          disabled={pending !== null}
          className="flex items-center justify-center gap-1.5 px-2 py-2 rounded-md text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition-colors disabled:opacity-50 disabled:cursor-wait"
          title="Réactive le compte pendant 2 jours sans possibilité de ré-auto-suspension"
        >
          <Clock size={12} />
          {pending === 'reactivate2' ? '...' : 'Grâce 2j'}
        </button>
        <button
          onClick={onReactivate10d}
          disabled={pending !== null}
          className="flex items-center justify-center gap-1.5 px-2 py-2 rounded-md text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors disabled:opacity-50 disabled:cursor-wait"
          title="Réactive avec une grâce de 10 jours avant ré-évaluation auto-suspend"
        >
          <CalendarClock size={12} />
          {pending === 'reactivate10' ? '...' : 'Grâce 10j'}
        </button>
        <button
          onClick={onBan}
          disabled={pending !== null}
          className="flex items-center justify-center gap-1.5 px-2 py-2 rounded-md text-[11px] font-semibold bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors disabled:opacity-50 disabled:cursor-wait"
          title="Bannir définitivement — supprime le container Crane"
        >
          <Ban size={12} />
          {pending === 'ban' ? '...' : 'Bannir'}
        </button>
      </div>
    </div>
  )
}
