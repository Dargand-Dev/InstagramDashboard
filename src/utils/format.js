const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000

export function toBangkokISO(utcString) {
  if (!utcString) return utcString
  const d = new Date(utcString)
  const bangkokMs = d.getTime() + BANGKOK_OFFSET_MS
  return new Date(bangkokMs).toISOString()
}

export function formatDuration(ms) {
  if (!ms) return '—'
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const rem = s % 60
  if (m < 60) return `${m}m ${rem}s`
  const h = Math.floor(m / 60)
  return `${h}h ${m % 60}m`
}
