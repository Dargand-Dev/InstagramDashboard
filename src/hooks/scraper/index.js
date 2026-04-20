import { useQuery } from '@tanstack/react-query'
import { scraperGet } from '@/api/scraperClient'

const KEYS = {
  overview: (periodDays) => ['scraper', 'overview', periodDays],
  overviewSeries: (periodDays, granularity) => ['scraper', 'overview-series', periodDays, granularity],
  topAccounts: (metric, periodDays, limit) => ['scraper', 'top-accounts', metric, periodDays, limit],
  identityPerformance: (periodDays) => ['scraper', 'identity-performance', periodDays],
  linkReadiness: (periodDays, limit) => ['scraper', 'link-readiness', periodDays, limit],
  retirementCandidates: (minAgeDays, dailyAvgThreshold, periodDays, limit) =>
    ['scraper', 'retirement-candidates', minAgeDays, dailyAvgThreshold, periodDays, limit],
  viewsEvolution: (accountId, from, to, granularity) =>
    ['scraper', 'views-evolution', accountId, from, to, granularity],
  followersEvolution: (accountId, from, to, granularity) =>
    ['scraper', 'followers-evolution', accountId, from, to, granularity],
  accounts: (page, size) => ['scraper', 'accounts', page, size],
  accountDashboard: (id, periodDays) => ['scraper', 'account-dashboard', id, periodDays],
  accountReels: (id, page, size) => ['scraper', 'account-reels', id, page, size],
  efficiency: (periodDays, limit) => ['scraper', 'efficiency', periodDays, limit],
}

export const scraperKeys = KEYS

const THIRTY_SEC = 30_000

export function useScraperOverview(periodDays = 30) {
  return useQuery({
    queryKey: KEYS.overview(periodDays),
    queryFn: () => scraperGet('/analytics/overview', { periodDays }),
    refetchInterval: THIRTY_SEC,
    staleTime: 15_000,
  })
}

export function useScraperOverviewSeries(periodDays = 30, granularity = 'DAY') {
  return useQuery({
    queryKey: KEYS.overviewSeries(periodDays, granularity),
    queryFn: () => scraperGet('/analytics/overview-series', { periodDays, granularity }),
    refetchInterval: THIRTY_SEC,
    staleTime: 15_000,
  })
}

export function useScraperTopAccounts(metric = 'VIEWS_GROWTH', periodDays = 7, limit = 20) {
  return useQuery({
    queryKey: KEYS.topAccounts(metric, periodDays, limit),
    queryFn: () => scraperGet('/analytics/top-accounts', { metric, periodDays, limit }),
    refetchInterval: THIRTY_SEC,
    staleTime: 15_000,
  })
}

export function useScraperIdentityPerformance(periodDays = 30) {
  return useQuery({
    queryKey: KEYS.identityPerformance(periodDays),
    queryFn: () => scraperGet('/analytics/identity-performance', { periodDays }),
    refetchInterval: THIRTY_SEC,
    staleTime: 15_000,
  })
}

export function useScraperLinkReadiness(periodDays = 14, limit = 50) {
  return useQuery({
    queryKey: KEYS.linkReadiness(periodDays, limit),
    queryFn: () => scraperGet('/analytics/link-readiness', { periodDays, limit }),
    refetchInterval: THIRTY_SEC,
    staleTime: 15_000,
  })
}

export function useScraperRetirementCandidates(minAgeDays = 30, dailyAvgThreshold = 100, periodDays = 14, limit = 50) {
  return useQuery({
    queryKey: KEYS.retirementCandidates(minAgeDays, dailyAvgThreshold, periodDays, limit),
    queryFn: () => scraperGet('/analytics/retirement-candidates', {
      minAgeDays, dailyAvgThreshold, periodDays, limit,
    }),
    refetchInterval: THIRTY_SEC,
    staleTime: 15_000,
  })
}

export function useScraperViewsEvolution(accountId, from, to, granularity = 'DAY', enabled = true) {
  return useQuery({
    queryKey: KEYS.viewsEvolution(accountId, from, to, granularity),
    queryFn: () => scraperGet('/analytics/views-evolution', { accountId, from, to, granularity }),
    enabled: !!accountId && !!from && !!to && enabled,
    staleTime: 60_000,
  })
}

export function useScraperFollowersEvolution(accountId, from, to, granularity = 'DAY', enabled = true) {
  return useQuery({
    queryKey: KEYS.followersEvolution(accountId, from, to, granularity),
    queryFn: () => scraperGet('/analytics/followers-evolution', { accountId, from, to, granularity }),
    enabled: !!accountId && !!from && !!to && enabled,
    staleTime: 60_000,
  })
}

export function useScraperAccounts(page = 0, size = 500) {
  return useQuery({
    queryKey: KEYS.accounts(page, size),
    queryFn: () => scraperGet('/accounts', { page, size }),
    refetchInterval: THIRTY_SEC,
    staleTime: 30_000,
  })
}

export function useScraperAccountDashboard(id, periodDays = 30, enabled = true) {
  return useQuery({
    queryKey: KEYS.accountDashboard(id, periodDays),
    queryFn: () => scraperGet(`/analytics/account/${id}/dashboard`, { periodDays }),
    enabled: !!id && enabled,
    staleTime: 30_000,
  })
}

export function useScraperAccountReels(id, page = 0, size = 20, enabled = true) {
  return useQuery({
    queryKey: KEYS.accountReels(id, page, size),
    queryFn: () => scraperGet(`/analytics/account/${id}/reels`, { page, size, sort: 'publishedAt,desc' }),
    enabled: !!id && enabled,
    staleTime: 30_000,
  })
}

export function useScraperEfficiency(periodDays = 30, limit = 50) {
  return useQuery({
    queryKey: KEYS.efficiency(periodDays, limit),
    queryFn: () => scraperGet('/analytics/efficiency', { periodDays, limit }),
    refetchInterval: THIRTY_SEC,
    staleTime: 15_000,
  })
}
