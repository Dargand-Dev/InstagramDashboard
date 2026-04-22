import { AlertTriangle } from 'lucide-react'

/**
 * Petite icône warning orange affichée à côté du StatusBadge quand un compte a été créé
 * avec un ou plusieurs steps non-bloquants échoués (setup pro ou 2FA).
 *
 * Rien ne s'affiche si aucun flag n'est levé.
 */
export default function AccountWarnings({ account }) {
  const warnings = []
  if (account?.setupProfessionalFailed) warnings.push('Setup compte pro échoué')
  if (account?.twoFaFailed) warnings.push('2FA non activée')

  if (warnings.length === 0) return null

  return (
    <span
      title={warnings.join(' • ')}
      className="inline-flex items-center text-[#F59E0B]"
      aria-label={`Warnings: ${warnings.join(', ')}`}
    >
      <AlertTriangle size={14} />
    </span>
  )
}
