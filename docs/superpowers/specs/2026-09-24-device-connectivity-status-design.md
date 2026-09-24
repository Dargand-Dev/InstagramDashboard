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
     vers `deviceIp` via `SshClient.run(ip, "true", 12)`, **en parallèle** sur un pool
     dédié de 8 threads (≤ ~10 s par cycle) ; pas d'IP → `ssh=false`,
     `sshError="IP non configurée"` ;
  3. met à jour le cache ; pour chaque device dont `usb` ou `ssh` a changé (ou nouveau),
     publie `DeviceConnectivityChangedEvent(udid)` ;
  4. retire du cache les UDID qui ne sont plus configurés.
- **Un seul test à la fois** : `ReentrantLock`. Le cycle planifié fait `tryLock()` et
  saute son tour si un test tourne déjà. `refreshNow()` fait `lock()` : il attend la fin
  du test en cours, puis relance un test complet (résultat frais garanti).
- `get(udid)` → `Optional<Connectivity>`.
- Raisons SSH (`describeSshFailure(Result)`, statique, testable) :

  | Résultat | `sshError` |
  |---|---|
  | `timedOut()` ou stderr contient `timed out` | `timeout` |
  | stderr contient `Connection refused` | `connexion refusée (sshd arrêté ?)` |
  | stderr contient `No route to host` / `Host is down` | `hôte injoignable` |
  | `exitCode == 5` (sshpass) | `mot de passe refusé` |
  | `exception() != null` | l'exception |
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
- `ConnectivityPills.jsx` (nouveau, `components/activity-log/`) : deux pastilles
  `USB` / `SSH` — vert ✓, rouge ✗, gris `?` (inconnu / pas encore testé) ; l'infobulle
  (`title`) donne la raison SSH et l'heure du dernier test.
- `DeviceCard.jsx` : pastille de statut `DEGRADED` orange, bordure orange ; affiche
  `ConnectivityPills` ; bloc d'alerte `DEGRADED` qui nomme la cause
  (« Câble USB non détecté » / « SSH injoignable (timeout) »).
- `FleetSummaryBar.jsx` : ajout des tuiles **Degraded** et **Offline**.
- `Devices.jsx` : `DEGRADED` dans `STATUS_DOT`, dans `statusCounts` et dans les tuiles
  de résumé, pour que la page Devices reste cohérente.

Pas de framework de test côté dashboard : vérification par `npm run lint`,
`npm run build` et contrôle visuel de `/activity-log`.

## Hors périmètre

- Bloquer le lancement de tâches sur un téléphone `OFFLINE`/`DEGRADED`.
- Hystérésis (exiger deux échecs consécutifs) : à ajouter seulement si on observe des
  clignotements.
