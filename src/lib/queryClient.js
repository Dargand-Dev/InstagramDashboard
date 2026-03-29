import { QueryClient, QueryCache, MutationCache } from '@tanstack/react-query'
import { toast } from 'sonner'

function isUnauthorized(error) {
  return error?.status === 401 || error?.response?.status === 401
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      refetchInterval: false,
      retry: 1,
      refetchOnWindowFocus: true,
    },
    mutations: {
      onError: (error) => {
        if (isUnauthorized(error)) return
        toast.error('Operation failed', {
          description: error.message || 'Something went wrong',
        })
      },
    },
  },
  queryCache: new QueryCache({
    onError: (error) => {
      if (isUnauthorized(error)) return
      toast.error('Failed to fetch data', {
        description: error.message || 'Something went wrong',
      })
    },
  }),
  mutationCache: new MutationCache({
    onError: (error) => {
      if (isUnauthorized(error)) return
      toast.error('Operation failed', {
        description: error.message || 'Something went wrong',
      })
    },
  }),
})
