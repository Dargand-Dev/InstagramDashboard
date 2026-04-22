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
│  POST /accounts/by-username/{username}/check-now  ← NOUVEAU       │
│    + bypass rate-limit pour ROLE_SERVICE                          │
│  GET  /analytics/.../reels-stats (existant)                       │
│    + ajout du champ shortcode au DTO ReelStatsResponse            │
└──────────────────────────────────────────────────────────────────┘
```

## Flux d'un scan manuel complet

1. User clique **[Scanner]** avec `hours=N`.
2. `POST /api/automation/reel-verification/scan?hours=N`
   - Le service liste les `PostingHistoryEntry` avec `postedAt > now - N h` et `status = SUCCESS`.
   - Filtre par comptes `ACTIVE` (jointure sur `username` avec `AccountRepository.findByUsernameInAndStatus`).
   - Group by `username` pour limiter les appels scraper à 1 par compte (même si plusieurs entries dans la fenêtre).
   - Crée un `ScanRun{id, status: RUNNING, total, done: 0, errors: 0, missingCount: 0, startedAt}`.
   - Lance `@Async runScan(scanId)`.
   - Retourne immédiatement `{scanId, total, startedAt}`.
3. Dans le thread async, **séquentiellement** pour chaque username :
   - `ScraperCheckNowClient.checkNow(username)` → force scrape live RapidAPI.
   - **Si échec** : 1 retry immédiat. Si le retry échoue aussi → `scanRun.errors++`, on passe au username suivant **sans** modifier les entries (pas de faux positif MISSING).
   - `RawScraperStatsClient.fetchReels(username)` → récupère les reels du profil (publishedAt + shortcode).
   - Pour chaque `PostingHistoryEntry` du username dans la fenêtre, appliquer `ReelMatcher.match()`.
   - Persister `verificationStatus`, `verifiedAt`, `matchedShortcode` sur chaque entry.
   - Incrémenter `scanRun.done` ; si MISSING, `scanRun.missingCount++`.
4. Fin : `scanRun.status = COMPLETED` (ou `FAILED` si exception non gérée globale), `finishedAt = now`.
5. Front poll `GET /scan/{scanId}` toutes 2s, arrête le polling quand `status != RUNNING`, puis invalide `['reel-verification/missing']`.

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

```
PostReelWorkflow.onAfterExecute(ctx, result):
   si result.stepResults contient "PostReel" avec isSuccess() == true :
      try:
        applicationEventPublisher.publishEvent(
            new ReelPostedEvent(username, postingHistoryEntryId, postedAt))
      catch (Exception) :
        log.warn("Publication ReelPostedEvent échouée — {}", ex)
        // Ne JAMAIS faire échouer le workflow à cause de la vérif.

ReelVerificationEventListener:
   @Async @EventListener
   onReelPosted(event):
      taskScheduler.schedule(
          () -> verifyOneEntry(event.postingHistoryEntryId),
          Instant.now().plusSeconds(60))
```

Le délai 60s laisse à Instagram / RapidAPI le temps d'exposer le reel nouvellement publié. Sans ce délai, on aurait quasi-systématiquement des faux négatifs.

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

```java
@Document(collection = "posting_history")
public class PostingHistoryEntry {
  // champs existants inchangés : id, username, baseVideo, postedAt, status, ...

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
POST /accounts/by-username/{username}/check-now   ← NOUVEAU
  @PreAuthorize : ROLE_SERVICE ou ROLE_ADMIN
  Lookup username → accountId, délègue à ScraperService.processOne()
  200 : { username, reelsTouched, reelsSkipped }
  404 : username inconnu
  (bypass du rate-limit 50/jour pour ROLE_SERVICE)

GET /analytics/account/by-username/{username}/reels-stats  (existant)
  + champ shortcode ajouté au DTO ReelStatsResponse
```

## Composants (par projet)

### InstagramScraper

**Modifiés :**

- `AccountController.java` ou nouveau `ServiceBotController.java` : ajout endpoint `check-now by-username`.
- Intercepteur rate-limit : bypass pour `ROLE_SERVICE`.
- `ReelStatsResponse` DTO : ajout `shortcode`.

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

- `model/mongo/PostingHistoryEntry.java` : +3 champs (`verificationStatus`, `verifiedAt`, `matchedShortcode`) + enum `VerificationStatus`.
- `repository/PostingHistoryRepository.java` : +2 méthodes de requête (`findByPostedAtAfterAndStatus`, `findByUsernameInAndPostedAtAfter`).
- `workflow/impl/PostReelWorkflow.java` `onAfterExecute()` : publier `ReelPostedEvent` en try/catch.
- `config/AsyncConfig.java` (créer si absent) : `@EnableAsync`, bean `TaskScheduler`.

### InstagramDashboard

**Nouveaux :**

- `src/pages/ReelVerification.jsx` : page principale.
- `src/hooks/useReelVerification.js` : hooks React Query (`useStartScan`, `useScanStatus(scanId)`, `useMissingReels(hours)`, `useRecheckOne`).

**Modifiés :**

- `src/App.jsx` : import lazy + route `/reel-verification`.
- `src/components/layout/AppLayout.jsx` : entrée dans `NAV_SECTIONS["AUTOMATION"]`, icône `ShieldCheck`, label « Vérification Reels ».

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
| Dashboard : 423 (lock) sur `startScan` | toast « Système verrouillé, réessayer plus tard » |
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

- **Propagation Instagram / RapidAPI** : le délai 60s sur le trigger post-workflow est une estimation. Si des faux négatifs apparaissent systématiquement sur le déclencheur auto, augmenter à 120s ou rendre configurable.
- **Espacement des posts** : la règle de matching à ±30min fait l'hypothèse qu'on ne poste pas 2 reels sur le même compte dans une fenêtre de 30min. À confirmer avec les intervalles réels de l'automation.
- **Quota RapidAPI** : retirer le rate-limit pour `automation-bot` côté scraper ne retire PAS la limite RapidAPI elle-même. Si l'automation pilote des dizaines de comptes et scanne souvent, on peut épuiser le quota mensuel RapidAPI. À monitorer.
- **Concurrence scan manuel + trigger auto** : un `verifyOneEntry` déclenché par un workflow qui finit pendant un scan global manuel va écraser/être écrasé sur la même entry. C'est acceptable (dernier gagne, les deux produisent le même résultat), mais à garder à l'esprit.
