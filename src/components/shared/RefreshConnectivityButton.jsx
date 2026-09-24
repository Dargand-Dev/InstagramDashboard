import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { RefreshCw } from 'lucide-react'
import { apiPost } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// Force un test USB + SSH immédiat de tous les téléphones. La réponse contient déjà les
// statuts à jour : on la pose dans le cache ['devices-live'] partagé par les pages.
export default function RefreshConnectivityButton({ className }) {
  const queryClient = useQueryClient()
  const refresh = useMutation({
    mutationFn: () => apiPost('/api/devices/connectivity/refresh'),
    onSuccess: (res) => queryClient.setQueryData(['devices-live'], res),
    onError: (err) => toast.error(`Revérification impossible : ${err.message}`),
  })

  return (
    <Button
      size="sm"
      variant="outline"
      className={cn(className)}
      onClick={() => refresh.mutate()}
      disabled={refresh.isPending}
      title="Relance idevice_id et un test SSH sur chaque téléphone"
    >
      <RefreshCw className={`w-4 h-4 mr-1.5 ${refresh.isPending ? 'animate-spin' : ''}`} />
      Revérifier
    </Button>
  )
}
