export function parseUsernames(text) {
  return [...new Set(text.split(/\r?\n/).map(value => value.trim().toLowerCase()).filter(Boolean))]
}

export function namePoolPayload({ enabled, firstName, text, version }) {
  const name = firstName.trim()
  if (enabled && (!name || name.length > 64)) throw new Error('Renseignez un prénom de 1 à 64 caractères.')
  const usernames = parseUsernames(text)
  if (usernames.length > 10000) throw new Error('La liste est limitée à 10 000 pseudos.')
  for (const username of usernames) {
    if (!/^[a-z0-9_](?:[a-z0-9_.]{0,28}[a-z0-9_])?$/.test(username) || username.includes('..')) {
      throw new Error(`Pseudo invalide : « ${username} ». Utilisez 1 à 30 lettres, chiffres, points ou underscores, sans point aux extrémités ni points consécutifs.`)
    }
  }
  return { enabled, firstName: name, usernames, version: version ?? null }
}
