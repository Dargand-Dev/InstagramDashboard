# Statut réel des téléphones (USB + SSH) — design

Date : 2026-09-24
Projets : `InstagramAutomation` (backend) + `InstagramDashboard` (`/activity-log`)

## Contexte

Sur `/activity-log`, tous les téléphones s'affichent `IDLE` alors que la plupart ne
sont pas branchés. Cause : `DeviceLiveStatusService.getAllStatuses()` crée l'entrée de
chaque device configuré avec `Status.IDLE` par défaut (`computeIfAbsent`), sans aucun
test physique. Un téléphone ne quitte `IDLE` que si un run le passe `RUNNING` /
`ERROR` / `DISCONNECTED`.

Mesure du 2026-09-24 (6 devices configurés) :

| Device | `idevice_id -l` | SSH `true` | Attendu |
|---|---|---|---|
| iPhoneVI (.37) | ✓ | ✓ (1 s) | `IDLE` |
| iPhoneII (.27) | ✓ | ✗ timeout 10 s | `DEGRADED` |
| iPhoneI, III, IV, V | ✗ | ✗ timeout 10 s | `OFFLINE` |

`/api/devices/live-status` est interrogé toutes les 10 s par 5 pages (Activity Log,
Devices, Execution Center, VNC Wall, Error Center). Un SSH vers un téléphone éteint
met 10 s à échouer (`ConnectTimeout=10`) : la sonde ne peut pas tourner dans la requête.

## Décisions validées

1. **État mixte** : nouvel état `DEGRADED`. `IDLE` seulement si USB ✓ **et** SSH ✓ ;
   `OFFLINE` si les deux échouent ; `DEGRADED` si un seul échoue, avec la cause.
2. **Approche A** : sonde en arrière-plan côté backend, résultat en cache, fusionné à la
   lecture du statut live.
3. **Bouton « Revérifier »** sur `/activity-log` qui force un test immédiat.

## Backend

### `DeviceAvailabilityChecker` — distinguer « vide » de « planté »

`getConnectedDeviceUdids()` renvoie un ensemble vide quand `idevice_id` échoue : un
seul raté ferait passer toute la flotte `OFFLINE`. Nouvelle méthode
`Optional<Set<String>> listConnectedUdids()` : `Optional.empty()` si la commande
échoue (IOException, timeout, code de sortie ≠ 0), l'ensemble des UDID sinon. Les
méthodes existantes ne changent pas.

### `DeviceConnectivityService` (nouveau, `service/`)

- Cache `ConcurrentHashMap<String, Connectivity>` par UDID.
- `record Connectivity(Boolean usb, boolean ssh, String sshError, Instant checkedAt)` :
  - `usb` : `true`/`false`, ou `null` si `idevice_id` a échoué (inconnu) ;
  - `ssh` : `true` si `ssh <ip> true` a réussi ;
  - `sshError` : raison lisible quand `ssh == false`, sinon `null`.
- `@Scheduled(fixedDelayString = "${device.connectivity.interval-ms:20000}",
  initialDelayString = "${device.connectivity.initial-delay-ms:5000}")` → `probeAll()`.
- `probeAll()` :
  1. un seul `listConnectedUdids()` pour tous les devices ;
  2. pour **tous** les devices configurés (activés ou non) ayant un UDID : SSH `true`
     vers `deviceIp` via `SshClient.checkReachable(ip, 12)`, **en parallèle** sur un pool
     dédié de 8 threads (≤ ~10 s par cycle) ; pas d'IP → `ssh=false`,
     `sshError="IP non configurée"` ;
  3. met à jour le cache ; pour chaque device dont `usb` ou `ssh` a changé (ou nouveau),
     publie `DeviceConnectivityChangedEvent(udid)` ;
  4. retire du cache les UDID qui ne sont plus configurés.
- **Temps borné** (ajout issu de la revue) : `SshClient.run` lit stdout jusqu'au bout
  avant `waitFor`, donc son timeout ne tue jamais une session figée après l'échange de
  clés. La sonde passe par `SshClient.checkReachable` : stdout ignoré, chien de garde qui
  tue sshpass et ssh à l'échéance, keepalives `ServerAliveInterval=5`/`CountMax=2`. En
  filet, chaque future est complétée en `timeout` après 17 s (`completeOnTimeout`).
- **Hors du thread `@Scheduled`** : l'appli n'en a qu'un (plusieurs `TaskScheduler`
  déclarés, aucun nommé `taskScheduler`, donc `spring.task.scheduling.pool.size` ne
  s'applique pas). La méthode `@Scheduled` confie le cycle à un exécuteur mono-thread
  dédié.
- **Un seul test à la fois** : `ReentrantLock`. Le cycle planifié fait `tryLock()` et
  saute son tour si un test tourne déjà. `refreshNow()` attend au plus 30 s
  (`tryLock(30 s)`) puis relance un test complet ; au-delà, il renvoie le cache tel quel.
- **Hystérésis SSH** (ajout après observation en réel : échecs `exit=255` isolés,
  rétablis au cycle suivant) : un téléphone dont le SSH était OK ne passe KO qu'après
  **2 échecs consécutifs** de la sonde planifiée. « Revérifier » applique le résultat brut.
- `get(udid)` → `Optional<Connectivity>`.
- Raisons SSH (`describeSshFailure(Result)`, statique, testable) :

  | Résultat | `sshError` |
  |---|---|
  | `timedOut()` ou stderr contient `timed out` | `timeout` |
  | stderr contient `Connection refused` | `connexion refusée (sshd arrêté ?)` |
  | stderr contient `No route to host` / `Host is down` | `hôte injoignable` |
  | `exitCode == 5` (sshpass) | `mot de passe refusé` |
  | `exception() != null` | l'exception |
  | autre, stderr non vide | 1re ligne de stderr (≤ 120 car.) |
  | autre | `exit=<code>` |

### `DeviceConnectivityChangedEvent` (nouveau, `event/`)

`record DeviceConnectivityChangedEvent(String deviceUdid)`.

### `DeviceLiveStatusService`

- Enum `Status` : ajout de `DEGRADED`.
- `DeviceStatus` : ajout de `Boolean usbConnected`, `Boolean sshReachable`,
  `String sshError`, `Instant connectivityCheckedAt`.
- Dépend de `DeviceConnectivityService` (pas l'inverse : le lien retour passe par
  l'événement, pas de cycle).
- Le statut est **calculé à la lecture** (`getAllStatuses()`, `getStatus()`), l'état
  stocké par les runs n'est jamais modifié. Fonction pure statique
  `effectiveStatus(Status stored, Connectivity c)` :
  - `stored` ≠ `IDLE` (`RUNNING`, `PAUSED`, `DISCONNECTED`, `ERROR`, `OFFLINE`) →
    `stored` ;
  - `c == null` (pas encore sondé) → `IDLE` ;
  - `usbKo = Boolean.FALSE.equals(c.usb())` (USB inconnu ≠ échec), `sshKo = !c.ssh()` ;
  - ni l'un ni l'autre → `IDLE` ; les deux → `OFFLINE` ; un seul → `DEGRADED`.
- Les 4 champs de connectivité sont renseignés quel que soit le statut.
- `@EventListener DeviceConnectivityChangedEvent` → pousse le `DeviceStatus` combiné sur
  `/topic/devices/status` (les pages invalident déjà `devices-live` sur ce topic).
- La construction de la copie enrichie (dupliquée entre `getAllStatuses` et `getStatus`)
  est factorisée dans une méthode privée `snapshot(DeviceStatus)`.

### Endpoint

`POST /api/devices/connectivity/refresh` (`DeviceLiveStatusController`) :
`connectivityService.refreshNow()` puis renvoie `getAllStatuses()`.

### Sans effet sur l'exécution

Aucun code backend ne lit le statut live pour décider de lancer une tâche
(`getStatus` ne sert qu'à récupérer le nom du device dans `QueueController` et
`ExecutionManagementController`). File d'attente et auto-création inchangées.
`ApplicationShutdownHandler.resetDeviceStatuses` remet l'état **stocké** à `IDLE` :
compatible, le statut affiché reste calculé.

### Configuration

`application.yml`, sous `device:` :

```yaml
  connectivity:
    interval-ms: 20000
    initial-delay-ms: 5000
```

### Tests (JUnit 5 / Mockito / AssertJ)

- `DeviceLiveStatusServiceTest` : table de `effectiveStatus` (IDLE / OFFLINE / DEGRADED
  dans les deux sens, états de run conservés, USB inconnu, pas encore sondé) ;
  `getAllStatuses` expose les champs de connectivité et le statut calculé.
- `DeviceConnectivityServiceTest` : `idevice_id` KO → `usb=null` ; pas d'IP → message ;
  événement publié au premier test et au changement, pas quand rien ne change ; device
  retiré de la config → retiré du cache ; `describeSshFailure` pour chaque cas.

## Dashboard

- `StatusBadge` : style `DEGRADED` (orange `#F97316`).
- `ActivityLog.jsx` : fusion des champs `usbConnected`, `sshReachable`, `sshError`,
  `connectivityCheckedAt` ; bouton **« Revérifier »** à côté du titre (icône
  `RefreshCw` qui tourne pendant l'appel) → `useMutation` sur
  `POST /api/devices/connectivity/refresh`, puis invalidation de `devices-live` ; toast
  d'erreur si l'appel échoue.
- `ConnectivityPills.jsx` (nouveau, `components/shared/`) : deux pastilles
  `USB` / `SSH` — vert ✓, rouge ✗, gris `?` (inconnu / pas encore testé) ; l'infobulle
  (`title`) donne la raison SSH et l'heure du dernier test.
- Partagés entre `/activity-log` et `/devices` : `shared/RefreshConnectivityButton.jsx`
  (le bouton « Revérifier », qui pose la réponse dans le cache `['devices-live']`) et
  `lib/connectivity.js` (`pickConnectivity`, `degradedReason`).
- `DeviceCard.jsx` : pastille de statut `DEGRADED` orange, bordure orange ; affiche
  `ConnectivityPills` ; bloc d'alerte `DEGRADED` qui nomme la cause
  (« Câble USB non détecté » / « SSH injoignable (timeout) »).
- `FleetSummaryBar.jsx` : ajout des tuiles **Degraded** et **Offline**.
- `Devices.jsx` : même rendu que `/activity-log` — `DEGRADED` dans `STATUS_DOT`,
  `statusCounts` et les tuiles ; pastilles + bandeau de cause sur les cartes ; icône Wi-Fi
  pilotée par le test SSH ; bouton « Revérifier ». La fiche reçoit un `liveDevice` séparé
  pour le statut, la connectivité et le run en cours, parce que son formulaire d'édition
  se réinitialise à chaque changement de `device`.
- `VncWall.jsx` (conséquence du statut `OFFLINE` devenu réel) : un téléphone `OFFLINE` à
  l'ouverture du mur, donc exclu de `startWall`, restait sur « Démarrage TrollVNC... »
  une fois revenu. Il est maintenant démarré une fois automatiquement ; Retry et ce
  rattrapage passent la tuile en `FAILED` si take-control échoue.

Pas de framework de test côté dashboard : vérification par `npm run lint`,
`npm run build` et contrôle visuel de `/activity-log` et `/devices`.

## Hors périmètre

- Bloquer le lancement de tâches sur un téléphone `OFFLINE`/`DEGRADED`.
- Corriger le timeout de `SshClient.run` pour ses ~20 autres appelants (doritos,
  mediareceiverd, ipinfo…) : même défaut que ci-dessus, mais le changer peut tuer des
  commandes longues qui passent aujourd'hui ; à traiter à part.
