// Statuts live d'un device qui ont un libellé dédié ; les autres s'affichent tels quels.
const DEVICE_STATUS_LABELS = {
  WAITING_PROXY: 'Attente proxy',
}

export function deviceStatusLabel(status) {
  return DEVICE_STATUS_LABELS[status] || status
}

// Un device qui attend le proxy partagé a déjà une tâche démarrée : il compte parmi les « Running ».
export function isBusyStatus(status) {
  return status === 'RUNNING' || status === 'WAITING_PROXY'
}

// Couleur du proxy partagé (badge, bandeau d'attente, pastille de file)
export const SHARED_PROXY_COLOR = '#06B6D4'
