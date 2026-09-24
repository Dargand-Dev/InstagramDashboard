import { Check, X, CircleHelp } from 'lucide-react'

const STATE_STYLE = {
  ok: 'bg-[#22C55E]/10 text-[#22C55E] border-[#22C55E]/20',
  ko: 'bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/20',
  unknown: 'bg-[#52525B]/10 text-[#52525B] border-[#52525B]/20',
}

const STATE_ICON = { ok: Check, ko: X, unknown: CircleHelp }

function stateOf(value) {
  if (value === true) return 'ok'
  if (value === false) return 'ko'
  return 'unknown'
}

function Pill({ label, value, title }) {
  const state = stateOf(value)
  const Icon = STATE_ICON[state]
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-medium ${STATE_STYLE[state]}`}
    >
      <Icon className="w-2.5 h-2.5" />
      {label}
    </span>
  )
}

// Pastilles USB / SSH issues de la sonde backend (idevice_id -l + ssh true, toutes les 20 s)
export default function ConnectivityPills({ device }) {
  const checkedAt = device.connectivityCheckedAt
    ? `Dernier test : ${new Date(device.connectivityCheckedAt).toLocaleTimeString('fr-FR')}`
    : 'Pas encore testé'

  const usbTitle = device.usbConnected === true
    ? 'Vu par idevice_id'
    : device.usbConnected === false
      ? 'Absent de idevice_id -l (câble débranché ?)'
      : 'État USB inconnu'

  const sshTitle = device.sshReachable === true
    ? 'SSH accessible'
    : device.sshReachable === false
      ? `SSH injoignable : ${device.sshError || 'erreur inconnue'}`
      : 'État SSH inconnu'

  return (
    <div className="flex items-center gap-1.5">
      <Pill label="USB" value={device.usbConnected} title={`${usbTitle}\n${checkedAt}`} />
      <Pill label="SSH" value={device.sshReachable} title={`${sshTitle}\n${checkedAt}`} />
    </div>
  )
}
