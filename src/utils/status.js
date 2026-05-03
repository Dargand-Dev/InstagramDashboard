export function deriveDisplayStatus(item) {
  if (!item) return undefined
  if (item.skipCode === 'AUTO_SUSPENDED') return 'AUTO_SUSPENDED'
  return item.status
}
