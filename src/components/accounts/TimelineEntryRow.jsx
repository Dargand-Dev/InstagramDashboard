import { Link, AlertOctagon, BarChart3, Pencil, Hash, XCircle, Settings, Trash2 } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Blur } from '../../contexts/IncognitoContext'

const HIDDEN_ATTRIBUTES = new Set(['noteId', 'authorJwtSubject', 'addedBy'])

function IconForEntry({ chipKey, ...rest }) {
  switch (chipKey) {
    case 'links': return <Link {...rest} />
    case 'status': return <AlertOctagon {...rest} />
    case 'posts': return <BarChart3 {...rest} />
    case 'highlight': return <Hash {...rest} />
    case 'notes': return <Pencil {...rest} />
    case 'errors': return <XCircle {...rest} />
    default: return <Settings {...rest} />
  }
}

function formatTimestamp(entry) {
  if (entry.backfilled || !entry.timestamp) {
    return { primary: '[backfilled]', secondary: 'date inconnue' }
  }
  const d = typeof entry.timestamp === 'string' ? parseISO(entry.timestamp) : new Date(entry.timestamp)
  return {
    primary: format(d, 'dd MMM HH:mm', { locale: fr }),
    secondary: null,
  }
}

function formatAttributes(attrs) {
  if (!attrs) return null
  const visible = Object.entries(attrs).filter(([k]) => !HIDDEN_ATTRIBUTES.has(k))
  if (visible.length === 0) return null
  return visible.map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`).join(' · ')
}

function isManual(entry) {
  if (entry.source === 'note') return true
  if (entry.eventType?.endsWith('_backfilled') && entry.attributes?.addedBy) return true
  return false
}

export default function TimelineEntryRow({ entry, chipKey, onDelete }) {
  const ts = formatTimestamp(entry)
  const attrs = formatAttributes(entry.attributes)
  const manual = isManual(entry)
  const canDelete = entry.source === 'note' && !!onDelete && !!entry.attributes?.noteId

  return (
    <div className="flex items-start gap-3 py-2 border-b border-[#141414] last:border-0">
      <IconForEntry chipKey={chipKey} size={14} className="text-[#666] mt-1 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-[#888] text-xs font-mono">{ts.primary}</span>
          {ts.secondary && <span className="text-[#555] text-xs">{ts.secondary}</span>}
          <span className="text-white text-sm">
            <Blur>{entry.summary || entry.eventType}</Blur>
          </span>
          {entry.outcome === 'SUCCESS' && (
            <span className="text-emerald-500 text-[10px] uppercase font-semibold">SUCCESS</span>
          )}
          {entry.outcome === 'FAILURE' && (
            <span className="text-red-500 text-[10px] uppercase font-semibold">FAILURE</span>
          )}
          {manual && (
            <span className="text-[#666] text-[10px] uppercase border border-[#222] rounded px-1">manuel</span>
          )}
        </div>
        {attrs && (
          <div className="text-[#555] text-xs mt-0.5 break-all">
            <Blur>{attrs}</Blur>
          </div>
        )}
      </div>
      {canDelete && (
        <button
          onClick={() => onDelete(entry.attributes.noteId)}
          className="text-[#444] hover:text-red-500 transition-colors shrink-0 mt-1"
          aria-label="Supprimer cette note"
        >
          <Trash2 size={14} />
        </button>
      )}
    </div>
  )
}
