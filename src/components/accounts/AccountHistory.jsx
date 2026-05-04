import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import {
  fetchAccountTimeline,
  addAccountNote,
  deleteAccountNote,
  addAccountLifecycleEvent,
} from '@/api/accountTimeline'
import TimelineEntryRow from './TimelineEntryRow'
import AddTimelineEntryModal from './AddTimelineEntryModal'

const CHIPS = [
  { key: 'all', label: 'Tous' },
  { key: 'links', label: 'Liens' },
  { key: 'status', label: 'Status' },
  { key: 'posts', label: 'Posts' },
  { key: 'highlight', label: 'Highlight' },
  { key: 'notes', label: 'Notes' },
  { key: 'errors', label: 'Erreurs' },
  { key: 'system', label: 'Système' },
]

const STATUS_EVENT_TYPES = new Set([
  'account.banned', 'account.suspended', 'account.auto_suspended',
  'account.manual_ban', 'account.manual_reactivated', 'account.grace_granted',
  'account.deleted', 'account.status_changed',
  'account_lifecycle.banned', 'account_lifecycle.auto_suspended', 'account_lifecycle.grace_granted',
])

function matchesChip(entry, chipKey) {
  if (chipKey === 'all') return true
  const t = entry.eventType || ''
  if (chipKey === 'links') {
    return t.startsWith('account.story_link')
      || t.startsWith('account.necessary_link')
      || t.includes('_link_backfilled')
  }
  if (chipKey === 'status') return STATUS_EVENT_TYPES.has(t)
  if (chipKey === 'posts') return entry.source === 'posting_history'
  if (chipKey === 'highlight') return t.startsWith('account.highlight') || t === 'account_lifecycle.highlight'
  if (chipKey === 'notes') return entry.source === 'note'
  if (chipKey === 'errors') return entry.source === 'execution_error' || entry.outcome === 'FAILURE'
  if (chipKey === 'system') {
    // Tout ce qui n'est matché par aucun chip spécifique sauf 'all'.
    return !matchesChip(entry, 'links')
      && !matchesChip(entry, 'status')
      && !matchesChip(entry, 'posts')
      && !matchesChip(entry, 'highlight')
      && !matchesChip(entry, 'notes')
      && !matchesChip(entry, 'errors')
  }
  return false
}

export default function AccountHistory({ username }) {
  const queryClient = useQueryClient()
  const [activeChip, setActiveChip] = useState('all')
  const [addOpen, setAddOpen] = useState(false)

  const queryKey = ['account-timeline', username]

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey,
    queryFn: ({ signal }) => fetchAccountTimeline(username, signal),
    staleTime: 30_000,
    enabled: !!username,
  })

  const addNoteMutation = useMutation({
    mutationFn: body => addAccountNote(username, body),
    onSuccess: () => {
      toast.success('Note ajoutée')
      queryClient.invalidateQueries({ queryKey })
    },
    onError: err => toast.error(err.message || 'Échec ajout note'),
  })

  const deleteNoteMutation = useMutation({
    mutationFn: noteId => deleteAccountNote(username, noteId),
    onSuccess: () => {
      toast.success('Note supprimée')
      queryClient.invalidateQueries({ queryKey })
    },
    onError: err => toast.error(err.message || 'Échec suppression'),
  })

  const addLifecycleMutation = useMutation({
    mutationFn: body => addAccountLifecycleEvent(username, body),
    onSuccess: () => {
      toast.success('Événement enregistré')
      queryClient.invalidateQueries({ queryKey })
    },
    onError: err => toast.error(err.message || 'Échec enregistrement'),
  })

  const events = useMemo(() => {
    const raw = data?.events
    if (!Array.isArray(raw)) return []
    return raw
  }, [data])

  const counts = useMemo(() => {
    const c = {}
    for (const chip of CHIPS) {
      c[chip.key] = chip.key === 'all'
        ? events.length
        : events.filter(e => matchesChip(e, chip.key)).length
    }
    return c
  }, [events])

  const visible = useMemo(
    () => events.filter(e => matchesChip(e, activeChip)),
    [events, activeChip],
  )

  function handleDeleteNote(noteId) {
    if (!window.confirm('Supprimer cette note ?')) return
    deleteNoteMutation.mutate(noteId)
  }

  if (!username) return null

  return (
    <div className="bg-[#0a0a0a] border border-[#141414] rounded-lg p-4 mt-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-white text-sm font-semibold">Historique</h3>
        <button
          onClick={() => setAddOpen(true)}
          className="flex items-center gap-1 text-xs text-[#aaa] hover:text-white"
        >
          <Plus size={14} /> Ajouter
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-3">
        {CHIPS.map(chip => (
          <button
            key={chip.key}
            onClick={() => setActiveChip(chip.key)}
            className={`px-2 py-0.5 rounded-full text-[11px] border transition-colors ${
              activeChip === chip.key
                ? 'bg-white text-black border-white'
                : 'bg-transparent text-[#aaa] border-[#222] hover:border-[#333]'
            }`}
          >
            {chip.label} ({counts[chip.key] ?? 0})
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-[#555] text-xs italic py-6 text-center">Chargement…</div>
      ) : isError ? (
        <div className="py-6 text-center">
          <div className="text-red-500 text-xs mb-2">Impossible de charger l'historique.</div>
          <button onClick={() => refetch()} className="text-xs text-[#aaa] underline">Réessayer</button>
        </div>
      ) : visible.length === 0 ? (
        <div className="text-[#555] text-xs italic py-6 text-center">
          {events.length === 0
            ? 'Aucun événement enregistré pour ce compte.'
            : 'Aucun événement pour ce filtre.'}
        </div>
      ) : (
        <div>
          {visible.map((entry, idx) => (
            <TimelineEntryRow
              key={`${entry.source}-${entry.eventType}-${entry.timestamp || 'bf'}-${idx}`}
              entry={entry}
              chipKey={activeChip === 'all' ? matchedChipFor(entry) : activeChip}
              onDelete={entry.source === 'note' ? handleDeleteNote : undefined}
            />
          ))}
        </div>
      )}

      <AddTimelineEntryModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSubmitNote={body => addNoteMutation.mutateAsync(body)}
        onSubmitLifecycle={body => addLifecycleMutation.mutateAsync(body)}
      />
    </div>
  )
}

function matchedChipFor(entry) {
  for (const chip of CHIPS) {
    if (chip.key === 'all') continue
    if (matchesChip(entry, chip.key)) return chip.key
  }
  return 'system'
}
