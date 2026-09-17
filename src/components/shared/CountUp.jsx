import { useCountUp } from '@/hooks/useCountUp'

/**
 * Affiche un nombre qui monte jusqu'a sa valeur au lieu d'apparaitre d'un coup.
 * Composant a part entiere parce qu'un hook ne peut pas etre appele
 * conditionnellement depuis un parent qui rend parfois un tiret a la place.
 */
export default function CountUp({ value, duration, delay, className }) {
  const displayed = useCountUp(value, { duration, delay })
  return <span className={className}>{displayed}</span>
}
