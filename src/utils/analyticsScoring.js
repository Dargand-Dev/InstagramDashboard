import { toBangkokISO } from './format'

const DAY_MS = 24 * 60 * 60 * 1000

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

export function latestSnapshotPerUsername(snapshots) {
  const latest = {}
  for (const snap of snapshots) {
    const existing = latest[snap.username]
    if (!existing || snap.snapshotAt > existing.snapshotAt) {
      latest[snap.username] = snap
    }
  }
  return latest
}

export function computeAllTimeViews(snapshots) {
  const byAccount = {}
  for (const snap of snapshots) {
    if (!byAccount[snap.username]) byAccount[snap.username] = {}
    const month = toBangkokISO(snap.snapshotAt)?.slice(0, 7)
    if (!month) continue
    const views = snap.viewsLast30Days || 0
    if (!byAccount[snap.username][month] || views > byAccount[snap.username][month]) {
      byAccount[snap.username][month] = views
    }
  }
  const result = {}
  for (const [username, months] of Object.entries(byAccount)) {
    result[username] = Object.values(months).reduce((sum, v) => sum + v, 0)
  }
  return result
}

function snapshotsByUsername(snapshots) {
  const map = {}
  for (const snap of snapshots) {
    if (!map[snap.username]) map[snap.username] = []
    map[snap.username].push(snap)
  }
  for (const username of Object.keys(map)) {
    map[username].sort((a, b) => new Date(a.snapshotAt) - new Date(b.snapshotAt))
  }
  return map
}

function findClosestSnapshot(sortedSnapshots, targetMs, toleranceMs = DAY_MS) {
  if (!sortedSnapshots.length) return null
  let best = null
  let bestDiff = Infinity
  for (const snap of sortedSnapshots) {
    const diff = Math.abs(new Date(snap.snapshotAt).getTime() - targetMs)
    if (diff < bestDiff) {
      bestDiff = diff
      best = snap
    }
    if (diff > bestDiff) break
  }
  if (bestDiff > toleranceMs) return null
  return best
}

export function viewsDeltaInWindow(snapshots, days, nowMs = Date.now()) {
  const byUser = snapshotsByUsername(snapshots)
  const result = {}
  const targetMs = nowMs - days * DAY_MS
  for (const [username, userSnaps] of Object.entries(byUser)) {
    if (!userSnaps.length) { result[username] = null; continue }
    const latest = userSnaps[userSnaps.length - 1]
    // Baseline = premier snapshot >= targetMs (borne basse de la fenêtre).
    // Si l'historique commence APRÈS target (Scraper fraîchement déployé), on prend le
    // tout premier snapshot dispo — on sous-estime le delta mais on ne fait pas disparaître
    // l'account du classement.
    let baseline = null
    for (const snap of userSnaps) {
      const t = new Date(snap.snapshotAt).getTime()
      if (t >= targetMs) { baseline = snap; break }
    }
    if (!baseline) baseline = userSnaps[0]
    if (baseline === latest) { result[username] = null; continue }
    result[username] = (latest.viewsLast30Days || 0) - (baseline.viewsLast30Days || 0)
  }
  return result
}

export function accountMomentumScore(snapshots, { windowDays = 7, nowMs = Date.now() } = {}) {
  const recent = viewsDeltaInWindow(snapshots, windowDays, nowMs)
  const prev = viewsDeltaInWindow(snapshots, windowDays * 2, nowMs)

  const result = []
  for (const [username, recentDelta] of Object.entries(recent)) {
    if (recentDelta == null) continue
    const totalPrev = prev[username]
    if (totalPrev == null) continue
    const prevDelta = totalPrev - recentDelta
    const accelRatio = (recentDelta - prevDelta) / Math.max(Math.abs(prevDelta), 1)
    const acceleration = clamp(accelRatio, -1, 2)
    const score = recentDelta * (1 + acceleration)
    result.push({
      username,
      recentDelta,
      prevDelta,
      acceleration,
      score,
    })
  }
  return result.sort((a, b) => b.score - a.score)
}

export function identityAvgViewsPerAccount(snapshots, usernameToIdentity, { windowDays = 7, nowMs = Date.now() } = {}) {
  if (!snapshots?.length || !usernameToIdentity) return []

  const byUser = snapshotsByUsername(snapshots)
  const targetDays = lastNDays(nowMs, windowDays)
  const byIdentity = {}

  for (const [username, userSnaps] of Object.entries(byUser)) {
    const identity = usernameToIdentity[username]
    if (!identity) continue

    const daily = computeDailyViewsForUsername(userSnaps)
    const windowValues = targetDays.map((day) => daily[day]).filter((v) => v != null)
    if (!windowValues.length) continue

    const totalInWindow = windowValues.reduce((sum, v) => sum + v, 0)
    if (!byIdentity[identity]) {
      byIdentity[identity] = { identity, totalViews: 0, accountCount: 0 }
    }
    byIdentity[identity].totalViews += totalInWindow
    byIdentity[identity].accountCount += 1
  }

  return Object.values(byIdentity)
    .map((b) => ({
      ...b,
      avgViewsPerAccount: b.accountCount > 0 ? b.totalViews / b.accountCount : 0,
    }))
    .sort((a, b) => b.avgViewsPerAccount - a.avgViewsPerAccount)
}

function computeDailyViewsForUsername(sortedSnaps) {
  if (!sortedSnaps.length) return {}
  const dayMap = {}
  for (const snap of sortedSnaps) {
    const local = toBangkokISO(snap.snapshotAt)
    if (!local) continue
    const day = local.slice(0, 10)
    const val = snap.viewsLast30Days || 0
    if (!dayMap[day] || snap.snapshotAt > dayMap[day].at) {
      dayMap[day] = { at: snap.snapshotAt, val }
    }
  }
  const days = Object.keys(dayMap).sort()
  if (!days.length) return {}

  const computed = {}
  const dateDaysAgo = (dateStr, n) => {
    const d = new Date(dateStr + 'T00:00:00')
    d.setDate(d.getDate() - n)
    return d.toISOString().slice(0, 10)
  }

  for (let i = 0; i < days.length; i++) {
    const day = days[i]
    const rToday = dayMap[day].val
    if (i === 0) {
      computed[day] = rToday
    } else {
      const rPrev = dayMap[days[i - 1]].val
      let views = rToday - rPrev
      const day30Ago = dateDaysAgo(day, 30)
      if (computed[day30Ago] !== undefined) {
        views += computed[day30Ago]
      }
      computed[day] = Math.max(0, views)
    }
  }
  return computed
}

function lastNDays(nowMs, n) {
  const result = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(nowMs - i * DAY_MS)
    const bangkok = toBangkokISO(d.toISOString())
    result.push(bangkok.slice(0, 10))
  }
  return result
}

function mean(values) {
  if (!values.length) return 0
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

function stdev(values) {
  if (values.length < 2) return 0
  const m = mean(values)
  const variance = values.reduce((sum, v) => sum + (v - m) ** 2, 0) / values.length
  return Math.sqrt(variance)
}

function ageDaysOf(createdAt, nowMs) {
  if (!createdAt) return null
  const created = new Date(createdAt).getTime()
  if (Number.isNaN(created)) return null
  return Math.floor((nowMs - created) / DAY_MS)
}

export function linkReadinessScore(snapshots, accounts, { windowDays = 14, nowMs = Date.now() } = {}) {
  const byUser = snapshotsByUsername(snapshots)
  const allTimeViews = computeAllTimeViews(snapshots)
  const targetDays = lastNDays(nowMs, windowDays)
  const accountsByUsername = {}
  for (const acc of accounts) {
    if (acc.username) accountsByUsername[acc.username] = acc
  }

  const result = []
  for (const [username, userSnaps] of Object.entries(byUser)) {
    const account = accountsByUsername[username]
    if (!account) continue
    if (account.storyLinkUrl) continue

    const daily = computeDailyViewsForUsername(userSnaps)
    const windowValues = targetDays.map((day) => daily[day]).filter((v) => v != null)
    if (windowValues.length < 7) continue

    const dailyMean = mean(windowValues)
    const dailyStdev = stdev(windowValues)
    const coefVariation = dailyStdev / Math.max(dailyMean, 1)
    const stability = 1 / (1 + coefVariation)
    const totalViews = allTimeViews[username] || 0
    const score = totalViews * stability

    result.push({
      username,
      totalViews,
      dailyMean,
      dailyStdev,
      stability,
      score,
    })
  }
  return result.sort((a, b) => b.score - a.score)
}

export function retirementScore(snapshots, accounts, { minAgeDays, dailyViewsThreshold = 100, windowDays = 14, nowMs = Date.now() } = {}) {
  const byUser = snapshotsByUsername(snapshots)
  const targetDays = lastNDays(nowMs, windowDays)
  const accountsByUsername = {}
  for (const acc of accounts) {
    if (acc.username) accountsByUsername[acc.username] = acc
  }

  const result = []
  for (const [username, userSnaps] of Object.entries(byUser)) {
    const account = accountsByUsername[username]
    if (!account) continue
    const ageDays = ageDaysOf(account.createdAt, nowMs)
    if (ageDays == null) continue

    const daily = computeDailyViewsForUsername(userSnaps)
    const windowValues = targetDays.map((day) => daily[day]).filter((v) => v != null)
    const dailyMean = windowValues.length ? mean(windowValues) : 0

    const isFlagged = ageDays > minAgeDays && dailyMean < dailyViewsThreshold
    if (!isFlagged) continue

    const score = ageDays / Math.max(dailyMean, 1)
    result.push({
      username,
      ageDays,
      dailyMean,
      score,
      isFlagged,
    })
  }
  return result.sort((a, b) => b.score - a.score)
}

export function viewsPerAccountByIdentityOverTime(snapshots, usernameToIdentity, { bucket = 'snapshot' } = {}) {
  if (!snapshots.length) return { rows: [], identityNames: [] }

  // Slot = minute-près par défaut → 1 point par snapshot.
  // Conservé 'half-day' et 'day' pour compat si d'autres appelants le demandent.
  const slotOf = (snapshotAt) => {
    const local = toBangkokISO(snapshotAt)
    if (!local) return null
    if (bucket === 'half-day') {
      const date = local.slice(0, 10)
      const hour = parseInt(local.slice(11, 13) || '0', 10)
      return `${date}T${hour < 12 ? '0' : '1'}`
    }
    if (bucket === 'day') return local.slice(0, 10)
    return local.slice(0, 16) // YYYY-MM-DDTHH:mm
  }

  const formatSlot = (slot) => {
    if (bucket === 'half-day') {
      const date = slot.slice(0, 10)
      const half = slot.slice(11) === '1' ? 'PM' : 'AM'
      return `${date.slice(8)}/${date.slice(5, 7)} ${half}`
    }
    if (bucket === 'day') return `${slot.slice(8)}/${slot.slice(5, 7)}`
    return `${slot.slice(8, 10)}/${slot.slice(5, 7)} ${slot.slice(11, 16)}`
  }

  // ts = millis UTC pour un axe X temporel proportionnel (au lieu de categorical).
  const slotToTs = (slot) => {
    if (bucket === 'half-day') {
      const date = slot.slice(0, 10)
      const hour = slot.slice(11) === '1' ? '12' : '00'
      return Date.parse(`${date}T${hour}:00:00Z`)
    }
    if (bucket === 'day') return Date.parse(`${slot}T00:00:00Z`)
    return Date.parse(`${slot}:00Z`)
  }

  const latestPerUserPerSlot = {}
  for (const snap of snapshots) {
    const identity = usernameToIdentity[snap.username]
    if (!identity) continue
    const slot = slotOf(snap.snapshotAt)
    if (!slot) continue
    if (!latestPerUserPerSlot[slot]) latestPerUserPerSlot[slot] = {}
    const existing = latestPerUserPerSlot[slot][snap.username]
    const val = snap.viewsLast30Days || 0
    if (existing == null || val > existing) {
      latestPerUserPerSlot[slot][snap.username] = val
    }
  }

  // Forward-fill par username sur les slots triés → un compte sans snapshot à t conserve
  // sa dernière valeur connue au lieu de tomber à 0 (sinon les moyennes oscillent).
  const identitySet = new Set()
  const sortedSlots = Object.keys(latestPerUserPerSlot).sort()
  const lastKnownByUser = {}

  const rows = sortedSlots.map((slot) => {
    for (const [username, val] of Object.entries(latestPerUserPerSlot[slot])) {
      lastKnownByUser[username] = val
    }
    const byIdentity = {}
    for (const [username, val] of Object.entries(lastKnownByUser)) {
      const identity = usernameToIdentity[username]
      if (!identity) continue
      identitySet.add(identity)
      if (!byIdentity[identity]) byIdentity[identity] = { sum: 0, count: 0 }
      byIdentity[identity].sum += val
      byIdentity[identity].count += 1
    }
    const point = { slot: formatSlot(slot), ts: slotToTs(slot) }
    for (const [identity, { sum, count }] of Object.entries(byIdentity)) {
      point[identity] = count > 0 ? Math.round(sum / count) : 0
    }
    return point
  })

  return { rows, identityNames: [...identitySet].sort() }
}

export function viewsByProvider(snapshots, accounts, { minAgeDays = 5, nowMs = Date.now() } = {}) {
  const latest = latestSnapshotPerUsername(snapshots)
  const buckets = {}

  for (const account of accounts) {
    const ageDays = ageDaysOf(account.createdAt, nowMs)
    if (ageDays == null || ageDays < minAgeDays) continue

    const snap = latest[account.username]
    if (!snap) continue

    const provider = account.smsProvider || 'Unknown'
    if (!buckets[provider]) {
      buckets[provider] = { provider, count: 0, totalViews: 0, accounts: [] }
    }
    buckets[provider].count += 1
    buckets[provider].totalViews += snap.viewsLast30Days || 0
    buckets[provider].accounts.push(account.username)
  }

  return Object.values(buckets)
    .map((b) => ({
      provider: b.provider,
      count: b.count,
      meanViews: b.count > 0 ? Math.round(b.totalViews / b.count) : 0,
      accounts: b.accounts,
    }))
    .sort((a, b) => b.meanViews - a.meanViews)
}
