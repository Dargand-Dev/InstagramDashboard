import { apiGet, apiPost, apiDelete } from '@/lib/api'

/**
 * Récupère la timeline complète d'un compte.
 * Backend: GET /api/accounts/{username}/timeline?format=json
 * Réponse: { account, events: [{ timestamp, source, eventType, category, outcome, summary, attributes, backfilled }] }
 */
export function fetchAccountTimeline(username, signal) {
  return apiGet(`/api/accounts/${encodeURIComponent(username)}/timeline?format=json`, signal)
}

/**
 * Crée une note manuelle (note libre).
 * Body: { noteAt: ISO|null, text: string, tags?: string[] }
 */
export function addAccountNote(username, body) {
  return apiPost(`/api/accounts/${encodeURIComponent(username)}/notes`, body)
}

/**
 * Supprime une note manuelle.
 */
export function deleteAccountNote(username, noteId) {
  return apiDelete(`/api/accounts/${encodeURIComponent(username)}/notes/${encodeURIComponent(noteId)}`)
}

/**
 * Émet un event ACCOUNT_LIFECYCLE manuel rétroactif.
 * Body: { eventType: string, ts?: ISO, attributes?: { linkUrl?, note? } }
 */
export function addAccountLifecycleEvent(username, body) {
  return apiPost(`/api/accounts/${encodeURIComponent(username)}/lifecycle-events`, body)
}

/** Liste des types `*_LIFECYCLE` autorisés en saisie manuelle (miroir de la whitelist serveur). */
export const LIFECYCLE_EVENT_TYPES = [
  { value: 'ACCOUNT_STORY_LINK_BACKFILLED', label: 'Lien story rattrapé', requiresLinkUrl: true },
  { value: 'ACCOUNT_NECESSARY_LINK_BACKFILLED', label: 'Lien nécessaire rattrapé', requiresLinkUrl: true },
  { value: 'ACCOUNT_HIGHLIGHT_BACKFILLED', label: 'Highlight rattrapé', requiresLinkUrl: false },
  { value: 'ACCOUNT_MANUAL_BAN', label: 'Ban signalé manuellement', requiresLinkUrl: false },
  { value: 'ACCOUNT_MANUAL_REACTIVATED', label: 'Réactivation manuelle', requiresLinkUrl: false },
]
