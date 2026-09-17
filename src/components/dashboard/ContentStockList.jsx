import { AlertTriangle } from 'lucide-react'
import { useCountUp, useArmed } from '@/hooks/useCountUp'

const BAR_DURATION_MS = 900
const ROW_STAGGER_MS = 60

function barColor(count) {
  if (count < 3) return '#EF4444'
  if (count < 10) return '#F59E0B'
  return '#8B5CF6'
}

/** Ligne d'une identite dont le stock n'a pas pu etre lu (Drive injoignable). */
function ErroredRow({ name, error }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-[#A1A1AA] truncate">{name}</span>
        <span
          className="text-xs text-[#EF4444] flex items-center gap-1 shrink-0"
          title={error || 'Drive unavailable'}
        >
          <AlertTriangle className="w-3 h-3" />
          Drive error
        </span>
      </div>
      {/* Pas de barre pleine : le stock est inconnu, pas nul */}
      <div
        className="h-1.5 rounded-full border border-dashed border-[#EF4444]/30 bg-[#EF4444]/5"
        aria-label="Stock unknown"
      />
    </div>
  )
}

function StockRow({ name, count, max, index, armed }) {
  const displayed = useCountUp(count, { delay: index * ROW_STAGGER_MS })
  const pct = max > 0 ? Math.min((count / max) * 100, 100) : 0

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-[#A1A1AA] truncate">{name}</span>
        <span className="text-xs text-[#52525B] tabular-nums">{displayed}</span>
      </div>
      <div className="h-1.5 rounded-full bg-[#1a1a1a] overflow-hidden">
        <div
          className="h-full rounded-full motion-reduce:transition-none"
          style={{
            width: armed ? `${pct}%` : '0%',
            background: barColor(count),
            transition: `width ${BAR_DURATION_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`,
            transitionDelay: `${index * ROW_STAGGER_MS}ms`,
          }}
        />
      </div>
    </div>
  )
}

/** Rangees fantomes affichees pendant le chargement, pour ne pas montrer un panneau vide. */
function LoadingRows({ rows = 6 }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading content stock">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i}>
          <div className="flex items-center justify-between mb-1">
            <div
              className="h-2.5 rounded bg-[#1a1a1a] animate-pulse"
              style={{ width: `${45 + ((i * 13) % 35)}%`, animationDelay: `${i * 90}ms` }}
            />
            <div
              className="h-2.5 w-5 rounded bg-[#1a1a1a] animate-pulse"
              style={{ animationDelay: `${i * 90}ms` }}
            />
          </div>
          <div
            className="h-1.5 rounded-full bg-[#1a1a1a] animate-pulse"
            style={{ animationDelay: `${i * 90}ms` }}
          />
        </div>
      ))}
    </div>
  )
}

/**
 * Liste "Content Stock" du dashboard.
 *
 * `entries` est la sortie de Object.entries(contentIdentities) : chaque valeur porte
 * soit un reelCount numerique, soit status 'ERROR' quand Drive n'a pas repondu.
 */
export default function ContentStockList({ entries, loading }) {
  const armed = useArmed()

  if (loading) return <LoadingRows />
  if (!entries || entries.length === 0) {
    return <p className="text-xs text-[#52525B] text-center py-4">No content data</p>
  }

  // L'echelle des barres ne doit dependre que des identites effectivement lisibles.
  const readable = entries.filter(([, d]) => d.status !== 'ERROR')
  const max = Math.max(...readable.map(([, d]) => d.reelCount || d.count || 0), 1)

  return (
    <div className="space-y-3">
      {entries.map(([name, data], index) =>
        data.status === 'ERROR' ? (
          <ErroredRow key={name} name={name} error={data.error} />
        ) : (
          <StockRow
            key={name}
            name={name}
            count={data.reelCount || data.count || 0}
            max={max}
            index={index}
            armed={armed}
          />
        )
      )}
    </div>
  )
}
