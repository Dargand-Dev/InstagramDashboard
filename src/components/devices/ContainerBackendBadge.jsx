import { backendColor, backendLabel } from '@/hooks/useDeviceBackend'

/**
 * Quel outillage de containers tourne sur ce téléphone.
 *
 * Le suffixe « auto » distingue un backend subi (détecté) d'un backend choisi : sans lui, on ne
 * peut pas savoir au premier coup d'œil si le téléphone est réglé ou s'il suit juste la sonde.
 */
export default function ContainerBackendBadge({ device, className = '' }) {
  const backend = device?.effectiveBackend
  if (!backend) return null

  const color = backendColor(backend)
  const isAuto = !device.containerBackend

  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded border whitespace-nowrap ${className}`}
      style={{ color, borderColor: `${color}40`, backgroundColor: `${color}10` }}
      title={
        isAuto
          ? `Détecté automatiquement${device.backendProbe ? ` — ${device.backendProbe}` : ''}`
          : 'Forcé manuellement'
      }
    >
      {backendLabel(backend)}
      {isAuto && <span className="text-[9px] opacity-60">auto</span>}
    </span>
  )
}
