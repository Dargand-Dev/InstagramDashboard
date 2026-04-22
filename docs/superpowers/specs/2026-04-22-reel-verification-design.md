# Vérification Reels post-publication — Design

**Date :** 2026-04-22
**Scope :** cross-project (InstagramScraper + InstagramAutomation + InstagramDashboard)
**Auteur :** brainstorming session

## Objectif

Permettre à l'utilisateur de vérifier, pour tous ses comptes Instagram `ACTIVE` ayant posté un reel dans les dernières heures (6h par défaut, configurable), que le reel est bien **visible publiquement sur Instagram**. Lister les reels manquants (« MISSING ») sur une page dédiée du Dashboard, et relancer automatiquement cette vérification dès qu'un workflow de post se termine pour un device.

Contexte métier : les publications peuvent échouer silencieusement côté Instagram (shadowban, rate-limit plateforme, étape UI mal franchie par l'automation). Savoir rapidement ce qui n'est pas réellement en ligne permet de réagir.

## Critères de succès

- Un bouton « Scanner maintenant » vérifie tous les comptes `ACTIVE` ayant posté dans la fenêtre configurée.
- La vérification déclenche systématiquement un **scrape live** RapidAPI (pas de lecture de cache Mongo) côté Scraper.
- Les reels manquants sont listés sur une page dédiée (username, fichier source, heure de post, âge, statut, action « Re-vérifier »).
- À la fin d'un workflow `PostReelWorkflow` réussi, la vérification du reel publié est déclenchée automatiquement après 60s.
- Le rate-limit scraper existant (50/jour) n'entrave pas l'usage par le bot d'automation.

## Non-objectifs

- Historiser les résultats de scan (un seul état courant par `PostingHistoryEntry`, on écrase à chaque scan).
- Actions de remédiation automatiques (reposter, alerter, etc.). Seule la détection est en scope.
- Couvrir les Stories ou autres types de posts. Uniquement les reels.
- Marquer manuellement une ligne comme « résolu / ignoré » (reporté si besoin exprimé plus tard).

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│  InstagramDashboard (React, :5173)                                │
│  Page /reel-verification                                          │
│   - Select fenêtre (1h / 6h / 24h, défaut 6h)                     │
│   - Bouton [Scanner] → POST scan?hours=N → scanId                 │
│   - Polling GET scan/{scanId} toutes 2s                           │
│   - Liste GET missing?hours=N                                     │
│   - Action « Re-vérifier » par ligne                              │
└──────────────────┬───────────────────────────────────────────────┘
                   │ JWT utilisateur
                   ▼
┌──────────────────────────────────────────────────────────────────┐
│  InstagramAutomation (Spring Boot, :8081)                         │
│                                                                   │
│  ReelVerificationController (4 endpoints REST)                    │
│  ReelVerificationService (orchestration async)                    │
│  ReelMatcher (règle pure — testable)                              │
│  ScanRunRegistry (état en mémoire, TTL 1h)                        │
│  ReelVerificationEventListener (@Async + délai 60s)               │
│  ScraperCheckNowClient (nouveau — force scrape live)              │
│  PostReelWorkflow.onAfterExecute (publie ReelPostedEvent)         │
└──────────────────┬───────────────────────────────────────────────┘
                   │ JWT automation-bot (ROLE_SERVICE)
                   ▼
┌──────────────────────────────────────────────────────────────────┐
│  InstagramScraper (Spring Boot, :8082)                            │
│                                                                   │
│  POST /internal/accounts/by-username/{username}/check-now         │
│    ← NOUVEAU, sur InternalAccountController existant              │
│    (déjà @PreAuthorize("hasRole('SERVICE')"), pas de rate-limit)  │
│  GET  /analytics/.../reels-stats (existant)                       │
│    + ajout du champ shortcode dans ReelStatsResponse              │
│      (le domain Reel a déjà shortcode — DTO + aggregation)        │
└──────────────────────────────────────────────────────────────────┘
```

## Flux d'un scan manuel complet

1. User clique **[Scanner]** avec `hours=N`.
2. `POST /api/automation/reel-verification/scan?hours=N`
   - Le service liste les `PostingHistoryEntry` avec `postedAt > now - N h` (tous les entries en base
     correspondent à un post réussi par construction — `PostingHistoryService.markAsPosted` n'est
     appelé qu'en fin de workflow success, donc pas de filtre `status` à appliquer).
   - Group by `username`, puis filtre sur les comptes `ACTIVE` en faisant
     `accountRepository.findByStatus(ACTIVE)` et en gardant l'intersection des usernames.
     (Pas besoin d'une nouvelle méthode de requête — le volume tient en mémoire.)
   - Crée un `ScanRun{id, status: RUNNING, total, done: 0, errors: 0, missingCount: 0, startedAt}`
     (où `total` = nombre d'usernames à scanner).
   - Lance `@Async runScan(scanId)`.
   - Retourne immédiatement `{scanId, total, startedAt}`.
3. Dans le thread async, **séquentiellement** pour chaque username :
   - `scraperCheckNowClient.checkNow(username)` → force scrape live RapidAPI côté scraper.
   - **Si échec** : 1 retry immédiat. Si le retry échoue aussi → `scanRun.errors++`, on passe au
     username suivant **sans** modifier les entries (pas de faux positif MISSING).
   - `scraperStatsClient.fetchReelsStats(username)` → récupère `ScraperAccountReelsStats`
     (enveloppe `{username, generatedAt, reels}`). On lit `.reels()` pour la comparaison.
   - Pour chaque `PostingHistoryEntry` du username dans la fenêtre, appliquer `ReelMatcher.match()`.
   - Persister `verificationStatus`, `verifiedAt`, `matchedShortcode` sur chaque entry.
   - Incrémenter `scanRun.done` ; si MISSING, `scanRun.missingCount++`.
4. Fin : `scanRun.status = COMPLETED` (ou `FAILED` si exception non gérée globale), `finishedAt = now`.
5. Front poll `GET /scan/{scanId}` toutes 2s, arrête le polling quand `status != RUNNING`, puis
   invalide `['reel-verification/missing']`.

> **Note sur la rétention** : `PostingHistoryService.markAsPosted` cappe l'historique à
> **14 entries par compte** (trim des plus anciens). Pour un compte très actif, un entry MISSING
> peut être supprimé avant même qu'on le voit sur la page. Mitigation : le scan ne tolère pas
> cette perte silencieuse car la page se base sur un `GET /missing?hours=N` qui lit la base
> courante. Si le reel a été trimmé, il sort simplement de la liste. Pour les profils très
> volubiles, envisager de relever le cap à 30+ dans un suivi ultérieur (hors scope).

### Règle de matching

```
match(entry, scraperReels, alreadyConsumed):
  candidats = [r ∈ scraperReels
               tels que r ∉ alreadyConsumed
                     ∧ r.publishedAt ≥ entry.postedAt - 5 min
                     ∧ r.publishedAt ≤ entry.postedAt + 30 min]
  si candidats vide  → MISSING (pas de matchedShortcode)
  sinon              → VERIFIED, on prend r* le plus proche de entry.postedAt
                       alreadyConsumed.add(r*)
                       matchedShortcode = r*.shortcode
```

Fenêtre asymétrique **-5min / +30min** :
- -5min : couvre les décalages d'horloge serveur.
- +30min : couvre le délai de queue Instagram et de propagation RapidAPI.

Ordre de traitement des entries pour un username : par `postedAt` ascendant, afin que chaque reel scraper ne soit consommé qu'une seule fois (le plus ancien entry a la priorité).

## Déclencheur fin-de-workflow

**Problème résolu ici** : `PostingHistoryService.markAsPosted(...)` est actuellement `void` et ne
surface pas l'entry persisté. Deux options :

- **a) Modifier `markAsPosted` pour retourner `PostingHistoryEntry`** (le builder construit déjà
  l'entry, il suffit de `return postingHistoryRepository.save(entry);`). Propagation aux callers
  existants (ignorent la valeur de retour). **Approche retenue** — 1 ligne de changement.
- b) Lookup dans le listener par `(username, baseVideo, postedAt)`. Risque de race avec le trim
  à 14 entries qui tourne dans la même section `synchronized`. Rejetée.

```
PostReelWorkflow.onAfterExecute(ctx, result):
   si result.stepResults contient un "PostReel" step avec isSuccess() == true :
      try :
        // markAsPosted retourne désormais l'entry persisté (changement mineur).
        PostingHistoryEntry entry = postingHistoryService.markAsPosted(...);
        applicationEventPublisher.publishEvent(
            new ReelPostedEvent(entry.getUsername(), entry.getId(), entry.getPostedAt()));
      catch (Exception ex) :
        log.warn("Publication ReelPostedEvent échouée — {}", ex.getMessage());
        // Ne JAMAIS faire échouer le workflow à cause de la vérif.

ReelVerificationEventListener:
   @Async @EventListener
   onReelPosted(event):
      taskScheduler.schedule(
          () -> reelVerificationService.verifyOneEntry(event.postingHistoryEntryId()),
          Instant.now().plusSeconds(60))
```

Le délai 60s laisse à Instagram / RapidAPI le temps d'exposer le reel nouvellement publié. Sans
ce délai, on aurait quasi-systématiquement des faux négatifs.

> **Note :** `@EnableAsync` est déjà activé via `ReelStatsAsyncConfig`. Réutiliser un executor
> existant si dispo, sinon ajouter un bean dédié `reelVerificationExecutor` dans ce même config.

## Flux « re-check » d'une ligne

```
POST /api/automation/reel-verification/recheck body={entryId}
  → reelVerificationService.verifyOneEntry(entryId)
  → check-now + fetchReels + match (en synchrone, ~3s)
  → entry.verificationStatus / verifiedAt / matchedShortcode mis à jour
  → 200 avec l'entry modifié
```

Synchrone car une seule ligne — pas de polling nécessaire. Le front invalide la query `['missing']` pour retirer la ligne de la liste si elle est maintenant `VERIFIED`.

## Schéma de données

### Modifications sur `PostingHistoryEntry` (Automation)

Champs existants actuels : `{id, username, baseVideo, postedAt, template, driveFilename}`
(pas de champ `status` — chaque entry représente déjà un post réussi car créé uniquement par
`markAsPosted` en fin de workflow success).

```java
@Document(collection = "posting_history")
public class PostingHistoryEntry {
  // champs existants inchangés : id, username, baseVideo, postedAt, template, driveFilename

  // NOUVEAU
  private VerificationStatus verificationStatus; // NOT_CHECKED | VERIFIED | MISSING
  private LocalDateTime      verifiedAt;         // nullable
  private String             matchedShortcode;   // nullable, set si VERIFIED
}

public enum VerificationStatus { NOT_CHECKED, VERIFIED, MISSING }
```

Les entries existants en base démarrent avec `verificationStatus = null` → interprété comme `NOT_CHECKED`. Ils n'apparaissent jamais sur la page (filtre front ne montre que `MISSING`). Pas de migration nécessaire.

### Nouveau DTO `ScanRun` (Automation, en mémoire)

```java
public record ScanRun(
    UUID id,
    ScanStatus status,        // RUNNING | COMPLETED | FAILED
    int total,
    int done,
    int errors,
    int missingCount,
    Instant startedAt,
    Instant finishedAt,       // nullable
    String error              // nullable, message si FAILED
) {}
```

Pas de persistance. `ScanRunRegistry` = `ConcurrentHashMap<UUID, ScanRun>` + `AtomicReference<UUID> currentRunning`. TTL via `@Scheduled(fixedRate=10min)` → supprime les runs terminés depuis >1h. Si l'app redémarre en plein scan, le scan est perdu côté registre — les entries déjà vérifiées gardent leur statut en base, c'est acceptable.

### Nouveau `ReelPostedEvent`

```java
public record ReelPostedEvent(
    String username,
    String postingHistoryEntryId,
    LocalDateTime postedAt
) {}
```

## API REST (contrats)

**Automation** — nouveaux endpoints, auth JWT utilisateur :

```
POST /api/automation/reel-verification/scan?hours=N
  200 : { scanId: UUID, total: int, startedAt: ISO-8601 }

GET  /api/automation/reel-verification/scan/{scanId}
  200 : { scanId, status, total, done, errors, missingCount,
          startedAt, finishedAt?, error? }
  404 : scan inconnu ou expiré

GET  /api/automation/reel-verification/missing?hours=N
  200 : [ { entryId, username, baseVideo, postedAt,
            verificationStatus, verifiedAt, matchedShortcode, device? } ]

POST /api/automation/reel-verification/recheck
  body : { entryId: string }
  200  : { entryId, verificationStatus, verifiedAt, matchedShortcode }
  404  : entryId inconnu
```

**Concurrence** : `startScan` ne démarre jamais deux scans en parallèle. Si `currentRunning != null` et son status = RUNNING → retourne le scanId existant (pas d'erreur, idempotent).

**Scraper** — modifications :

```
POST /internal/accounts/by-username/{username}/check-now   ← NOUVEAU
  Ajouté sur InternalAccountController existant.
  Déjà guardé par @PreAuthorize("hasRole('SERVICE')") au niveau classe,
  donc pas besoin de rate-limit bypass ad-hoc : le limiter n'est pas
  invoqué sur cet endpoint (on ne copie pas la ligne CheckNowRateLimiter
  depuis AccountController.checkNow).
  Lookup username → InstagramAccount via accountRepository.findByUsername(),
  puis délègue à scraperService.processOne(account, SnapshotSource.MANUAL)
  (même code path que AccountController.checkNow by-id existant).
  200 : retourne CheckNowResponse existant
        { success, durationMs, reelsTouched, reelsSkipped, error }
  404 : username inconnu côté scraper

GET /analytics/account/by-username/{username}/reels-stats  (existant)
  + champ shortcode ajouté au DTO ReelStatsResponse
  (le domain Reel a déjà le shortcode persisté ; il faut juste le
  propager dans la projection d'aggregation
  ReelStatsAggregationRepository.findReelsWithLatestViewsByAccountId
  utilisée par AnalyticsQueryService.reelsStatsByUsername, et l'ajouter
  au DTO ReelStatsResponse)
```

## Composants (par projet)

### InstagramScraper

**Modifiés :**

- `web/controller/InternalAccountController.java` : ajout méthode `checkNowByUsername(username)`.
  Lookup via `accountRepository.findByUsername()`, délègue à `scraperService.processOne(id)`.
  Hérite du `@PreAuthorize("hasRole('SERVICE')")` au niveau classe.
  **Pas de rate-limit** — on ne ré-injecte pas `CheckNowRateLimiter` sur cet endpoint.
- `web/dto/ReelStatsResponse.java` : ajout champ `shortcode`.
- `repository/ReelStatsAggregationRepository.java` : la projection
  `findReelsWithLatestViewsByAccountId` doit surfacer `shortcode` (`$project`).
- `service/analytics/AnalyticsQueryService.reelsStatsByUsername` : propagation du champ dans
  le mapper vers le DTO.

### InstagramAutomation

**Nouveaux :**

```
src/main/java/com/automation/instagram/
├── event/
│   └── ReelPostedEvent.java
├── service/reelverification/
│   ├── ReelVerificationService.java
│   ├── ReelMatcher.java                         (logique pure, testable en unit)
│   ├── ScanRun.java + ScanStatus.java
│   ├── ScanRunRegistry.java                     (@Component, TTL scheduled)
│   ├── ReelVerificationEventListener.java       (@Async, TaskScheduler 60s)
│   └── scraper/
│       └── ScraperCheckNowClient.java           (HTTP POST + auth JWT reuse)
├── controller/
│   └── ReelVerificationController.java
└── dto/reelverification/                        (request / response records)
    ├── ScanStartResponse.java
    ├── ScanRunSnapshot.java
    ├── MissingReelView.java
    └── RecheckRequest.java
```

**Modifiés :**

- `model/mongo/PostingHistoryEntry.java` : +3 champs (`verificationStatus`, `verifiedAt`,
  `matchedShortcode`) + enum `VerificationStatus`.
- `repository/PostingHistoryRepository.java` : +1 méthode de requête
  `findByPostedAtAfter(LocalDateTime)` (on récupère tous les posts récents, puis filtrage
  par usernames ACTIVE en mémoire).
- `content/service/PostingHistoryService.java` : `markAsPosted(...)` change sa signature de
  `void` → `PostingHistoryEntry` (retourne l'entry persisté). Les callers actuels ignorent
  la valeur de retour.
- `workflow/impl/PostReelWorkflow.java` `onAfterExecute()` : récupérer l'entry retourné par
  `markAsPosted` et publier `ReelPostedEvent(username, entry.id, postedAt)` en try/catch.
- `service/reelstats/scraper/ScraperReelStatsDto.java` : ajouter le champ `shortcode` pour
  matcher le DTO enrichi côté scraper.
- `config/ReelStatsAsyncConfig.java` (existant) : réutiliser l'executor déjà défini, ou
  ajouter un bean `reelVerificationExecutor` à côté si on veut isoler.

### InstagramDashboard

**Nouveaux :**

- `src/pages/ReelVerification.jsx` : page principale.
- `src/hooks/useReelVerification.js` : hooks React Query (`useStartScan`, `useScanStatus(scanId)`, `useMissingReels(hours)`, `useRecheckOne`).

**Modifiés :**

- `src/App.jsx` : import lazy + route `/reel-verification`.
- `src/components/layout/AppLayout.jsx` : ajout d'une entrée dans la section `MONITORING`
  de `NAV_SECTIONS` (qui est un `Array` de `{label, items}`). Entrée :
  `{ path: '/reel-verification', label: 'Vérification Reels', icon: ShieldCheck }`. Placée
  dans `MONITORING` car c'est une fonctionnalité de health / observation post-publication
  (plutôt qu'une opération d'automation).

**Composants partagés réutilisés :** `DataTable`, `StatusBadge` (ou `Badge` direct pour `MISSING`), `EmptyState`, `TimeAgo`, `Card`, `Button`, `Skeleton`.

## Gestion d'erreurs

| Où | Cas | Comportement |
|---|---|---|
| Scraper `check-now` 5xx / timeout | **1 retry immédiat**, si échec de nouveau → `scanRun.errors++`, entries **non modifiés**, on continue les autres usernames |
| Scraper `check-now` 404 (compte IG inexistant / privé) | entries marqués `MISSING` (légitime) |
| Scraper injoignable (connect refused) | même comportement que 5xx (retry × 1, puis skip) |
| JWT `automation-bot` expiré | `RawScraperStatsClient` retry-once-on-401 existant s'active ; si échec persistant → scan entier en `FAILED` |
| `startScan` pendant un scan en cours | retourne le scanId existant (idempotent) |
| `ScanRun` expiré (>1h après finish) | `GET /scan/{id}` retourne 404 → front affiche toast « Scan expiré » |
| `PostingHistoryEntry` aucun dans la fenêtre | `startScan` retourne `{scanId, total: 0}` → status immédiat `COMPLETED` |
| Erreur dans `onAfterExecute` (event publisher) | try/catch + log, le workflow de post **ne doit jamais échouer** à cause de ça |
| Erreur dans listener @Async (après 60s) | try/catch global, log ERROR, silencieux |
| Dashboard : 423 (lock) sur n'importe quel endpoint | `src/lib/api.js` retourne déjà `{locked: true, ...}` ; le front affiche un toast « Verrouillé » et ne re-tente pas. `startScan` lui-même n'émet pas de 423 (pas de lock distribué côté backend pour ce scan). Laissé pour la cohérence du wrapping API. |
| Dashboard : 404 polling scan | stoppe polling, toast « Scan expiré », reset scanId local |
| Dashboard : erreur réseau polling | React Query retry × 3 par défaut, puis stoppe |

**Règle cardinale :** on ne déclare **MISSING** que si le scraper a répondu avec succès ET qu'aucun reel ne matche. Un reel peut rester dans son état précédent si le scraper est en panne — ça évite les faux positifs qui feraient paniquer l'utilisateur pour rien.

## Tests

**Scraper :**
- Intégration `check-now by-username` : 200 avec ROLE_SERVICE, bypass rate-limit confirmé. 404 username inconnu.
- Test sérialisation : `shortcode` présent dans `ReelStatsResponse`.

**Automation — prioritaire :**
- **Unit `ReelMatcher`** : 6 cas (match dans fenêtre, hors fenêtre haute, hors fenêtre basse, multiple candidats → plus proche, reel déjà consommé, scraper vide).
- **Unit `ReelVerificationService`** avec mocks `ScraperCheckNowClient` + `RawScraperStatsClient` : vérifier l'ordre (check-now avant fetch-reels), la persistance des entries, le retry × 1 sur échec, la non-propagation des erreurs d'un compte aux autres.
- **Intégration `ReelVerificationController`** via `MockMvc` : shapes des 4 endpoints, code 404 si scanId inconnu, idempotence de `startScan`.
- **Intégration listener** : publier `ReelPostedEvent` → vérifier avec `awaitility` que `verifyOneEntry` est appelé après ~60s (ou `TaskScheduler` mocké).

**Dashboard :** pas de framework de test (CLAUDE.md). Test manuel :
1. Page vide sans reels récents → EmptyState visible.
2. Scan avec reels récents → barre de progression → liste remplie si MISSING.
3. Re-vérifier une ligne → disparition si trouvée, `verifiedAt` à jour sinon.

## Observabilité

Logs en français (convention du repo) :

- `log.info("Scan vérification démarré — scanId={}, fenêtre={}h, comptes={}", …)`
- `log.info("Compte {} : check-now OK, {} reels récupérés", …)`
- `log.warn("Compte {} : scraper KO après retry, scan ignoré — {}", …)`
- `log.info("Reel MISSING détecté — username={}, postedAt={}, entryId={}", …)`
- `log.info("Scan terminé — scanId={}, verified={}, missing={}, errors={}", …)`

## Risques & points ouverts

- **Propagation Instagram / RapidAPI** : le délai 60s sur le trigger post-workflow est une
  estimation. Si des faux négatifs apparaissent systématiquement sur le déclencheur auto,
  augmenter à 120s ou rendre configurable.
- **Espacement des posts** : la règle de matching à ±30min fait l'hypothèse qu'on ne poste
  pas 2 reels sur le même compte dans une fenêtre de 30min. À confirmer avec les intervalles
  réels de l'automation. L'ordre de consommation greedy (`postedAt` ascendant pour les entries,
  `publishedAt` ascendant pour les reels) peut mal résoudre l'attribution en cas de drift
  d'horloge. Risque accepté.
- **Quota RapidAPI** : retirer le rate-limit `CheckNowRateLimiter` du chemin `by-username`
  ne retire PAS la limite RapidAPI elle-même. Si l'automation pilote des dizaines de comptes
  et scanne souvent, on peut épuiser le quota mensuel RapidAPI. À monitorer.
- **Rétention 14 entries** : `PostingHistoryService.markAsPosted` trim à 14 entries par
  compte. Un compte postant plus de 14 fois sur 6h verrait ses premiers reels disparaître
  avant d'apparaître sur la page. Hors scope, mais à garder en tête si l'usage monte.
- **Concurrence scan manuel + trigger auto** : un `verifyOneEntry` déclenché par un workflow
  qui finit pendant un scan global manuel va écraser/être écrasé sur la même entry. C'est
  acceptable (dernier gagne, les deux produisent le même résultat), mais à garder à l'esprit.
- **Changement de signature `markAsPosted`** : le passage de `void` à `PostingHistoryEntry`
  est backward-compatible (callers Java ignorent la valeur de retour sans erreur de compilation).
  Pas de risque.
