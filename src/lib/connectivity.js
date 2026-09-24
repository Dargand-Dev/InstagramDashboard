// Connectivité USB (idevice_id) + SSH exposée par /api/devices/live-status
// (DeviceConnectivityService côté backend, sonde toutes les 20 s).

// Champs de connectivité d'une entrée live-status, à fusionner dans le device affiché
export function pickConnectivity(live) {
  return {
    usbConnected: live.usbConnected,
    sshReachable: live.sshReachable,
    sshError: live.sshError,
    connectivityCheckedAt: live.connectivityCheckedAt,
  }
}

// Cause affichée pour un téléphone DEGRADED (un seul des deux tests a échoué)
export function degradedReason(device) {
  if (device.usbConnected === false) return 'Câble USB non détecté'
  if (device.sshReachable === false) return `SSH injoignable${device.sshError ? ` (${device.sshError})` : ''}`
  return 'Connectivité partielle'
}
