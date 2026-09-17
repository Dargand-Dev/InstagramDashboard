import { useEffect, useRef, useState } from 'react'

function prefersReducedMotion() {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Fait monter un nombre jusqu'a `target` au lieu de l'afficher d'un coup.
 *
 * Repart toujours de la derniere valeur affichee : au premier rendu on compte
 * depuis 0, mais sur un refetch qui passe de 158 a 159 on anime 158 -> 159 et
 * non 0 -> 159. Une valeur non numerique (null pendant une erreur Drive) est
 * rendue telle quelle, sans animation, tout comme en prefers-reduced-motion.
 */
export function useCountUp(target, { duration = 900, delay = 0 } = {}) {
  // Evalue une seule fois : lire matchMedia a chaque rendu serait un effet de bord.
  const [reduceMotion] = useState(prefersReducedMotion)

  const isNumber = typeof target === 'number' && Number.isFinite(target)
  const shouldAnimate = isNumber && duration > 0 && !reduceMotion

  // null tant qu'aucune frame n'a encore produit de valeur.
  const [animatedValue, setAnimatedValue] = useState(null)
  const fromRef = useRef(0)
  const frameRef = useRef(null)

  useEffect(() => {
    if (!shouldAnimate || fromRef.current === target) {
      fromRef.current = isNumber ? target : 0
      return undefined
    }

    const from = fromRef.current
    let startedAt = null

    const tick = (timestamp) => {
      if (startedAt === null) startedAt = timestamp
      const elapsed = timestamp - startedAt - delay
      if (elapsed < 0) {
        frameRef.current = requestAnimationFrame(tick)
        return
      }
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3) // easeOutCubic
      setAnimatedValue(Math.round(from + (target - from) * eased))
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick)
      } else {
        fromRef.current = target
      }
    }

    frameRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameRef.current)
  }, [target, isNumber, shouldAnimate, duration, delay])

  if (!shouldAnimate) return target
  return animatedValue ?? 0
}

/**
 * Passe a `true` juste apres le premier paint, pour declencher une transition CSS
 * depuis l'etat initial (une barre montee a width:0 puis animee vers sa valeur).
 */
export function useArmed() {
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setArmed(true))
    return () => cancelAnimationFrame(id)
  }, [])
  return armed
}
