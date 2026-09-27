import { useMemo } from 'react'
import { AlertTriangle, FileVideo } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { useNotificationStore } from '@/stores/notificationStore'
import { blockingContentIssues } from '@/stores/notificationState'

export default function ContentIssueBanner() {
  const notifications = useNotificationStore((state) => state.notifications)
  const openContentIssue = useNotificationStore((state) => state.openContentIssue)
  const issues = useMemo(() => blockingContentIssues(notifications), [notifications])

  if (issues.length === 0) return null

  return (
    <div className="shrink-0 px-4 pt-3 lg:px-6">
      <Alert variant="destructive">
        <AlertTriangle />
        <AlertTitle>
          {issues.length === 1 ? 'Une vidéo Drive a bloqué une publication' : `${issues.length} vidéos Drive ont bloqué des publications`}
        </AlertTitle>
        <AlertDescription>
          <p>Un template manque dans le nom du fichier. La même vidéo peut faire échouer les prochaines publications des comptes utilisant ce dossier Drive.</p>
          <ul className="mt-2 flex max-h-40 flex-col gap-2 overflow-y-auto">
            {issues.map((notification) => (
              <li key={notification.contentIssue.driveFileId} className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                <span className="min-w-0 break-all">{notification.contentIssue.filename || 'Vidéo sans nom'}{notification.contentIssue.identityId && ` · ${notification.contentIssue.identityId}`}</span>
                <Button variant="outline" size="sm" onClick={() => openContentIssue(notification.id)}>
                  <FileVideo data-icon="inline-start" />
                  Examiner la vidéo
                </Button>
              </li>
            ))}
          </ul>
        </AlertDescription>
      </Alert>
    </div>
  )
}
