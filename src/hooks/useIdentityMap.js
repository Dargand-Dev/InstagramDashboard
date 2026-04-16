import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api'

export function useIdentityMap() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['identity-map'],
    queryFn: () => apiGet('/api/automation/content-status'),
    refetchInterval: 30_000,
    staleTime: 20_000,
  })

  const { identityNames, usernameToIdentity, identityToUsernames } = useMemo(() => {
    const raw = data?.data || data || null
    const identities = raw
      ? (Array.isArray(raw) ? raw : raw.identities || [])
      : []

    const names = []
    const byUsername = {}
    const byIdentity = {}

    for (const identity of identities) {
      const name = identity.identityId || identity.identityName || identity.identity || identity.name || `Identity ${names.length + 1}`
      names.push(name)
      byIdentity[name] = []
      const accs = identity.accounts || []
      for (const acc of accs) {
        const username = typeof acc === 'string' ? acc : acc?.username
        if (username) {
          byUsername[username] = name
          byIdentity[name].push(username)
        }
      }
    }

    return {
      identityNames: names,
      usernameToIdentity: byUsername,
      identityToUsernames: byIdentity,
    }
  }, [data])

  return { identityNames, usernameToIdentity, identityToUsernames, isLoading, error }
}
