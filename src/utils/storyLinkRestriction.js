// Restriction des liens en Story : Instagram refuse le sticker Link au compte
// (« Your account isn't eligible to add links »). Le backend pose storyLinkRestrictedAt
// au premier constat et le remet à null quand un lien repasse (StoryLinkRestrictionService).

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

export function isStoryLinkRestricted(account) {
  return !!account?.storyLinkRestrictedAt
}

/**
 * Comptes restreints encore exploités (les BANNED sont exclus : leur container est supprimé)
 * et, parmi eux, ceux restreints depuis moins de 7 jours.
 */
export function countStoryLinkRestricted(accounts) {
  const now = Date.now()
  let total = 0
  let lastWeek = 0
  for (const account of Array.isArray(accounts) ? accounts : []) {
    if (!isStoryLinkRestricted(account) || account.status === 'BANNED') continue
    total++
    if (now - new Date(account.storyLinkRestrictedAt).getTime() < WEEK_MS) lastWeek++
  }
  return { total, lastWeek }
}
