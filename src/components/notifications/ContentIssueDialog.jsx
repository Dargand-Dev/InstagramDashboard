import { useState } from 'react'
import { AlertTriangle, CheckCircle, ExternalLink, LoaderCircle, Play, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { apiPost, apiPut } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useNotificationStore } from '@/stores/notificationStore'
import { contentIssueKey } from '@/stores/notificationState'
import { Button, buttonVariants } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'

function DriveLink({ href, disabled }) {
  return (
    <a
      href={disabled ? undefined : href}
      target="_blank"
      rel="noopener noreferrer"
      aria-disabled={disabled || undefined}
      tabIndex={disabled ? -1 : undefined}
      className={cn(buttonVariants({ variant: 'outline' }), disabled && 'pointer-events-none opacity-50')}
    >
      <ExternalLink data-icon="inline-start" />
      Ouvrir dans Drive
    </a>
  )
}

function ContentIssueDetails({ notification, queuedCount }) {
  const [previewOpen, setPreviewOpen] = useState(false)
  const [confirmTrash, setConfirmTrash] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const issue = notification.contentIssue
  const filePath = `https://drive.google.com/file/d/${encodeURIComponent(issue.driveFileId)}`
  const { dismissContentIssue, markRead, markDriveFileTrashed } = useNotificationStore()

  const dismiss = () => {
    if (pending) return
    dismissContentIssue(contentIssueKey(notification))
    if (!notification.read) {
      markRead(notification.id)
      apiPut(`/api/notifications/${encodeURIComponent(notification.id)}/read`)
        .catch(() => toast.error('Impossible de marquer la notification comme lue.'))
    }
  }

  const trashVideo = async () => {
    if (pending || issue.trashed) return
    setPending(true)
    setError('')
    try {
      const response = await apiPost(`/api/notifications/${encodeURIComponent(notification.id)}/trash-drive-video`)
      const result = response.data || response
      if (result.trashed !== true || result.driveFileId !== issue.driveFileId) {
        throw new Error(result.message || 'La mise à la corbeille n’a pas été confirmée. Réessayez.')
      }
      markDriveFileTrashed(issue.driveFileId)
      setPreviewOpen(false)
      setConfirmTrash(false)
    } catch (failure) {
      setError(failure.message || 'Impossible de mettre cette vidéo à la corbeille.')
    } finally {
      setPending(false)
    }
  }

  const errorAlert = error && (
    <Alert variant="destructive">
      <AlertTriangle />
      <AlertTitle>Action impossible</AlertTitle>
      <AlertDescription>{error}</AlertDescription>
    </Alert>
  )

  return (
    <Dialog open onOpenChange={(open) => { if (!open) dismiss() }}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl" showCloseButton={!pending}>
        <DialogHeader className="pr-8">
          <DialogTitle>Détail de la vidéo Drive</DialogTitle>
          <DialogDescription>Les vidéos sans template reconnu sont écartées de la sélection automatique.</DialogDescription>
        </DialogHeader>

        <dl className="grid gap-3 text-sm">
          <div className="flex flex-col gap-1">
            <dt className="text-muted-foreground">Fichier</dt>
            <dd className="break-all font-medium">{issue.filename || 'Nom de fichier indisponible'}</dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-muted-foreground">Compte concerné</dt>
            <dd className="break-all">{notification.accountId ? `@${notification.accountId}` : 'Compte non renseigné'}</dd>
          </div>
        </dl>

        {issue.trashed ? (
          <Alert>
            <CheckCircle />
            <AlertTitle>Vidéo mise à la corbeille</AlertTitle>
            <AlertDescription>Ce fichier ne sera plus sélectionné dans Drive.</AlertDescription>
          </Alert>
        ) : (
          <Alert variant="destructive">
            <AlertTriangle />
            <AlertTitle>Template manquant</AlertTitle>
            <AlertDescription>{notification.message || 'Le nom de cette vidéo ne contient aucun template valide. Corrigez son nom dans Drive ou retirez-la du dossier.'}</AlertDescription>
          </Alert>
        )}

        {!confirmTrash && errorAlert}

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={pending || issue.trashed} onClick={() => setPreviewOpen(!previewOpen)}>
            <Play data-icon="inline-start" />
            {previewOpen ? 'Masquer l’aperçu' : 'Visualiser la vidéo'}
          </Button>
          <DriveLink href={`${filePath}/view`} disabled={pending} />
          <Button variant="destructive" disabled={pending || issue.trashed} onClick={() => { setError(''); setConfirmTrash(true) }}>
            <Trash2 data-icon="inline-start" />
            Mettre à la corbeille
          </Button>
        </div>

        {previewOpen && !issue.trashed && (
          <div className="flex flex-col gap-2">
            <iframe
              src={`${filePath}/preview`}
              title={`Aperçu de ${issue.filename || 'la vidéo Drive'}`}
              className="aspect-video w-full rounded-lg border"
              allow="fullscreen"
              allowFullScreen
            />
            <p className="text-xs text-muted-foreground">Si l’aperçu est indisponible, ouvrez la vidéo dans Drive avec un compte autorisé.</p>
          </div>
        )}

        <p className="text-xs text-muted-foreground">Vous pouvez retrouver cette alerte dans Notifications.{queuedCount > 1 && ` ${queuedCount - 1} autre(s) alerte(s) en attente.`}</p>

        <DialogFooter>
          <Button variant="outline" onClick={dismiss} disabled={pending}>Fermer</Button>
        </DialogFooter>

        <AlertDialog open={confirmTrash} onOpenChange={(open) => { if (!pending) setConfirmTrash(open) }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Mettre la vidéo à la corbeille ?</AlertDialogTitle>
              <AlertDialogDescription>
                <span className="break-all font-medium">{issue.filename || 'Cette vidéo'}</span> sera déplacée dans la corbeille Google Drive et ne sera plus disponible pour les publications de tous les comptes qui utilisent ce fichier.
              </AlertDialogDescription>
            </AlertDialogHeader>
            {errorAlert}
            <AlertDialogFooter>
              <AlertDialogCancel disabled={pending}>Annuler</AlertDialogCancel>
              <AlertDialogAction variant="destructive" disabled={pending || issue.trashed} onClick={trashVideo}>
                {pending ? <LoaderCircle className="animate-spin" data-icon="inline-start" /> : <Trash2 data-icon="inline-start" />}
                {pending ? 'Mise à la corbeille…' : 'Confirmer la mise à la corbeille'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  )
}

export default function ContentIssueDialog() {
  const notifications = useNotificationStore((state) => state.notifications)
  const queue = useNotificationStore((state) => state.contentAlertQueue)
  const notification = notifications.find((item) => contentIssueKey(item) === queue[0])
  return notification ? <ContentIssueDetails key={queue[0]} notification={notification} queuedCount={queue.length} /> : null
}
