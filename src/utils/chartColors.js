export const CHART_COLORS = [
  '#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444',
  '#06b6d4', '#f97316', '#ec4899', '#14b8a6', '#a855f7',
  '#84cc16', '#e11d48', '#0ea5e9', '#d946ef', '#fbbf24'
]

export function buildColorMap(usernames) {
  const sorted = [...usernames].sort((a, b) => a.localeCompare(b))
  const map = {}
  for (let i = 0; i < sorted.length; i++) {
    map[sorted[i]] = CHART_COLORS[i % CHART_COLORS.length]
  }
  return map
}
