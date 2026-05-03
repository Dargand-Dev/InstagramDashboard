const BEGIN_RE = /▶▶ ACCOUNT_BEGIN (\S+)/
const END_RE = /■■ ACCOUNT_END (\S+)/

/**
 * Filtre les lignes de log d'un run pour ne garder que celles d'un compte donné,
 * en préfixant les lignes hors-compte avec "[run] " comme contexte.
 *
 * @param {string} text - Texte complet des logs du run (lignes séparées par \n)
 * @param {string} targetUsername - Username du compte à isoler
 * @param {{ includeContext?: boolean }} [opts]
 * @returns {string} Texte filtré
 */
export function extractAccountLog(text, targetUsername, { includeContext = true } = {}) {
  if (!text) return ''
  const lines = text.split('\n')
  const out = []
  let currentAccount = null

  for (const line of lines) {
    const beginMatch = line.match(BEGIN_RE)
    if (beginMatch) {
      currentAccount = beginMatch[1]
      if (currentAccount === targetUsername) out.push(line)
      continue
    }

    const endMatch = line.match(END_RE)
    if (endMatch) {
      if (endMatch[1] === targetUsername) out.push(line)
      currentAccount = null
      continue
    }

    if (currentAccount === targetUsername) {
      out.push(line)
    } else if (currentAccount === null && includeContext) {
      out.push(`[run] ${line}`)
    }
  }

  return out.join('\n')
}

/**
 * Indique si le texte contient au moins une sentinelle BEGIN
 * (= run émis avec la fonctionnalité de boundary activée).
 *
 * @param {string} text
 * @returns {boolean}
 */
export function hasAccountSentinels(text) {
  if (!text) return false
  return BEGIN_RE.test(text)
}
