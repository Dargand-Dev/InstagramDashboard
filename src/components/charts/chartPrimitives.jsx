import { useIncognito } from '@/contexts/IncognitoContext'

export function BlurredXTick({ x, y, payload }) {
  const { isIncognito } = useIncognito()
  return (
    <text x={x} y={y} dy={14} textAnchor="middle" fill="#999" fontSize={11}>
      {isIncognito ? '•••' : payload.value}
    </text>
  )
}

export function BlurredYTick({ x, y, payload }) {
  const { isIncognito } = useIncognito()
  return (
    <text x={x} y={y} dx={-4} textAnchor="end" fill="#999" fontSize={11}>
      {isIncognito ? '•••' : payload.value}
    </text>
  )
}
