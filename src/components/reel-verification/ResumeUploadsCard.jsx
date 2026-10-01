import { AlertCircle, Loader2, Upload } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle,
} from '@/components/ui/card'
import {
  Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'

const RESULT_LABELS = {
  COMPLETED: { label: 'Done observé', variant: 'default' },
  NO_UPLOAD: { label: 'Aucun envoi visible', variant: 'secondary' },
  TIMED_OUT: { label: 'Délai atteint', variant: 'outline' },
  SKIPPED: { label: 'Non traité', variant: 'secondary' },
  FAILED: { label: 'Échec', variant: 'destructive' },
  CANCELLED: { label: 'Annulé', variant: 'secondary' },
}

export default function ResumeUploadsCard({ run, isError, isFetching, onRefresh }) {
  if (!run && !isError) return null

  const running = run?.status === 'RUNNING'
  const results = run?.results || []

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="size-4" />
          Reprise des publications
        </CardTitle>
        <CardDescription>
          Un compte à la fois, rotation IP vérifiée avant ouverture, puis fermeture après
          « Done » ou au bout de 40 s d’attente.
        </CardDescription>
        {run && (
          <CardAction>
            <Badge variant={run.status === 'FAILED' ? 'destructive' : 'secondary'}>
              {running ? 'En cours' : run.status === 'COMPLETED' ? 'Terminé' : 'Interrompu'}
            </Badge>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {isError && (
          <Alert variant="destructive">
            <AlertCircle />
            <AlertTitle>Suivi indisponible</AlertTitle>
            <AlertDescription className="flex flex-col items-start gap-2">
              <p>Le traitement peut continuer sur le serveur. Actualisez le suivi pour retrouver son état.</p>
              <Button size="sm" variant="outline" onClick={onRefresh} disabled={isFetching}>
                {isFetching && <Loader2 data-icon="inline-start" className="animate-spin" />}
                Actualiser le suivi
              </Button>
            </AlertDescription>
          </Alert>
        )}
        {run && (
          <div role="status" aria-live="polite" className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <span>{run.processed ?? 0} / {run.total ?? 0} comptes traités</span>
            {running && (
              <span className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                {run.currentUsername ? `En attente ou en cours : @${run.currentUsername}` : 'Préparation du prochain compte…'}
              </span>
            )}
          </div>
        )}
        {run?.error && (
          <Alert variant="destructive">
            <AlertCircle />
            <AlertTitle>Traitement interrompu</AlertTitle>
            <AlertDescription>{run.error}</AlertDescription>
          </Alert>
        )}
        {results.length > 0 && (
          <div className="max-h-80 overflow-y-auto">
            <Table>
              <TableCaption className="sr-only">Résultats de la reprise des publications</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Compte</TableHead>
                  <TableHead>Envoi observé</TableHead>
                  <TableHead>Attente</TableHead>
                  <TableHead>Détail</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((result, index) => {
                  const status = RESULT_LABELS[result.status] || { label: result.status, variant: 'outline' }
                  return (
                    <TableRow key={`${result.username}-${index}`}>
                      <TableCell>@{result.username}</TableCell>
                      <TableCell><Badge variant={status.variant}>{status.label}</Badge></TableCell>
                      <TableCell>{Math.round((result.waitedMs || 0) / 1000)} s</TableCell>
                      <TableCell className="min-w-48 whitespace-normal">{result.message || '—'}</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
      <CardFooter>
        <p className="text-sm text-muted-foreground">
          L’absence d’envoi visible ne confirme pas la publication. La liste des reels est
          actualisée après la vérification habituelle.
        </p>
      </CardFooter>
    </Card>
  )
}
