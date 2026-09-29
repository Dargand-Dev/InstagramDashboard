import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api'

const EMPTY_TYPES = []

export default function useProfilePictureTypes() {
  const query = useQuery({
    queryKey: ['profile-picture-types'],
    queryFn: async ({ signal }) => {
      const types = await apiGet('/api/profile-picture-types', signal)
      if (!Array.isArray(types)) throw new Error('La liste des types de photos de profil est invalide.')
      return types
    },
    retry: (failureCount, error) => error.status !== 404 && failureCount < 2,
  })

  return { ...query, types: query.data ?? EMPTY_TYPES }
}
