# Vérification Reels post-publication — Plan d'implémentation

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter une page « Vérification Reels » au Dashboard qui scanne les comptes ACTIVE ayant posté un reel récemment, force un scrape live côté InstagramScraper via l'API RapidAPI, et liste les reels que l'automation croit avoir publiés mais qui ne sont pas visibles sur Instagram. La vérification est aussi déclenchée automatiquement 60s après la fin d'un workflow `PostReelWorkflow` réussi.

**Architecture:** Le Dashboard appelle de nouveaux endpoints REST côté InstagramAutomation (port 8081). Automation orchestre le scan (async), appelle l'endpoint existant `/internal/accounts/by-username/{username}/check-now` (nouveau — posé sur `InternalAccountController` du Scraper) pour forcer un scrape live, puis lit `/analytics/account/by-username/{username}/reels-stats` (enrichi avec `shortcode`) pour comparer avec la collection `posting_history` locale. Le statut de vérification (`VERIFIED` / `MISSING`) est écrit sur chaque `PostingHistoryEntry`. Un `ApplicationEvent` publié depuis `PostReelWorkflow.onAfterExecute` déclenche une vérification unitaire 60s plus tard pour chaque reel fraîchement posté.

**Tech Stack:** Spring Boot 3.3/3.4 + Java 17/21 + MongoDB + Maven (backends), React 19 + JSX + Vite + React Query + Tailwind 4 + shadcn/ui (frontend).

**Spec de référence:** `docs/superpowers/specs/2026-04-22-reel-verification-design.md`

**Répertoires de travail:**
- Scraper : `/Users/samyhne/IG-bot/InstagramScraper/`
- Automation : `/Users/samyhne/IG-bot/InstagramAutomation/`
- Dashboard : `/Users/samyhne/IG-bot/InstagramDashboard/`

**Conventions rappel (cf. CLAUDE.md racine):**
- Code en anglais, **commentaires + logs en français**.
- Tester avec `./mvnw test -Dtest=…` côté Spring. Tests Dashboard : manuels (pas de framework configuré).
- Backends sur 8081 (Automation) et 8082 (Scraper) — déjà running en local pour test.

---

## Chunk 1 : Scraper — endpoint check-now by-username + shortcode dans reels-stats

### Task 1.1 — Ajouter `shortcode` dans `ReelStatsResponse` et sa projection d'aggregation

**Context:** `AnalyticsQueryService.reelsStatsByUsername` récupère les reels récents d'un compte avec leur `publishedAt` et `viewsCount`. L'Automation a besoin en plus du `shortcode` (identifiant `instagram.com/reel/{shortcode}`) pour stocker le lien du reel matché. Le domaine `Reel` a déjà `shortcode` persisté — il faut juste le propager dans le DTO et dans le pipeline d'aggregation Mongo.

**Files:**
- Modify: `InstagramScraper/src/main/java/com/dargand/igscraper/web/dto/ReelStatsResponse.java`
- Modify: `InstagramScraper/src/main/java/com/dargand/igscraper/repository/ReelStatsAggregationRepository.java` — le pipeline d'aggregation (`$project` à la ligne ~115) ET le mapper `toDto(Document)` à la ligne ~129 (qui construit le record).
- Test: `InstagramScraper/src/test/java/com/dargand/igscraper/web/AccountReelsStatsTest.java` (test live existant à étendre, convention du projet : tests controller vivent dans `src/test/java/com/dargand/igscraper/web/` **sans** sous-dossier `controller/`).

> **Note** : `AnalyticsQueryService.reelsStatsByUsername` ne nécessite **aucune** modification : il délègue à `repository.findReelsWithLatestViewsByAccountId(...)` qui retourne déjà des `ReelStatsResponse`. Toute la transformation Document→DTO se fait dans `toDto(Document)` du repository. Le domain `Reel.shortcode` est déjà persisté (cf. `Reel.java:34`) — pas de migration, juste le projeter et le mapper.

- [ ] **Step 1 : Lire les 3 fichiers pour comprendre la forme actuelle**

Run:
```bash
cd /Users/samyhne/IG-bot/InstagramScraper
cat src/main/java/com/dargand/igscraper/web/dto/ReelStatsResponse.java
cat src/main/java/com/dargand/igscraper/repository/ReelStatsAggregationRepository.java
grep -n "reelsStatsByUsername" src/main/java/com/dargand/igscraper/service/analytics/AnalyticsQueryService.java
```
Expected: identifier précisément le `$project` de l'aggregation qui oublie `shortcode` et le mapper qui construit le `ReelStatsResponse`.

- [ ] **Step 2 : Écrire un test qui vérifie que `reelsStatsByUsername` renvoie `shortcode` non-null**

Ajouter un cas dans `AccountReelsStatsTest.java` (test `@SpringBootTest` existant, convention du projet) qui insère un `Reel` en base avec un `shortcode` connu + un `ReelSnapshot`, appelle l'endpoint `/analytics/account/by-username/{username}/reels-stats` et asserte que le champ `shortcode` du premier reel retourné est présent. Exemple de cas :
```java
@Test
@WithMockUser(roles = "SERVICE")
void reelsStatsByUsername_surfaceShortcode() throws Exception {
    // Given: un InstagramAccount + un Reel {shortcode="ABC123", publishedAt=now} + 1 snapshot
    // When: GET /analytics/account/by-username/user1/reels-stats
    // Then: response.reels[0].shortcode == "ABC123"
    mockMvc.perform(get("/analytics/account/by-username/user1/reels-stats"))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$.reels[0].shortcode").value("ABC123"));
}
```
Suivre la convention exacte d'`AccountReelsStatsTest` pour la mise en place des fixtures Mongo.

- [ ] **Step 3 : Run le test — doit échouer car `shortcode` absent du DTO**

Run:
```bash
./mvnw -pl . test -Dtest=AnalyticsQueryServiceTest#reelsStatsByUsername_surfaceShortcode
```
Expected: FAIL — `cannot find symbol: shortcode()` ou assertion mismatch.

- [ ] **Step 4 : Ajouter le champ `shortcode` au record `ReelStatsResponse`**

Modification attendue (ordre des champs : mettre `shortcode` juste après `publishedAt` ou `reelId` selon l'existant) :
```java
public record ReelStatsResponse(
    // ... champs existants ...
    Instant publishedAt,
    String shortcode,   // NOUVEAU
    Long viewsCount
) {}
```

- [ ] **Step 5 : Ajouter `shortcode` dans la projection de l'aggregation**

Dans `ReelStatsAggregationRepository.findReelsWithLatestViewsByAccountId`, étendre le bloc `Aggregation.project()` (ligne ~115) :
```java
Aggregation.project()
        .and("reel.publishedAt").as("publishedAt")
        .and("reel.shortcode").as("shortcode")   // NOUVEAU
        .and("latestViewsCount").as("viewsCount"),
```

- [ ] **Step 6 : Étendre le mapper `toDto(Document)` dans le même fichier**

La construction du record se fait dans `toDto(Document)` à la ligne ~129. Ajouter l'extraction du shortcode (String, null-safe) et le passer au constructeur :
```java
private static ReelStatsResponse toDto(Document doc) {
    // ... code existant pour publishedAt et viewsCount (inchangé) ...

    String shortcode = doc.getString("shortcode");  // NOUVEAU, null-safe
    return new ReelStatsResponse(publishedAt, shortcode, viewsCount);
}
```
L'ordre des arguments du constructeur doit matcher l'ordre déclaré du record modifié au Step 4.

- [ ] **Step 7 : Run le test — doit passer**

Run:
```bash
./mvnw -pl . test -Dtest=AnalyticsQueryServiceTest#reelsStatsByUsername_surfaceShortcode
```
Expected: PASS.

- [ ] **Step 8 : Run tous les tests pour confirmer non-régression**

Run:
```bash
./mvnw test
```
Expected: PASS. En particulier les tests existants d'`AnalyticsController` et `AnalyticsQueryService` ne doivent pas casser (l'ajout d'un champ au record est additif).

- [ ] **Step 9 : Commit**

```bash
cd /Users/samyhne/IG-bot/InstagramScraper
git add src/main/java/com/dargand/igscraper/web/dto/ReelStatsResponse.java \
        src/main/java/com/dargand/igscraper/repository/ReelStatsAggregationRepository.java \
        src/test/java/com/dargand/igscraper/web/AccountReelsStatsTest.java
git commit -m "feat(analytics): expose shortcode in reels-stats response"
```

---

### Task 1.2 — Ajouter endpoint `POST /internal/accounts/by-username/{username}/check-now`

**Context:** L'Automation doit pouvoir forcer un scrape live RapidAPI d'un compte en appelant un endpoint identifié par **username** (pas par id interne, car elle ne connaît pas l'id du compte côté Scraper). `InternalAccountController` est déjà guardé au niveau classe par `@PreAuthorize("hasRole('SERVICE')")` et utilise déjà le pattern `/by-username/{username}` pour d'autres opérations. On pose donc le nouvel endpoint ici, sans rate-limit (le `CheckNowRateLimiter` présent sur `AccountController.checkNow` n'est PAS copié : la règle "pas de limite pour l'automation" est réalisée par non-application du limiter, pas par un bypass conditionnel).

**Files:**
- Modify: `InstagramScraper/src/main/java/com/dargand/igscraper/web/controller/InternalAccountController.java`
- Test: `InstagramScraper/src/test/java/com/dargand/igscraper/web/InternalAccountControllerTest.java` — **flat dans `web/`, PAS de sous-dossier `controller/`** (convention du projet : les tests controller vivent directement sous `src/test/java/com/dargand/igscraper/web/`, cf. `AccountFlowTest.java`, `InternalUserControllerTest.java`, etc.).

- [ ] **Step 1 : Vérifier la forme des tests controller existants**

Run:
```bash
cd /Users/samyhne/IG-bot/InstagramScraper
ls src/test/java/com/dargand/igscraper/web/
grep -l "MockMvc\|WebMvcTest\|SpringBootTest" src/test/java/com/dargand/igscraper/web/*.java | head -3
```
But: identifier la convention (`@SpringBootTest` + `MockMvc` est dominante dans ce projet — voir `AccountFlowTest`, `InternalUserControllerTest`). Adopter la même pour le nouveau test.

- [ ] **Step 2 : Écrire un test d'intégration `checkNowByUsername_returnsCheckNowResponse`**

Créer le test avec 3 cas (suivre la convention trouvée au step 1) :
1. `ROLE_SERVICE` + username existant → 200 avec body `CheckNowResponse{success=true, …}`.
2. `ROLE_SERVICE` + username inexistant → 404.
3. `ROLE_USER` (pas SERVICE) → 403.

Gabarit :
```java
@Test
@WithMockUser(roles = "SERVICE")
void checkNowByUsername_whenUsernameExists_returns200() throws Exception {
    // given : un compte persisté avec username="user1"
    // when : POST /internal/accounts/by-username/user1/check-now
    // then : 200, body.success==true
}

@Test
@WithMockUser(roles = "SERVICE")
void checkNowByUsername_whenUsernameMissing_returns404() throws Exception { /* ... */ }

@Test
@WithMockUser(roles = "USER")
void checkNowByUsername_whenNotService_returns403() throws Exception { /* ... */ }
```

Pour le mock de `ScraperService.processOne`, l'injecter via `@MockBean` et stubber avec le **factory** existant (le record a 7 champs — `(ObjectId accountId, String username, boolean success, long durationMs, int reelsTouched, int reelsSkipped, String error)` — utiliser le helper pour éviter les pièges) :
```java
when(scraperService.processOne(any(), eq(SnapshotSource.MANUAL)))
    .thenReturn(ScrapeOutcome.success(new ObjectId(), "user1", 100L, 2, 0));
```

> `@MockBean` est deprecated dans Spring Boot 3.4+. Si le projet convention (vérifiée au Step 1) utilise `@MockitoBean` ou injecte les mocks différemment, adopter la convention observée. Le gabarit ci-dessus est illustratif.

- [ ] **Step 3 : Run le test — échec attendu (endpoint non implémenté)**

Run:
```bash
./mvnw test -Dtest=InternalAccountControllerTest
```
Expected: FAIL — 404 sur le POST car la route n'existe pas encore.

- [ ] **Step 4 : Implémenter l'endpoint dans `InternalAccountController`**

Ajouter les imports nécessaires (`ScraperService`, `ScrapeOutcome`, `SnapshotSource`, `CheckNowResponse`, `InstagramAccountRepository`, `NoSuchElementException`), déclarer les nouveaux champs via `@RequiredArgsConstructor` (Lombok génère le constructor), puis ajouter :

```java
private final InstagramAccountRepository accountRepository;
private final ScraperService scraperService;

/**
 * Endpoint SERVICE-to-SERVICE : force un scrape live RapidAPI d'un compte.
 * Utilisé par InstagramAutomation pour vérifier qu'un reel fraîchement publié
 * est bien visible sur Instagram (délai de propagation RapidAPI).
 *
 * Pas de rate-limit ici (contrairement à AccountController.checkNow USER-scoped
 * qui protège le quota via CheckNowRateLimiter). Le ROLE_SERVICE est de confiance
 * et ne pilote qu'un nombre borné de vérifications (dépendant du volume de posts).
 */
@PostMapping("/by-username/{username}/check-now")
public ResponseEntity<CheckNowResponse> checkNowByUsername(@PathVariable String username) {
    InstagramAccount account = accountRepository.findByUsername(username)
            .orElseThrow(() -> new NoSuchElementException("Compte inconnu : " + username));
    ScrapeOutcome outcome = scraperService.processOne(account, SnapshotSource.MANUAL);
    log.info("[internal] check-now username='{}' → success={}, reelsTouched={}, durationMs={}",
            username, outcome.success(), outcome.reelsTouched(), outcome.durationMs());
    return ResponseEntity.ok(new CheckNowResponse(
            outcome.success(),
            outcome.durationMs(),
            outcome.reelsTouched(),
            outcome.reelsSkipped(),
            outcome.error()));
}
```

**Note sur la 404** : `GlobalExceptionHandler` existe déjà (cf. `web/error/GlobalExceptionHandler.java:66`) et mappe `NoSuchElementException → 404` globalement. Le throw suffit, aucun handler local à ajouter.

- [ ] **Step 5 : Run le test — doit passer**

Run:
```bash
./mvnw test -Dtest=InternalAccountControllerTest
```
Expected: PASS (3 cas).

- [ ] **Step 6 : Run la suite complète du Scraper**

Run:
```bash
./mvnw test
```
Expected: PASS — aucun test existant ne doit casser.

- [ ] **Step 7 : Test manuel end-to-end (facultatif mais recommandé pour valider JWT)**

Scraper doit être running sur 8082. Dans un terminal :
```bash
# 1) Obtenir un JWT de service (login automation-bot)
curl -s -X POST http://localhost:8082/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"automation-bot","password":"<mot_de_passe_env>"}' | jq -r .accessToken > /tmp/svc_token

# 2) Appeler le nouvel endpoint
curl -s -X POST http://localhost:8082/internal/accounts/by-username/UN_USERNAME_EXISTANT/check-now \
  -H "Authorization: Bearer $(cat /tmp/svc_token)" | jq .
```
Expected: `{"success":true,"durationMs":…,"reelsTouched":…,"reelsSkipped":…,"error":null}`.

- [ ] **Step 8 : Commit**

```bash
cd /Users/samyhne/IG-bot/InstagramScraper
git add src/main/java/com/dargand/igscraper/web/controller/InternalAccountController.java \
        src/test/java/com/dargand/igscraper/web/InternalAccountControllerTest.java
git commit -m "feat(scraper): add check-now by-username endpoint for service callers"
```

---

## Chunk 2 : Automation — modèle, event, règle de matching pure

### Task 2.1 — Ajouter les champs de vérification sur `PostingHistoryEntry`

**Context:** On enrichit le document Mongo existant avec 3 champs nullable (`verificationStatus`, `verifiedAt`, `matchedShortcode`). Les entries existants en base ont `verificationStatus = null` → interprété comme `NOT_CHECKED`. Pas de migration, le Mongo driver accepte les documents sans les nouveaux champs.

**Files:**
- Modify: `InstagramAutomation/src/main/java/com/automation/instagram/model/mongo/PostingHistoryEntry.java`
- Create: `InstagramAutomation/src/main/java/com/automation/instagram/model/mongo/VerificationStatus.java`

- [ ] **Step 1 : Créer l'enum `VerificationStatus`**

```java
// InstagramAutomation/src/main/java/com/automation/instagram/model/mongo/VerificationStatus.java
package com.automation.instagram.model.mongo;

/**
 * Statut de vérification post-publication d'un reel :
 *  - NOT_CHECKED : le reel n'a jamais été vérifié (ou valeur absente en base → null).
 *  - VERIFIED    : un reel correspondant a été trouvé côté Scraper via check-now + fetchReelsStats.
 *  - MISSING     : la vérif a été tentée avec succès mais aucun reel du scraper ne match.
 */
public enum VerificationStatus {
    NOT_CHECKED,
    VERIFIED,
    MISSING
}
```

- [ ] **Step 2 : Ajouter les 3 champs à `PostingHistoryEntry`**

Éditer la classe pour ajouter après `driveFilename` :
```java
private VerificationStatus verificationStatus;  // null interprété comme NOT_CHECKED
private LocalDateTime      verifiedAt;          // nullable
private String             matchedShortcode;    // nullable, rempli si VERIFIED
```

- [ ] **Step 3 : Compile**

Run:
```bash
cd /Users/samyhne/IG-bot/InstagramAutomation
./mvnw compile
```
Expected: BUILD SUCCESS.

- [ ] **Step 4 : Run tous les tests pour confirmer non-régression**

Run:
```bash
./mvnw test
```
Expected: PASS. Lombok `@Data @Builder` régénère les accessors ; les tests existants ne dépendent pas des nouveaux champs.

- [ ] **Step 5 : Commit**

```bash
git add src/main/java/com/automation/instagram/model/mongo/PostingHistoryEntry.java \
        src/main/java/com/automation/instagram/model/mongo/VerificationStatus.java
git commit -m "feat(posting-history): add verification status fields to PostingHistoryEntry"
```

---

### Task 2.2 — Modifier `PostingHistoryService.markAsPosted` pour retourner l'entry persisté

**Context:** Actuellement `void`. Le listener du workflow a besoin de l'id de l'entry fraîchement créé pour publier un `ReelPostedEvent`. Changement backward-compatible : les callers actuels ignorent la valeur de retour sans casser.

**Files:**
- Modify: `InstagramAutomation/src/main/java/com/automation/instagram/content/service/PostingHistoryService.java`
- Modify (au besoin) : `InstagramAutomation/src/test/java/com/automation/instagram/content/service/PostingHistoryServiceTest.java`

- [ ] **Step 1 : Écrire un test qui vérifie que `markAsPosted` retourne un entry persisté avec un id non-null**

Dans `PostingHistoryServiceTest`, ajouter :
```java
@Test
void markAsPosted_returnsEntryWithId() {
    when(postingHistoryRepository.save(any(PostingHistoryEntry.class)))
        .thenAnswer(inv -> {
            PostingHistoryEntry e = inv.getArgument(0);
            e.setId("generated-id-123");
            return e;
        });
    when(postingHistoryRepository.findByUsernameOrderByPostedAtAsc(anyString()))
        .thenReturn(new ArrayList<>());

    PostingHistoryEntry result = service.markAsPosted("alice", "vid1", "tpl_A", "vid1_template-01.mp4");

    assertNotNull(result);
    assertEquals("generated-id-123", result.getId());
    assertEquals("alice", result.getUsername());
    assertEquals("vid1", result.getBaseVideo());
}
```

- [ ] **Step 2 : Run — doit échouer (méthode `void`, type incompatible)**

Run:
```bash
./mvnw test -Dtest=PostingHistoryServiceTest#markAsPosted_returnsEntryWithId
```
Expected: compile error "incompatible types: void cannot be converted to PostingHistoryEntry".

- [ ] **Step 3 : Modifier la signature**

Dans `PostingHistoryService.java` (ligne ~55) :
```java
public synchronized PostingHistoryEntry markAsPosted(String username, String baseVideoName,
                                                     String template, String driveFilename) {
    PostingHistoryEntry entry = PostingHistoryEntry.builder()
            .username(username)
            .baseVideo(baseVideoName)
            .postedAt(LocalDateTime.now())
            .template(template)
            .driveFilename(driveFilename)
            .build();

    PostingHistoryEntry saved = postingHistoryRepository.save(entry);  // capturer le retour

    // Trim history if exceeding max size (inchangé)
    List<PostingHistoryEntry> history = postingHistoryRepository.findByUsernameOrderByPostedAtAsc(username);
    if (history.size() > DEFAULT_MAX_HISTORY_SIZE) {
        int excess = history.size() - DEFAULT_MAX_HISTORY_SIZE;
        for (int i = 0; i < excess; i++) {
            postingHistoryRepository.delete(history.get(i));
        }
        log.debug("[{}] Trimmed {} old entries from posting history", username, excess);
    }

    log.info("[{}] Marked as posted: baseVideo={}, template={}, driveFilename={}",
            username, baseVideoName, template, driveFilename);

    return saved;  // NOUVEAU
}
```

- [ ] **Step 4 : Run le nouveau test + les anciens de `PostingHistoryServiceTest`**

Run:
```bash
./mvnw test -Dtest=PostingHistoryServiceTest
```
Expected: PASS (tous). Les anciens tests ignoraient le retour, donc restent verts.

- [ ] **Step 5 : Run la suite complète pour confirmer**

Run:
```bash
./mvnw test
```
Expected: PASS. Les callers actuels (`PostReelWorkflow.onAfterExecute`) compilent car ignorer un retour en Java est légal.

- [ ] **Step 6 : Commit**

```bash
git add src/main/java/com/automation/instagram/content/service/PostingHistoryService.java \
        src/test/java/com/automation/instagram/content/service/PostingHistoryServiceTest.java
git commit -m "refactor(posting-history): make markAsPosted return the persisted entry"
```

---

### Task 2.3 — Ajouter `shortcode` au DTO `ScraperReelStatsDto` (côté Automation)

**Context:** Le DTO consommé côté Automation doit matcher la shape enrichie du scraper (cf. Task 1.1). C'est un record — on ajoute le champ.

**Files:**
- Modify: `InstagramAutomation/src/main/java/com/automation/instagram/service/reelstats/scraper/ScraperReelStatsDto.java`

- [ ] **Step 1 : Éditer le record**

Avant :
```java
public record ScraperReelStatsDto(
        Instant publishedAt,
        Long viewsCount
) {}
```
Après :
```java
public record ScraperReelStatsDto(
        Instant publishedAt,
        String shortcode,   // NOUVEAU — identifiant du reel côté Instagram
        Long viewsCount
) {}
```

- [ ] **Step 2 : Adapter les tests qui construisent `ScraperReelStatsDto(...)` positionnellement**

L'ajout du champ `shortcode` entre `publishedAt` et `viewsCount` **va casser** les tests qui utilisent le constructeur positionnel (car le 2e argument change de type : `Long` → `String`). Jackson bind par nom donc les tests orientés JSON ne cassent pas, mais les tests Java directs oui.

**Fichiers impactés (vérifiés par grep)** :
- `src/test/java/com/automation/instagram/service/autolink/AutoLinkDecisionServiceTest.java` — helper `reel(...)` ligne ~336 + ~20 callsites
- `src/test/java/com/automation/instagram/service/reelstats/scraper/ScraperAccountRankerTest.java` — ligne ~106

Dans chacun, ajouter `null` pour `shortcode` :
```java
// Avant
return new ScraperReelStatsDto(publishedAt, views);
// Après
return new ScraperReelStatsDto(publishedAt, null, views);
```

- [ ] **Step 2b : Run les tests ciblés**

Run:
```bash
./mvnw test -Dtest=AutoLinkDecisionServiceTest
./mvnw test -Dtest=ScraperAccountRankerTest
./mvnw test -Dtest=RawScraperStatsClientTest
./mvnw test -Dtest=ScraperStatsClientTest
```
Expected: PASS. Jackson bind par nom donc les tests JSON-driven (Raw/ScraperStatsClientTest) passent sans modif.

- [ ] **Step 3 : Run toute la suite**

Run:
```bash
./mvnw test
```
Expected: PASS.

- [ ] **Step 4 : Commit**

```bash
git add src/main/java/com/automation/instagram/service/reelstats/scraper/ScraperReelStatsDto.java \
        src/test/java/com/automation/instagram/service/autolink/AutoLinkDecisionServiceTest.java \
        src/test/java/com/automation/instagram/service/reelstats/scraper/ScraperAccountRankerTest.java
git commit -m "feat(scraper-client): propagate shortcode in ScraperReelStatsDto"
```

---

### Task 2.4 — Créer `ReelPostedEvent`

**Context:** ApplicationEvent publié en fin de workflow (Task 4.2). Porteur minimal : username + id de l'entry + postedAt.

**Files:**
- Create: `InstagramAutomation/src/main/java/com/automation/instagram/event/ReelPostedEvent.java`

- [ ] **Step 1 : Écrire le record**

```java
package com.automation.instagram.event;

import java.time.LocalDateTime;

/**
 * Event Spring publié quand un workflow de post a réussi à publier un reel.
 * Écouté par ReelVerificationEventListener pour déclencher une vérification
 * post-publication après un délai (cf. spec 2026-04-22-reel-verification).
 */
public record ReelPostedEvent(
        String username,
        String postingHistoryEntryId,
        LocalDateTime postedAt
) {
}
```

- [ ] **Step 2 : Compile**

Run:
```bash
./mvnw compile
```
Expected: BUILD SUCCESS.

- [ ] **Step 3 : Commit**

```bash
git add src/main/java/com/automation/instagram/event/ReelPostedEvent.java
git commit -m "feat(events): add ReelPostedEvent record"
```

---

### Task 2.5 — Créer `ReelMatcher` (règle de matching pure, unit-testée)

**Context:** Logique pure = pas de Spring, pas d'I/O. Testable à fond. Input : une liste de `PostingHistoryEntry` pour un username + la liste des reels scraper. Output : pour chaque entry, un statut `VERIFIED | MISSING` + `matchedShortcode` si VERIFIED. Règle : fenêtre asymétrique `[postedAt - 5min ; postedAt + 30min]`, consume-once, ordre de traitement des entries par `postedAt` ascendant pour donner la priorité au plus ancien.

**Files:**
- Create: `InstagramAutomation/src/main/java/com/automation/instagram/service/reelverification/ReelMatcher.java`
- Create: `InstagramAutomation/src/main/java/com/automation/instagram/service/reelverification/MatchResult.java`
- Test: `InstagramAutomation/src/test/java/com/automation/instagram/service/reelverification/ReelMatcherTest.java`

- [ ] **Step 1 : Écrire `MatchResult` (record porté avec l'entry référencée + statut + shortcode)**

```java
package com.automation.instagram.service.reelverification;

import com.automation.instagram.model.mongo.PostingHistoryEntry;
import com.automation.instagram.model.mongo.VerificationStatus;

/**
 * Résultat du matching d'une entry contre la liste des reels scraper.
 * - VERIFIED : matchedShortcode non-null.
 * - MISSING  : matchedShortcode null.
 */
public record MatchResult(
        PostingHistoryEntry entry,
        VerificationStatus status,
        String matchedShortcode
) {
}
```

- [ ] **Step 2 : Écrire le test `ReelMatcherTest` avec les 6 cas**

```java
package com.automation.instagram.service.reelverification;

import com.automation.instagram.model.mongo.PostingHistoryEntry;
import com.automation.instagram.model.mongo.VerificationStatus;
import com.automation.instagram.service.reelstats.scraper.ScraperReelStatsDto;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class ReelMatcherTest {

    private final ReelMatcher matcher = new ReelMatcher();

    private static PostingHistoryEntry entry(String id, String user, LocalDateTime postedAt) {
        return PostingHistoryEntry.builder().id(id).username(user).postedAt(postedAt).build();
    }

    private static ScraperReelStatsDto reel(String shortcode, Instant publishedAt) {
        return new ScraperReelStatsDto(publishedAt, shortcode, 0L);
    }

    private static Instant toInstant(LocalDateTime dt) {
        return dt.atZone(ZoneId.systemDefault()).toInstant();
    }

    @Test
    void match_withinWindow_returnsVerified() {
        LocalDateTime postedAt = LocalDateTime.of(2026, 4, 22, 14, 0);
        var e = entry("e1", "alice", postedAt);
        var r = reel("SHORT1", toInstant(postedAt.plusMinutes(10)));

        List<MatchResult> results = matcher.match(List.of(e), List.of(r));

        assertEquals(1, results.size());
        assertEquals(VerificationStatus.VERIFIED, results.get(0).status());
        assertEquals("SHORT1", results.get(0).matchedShortcode());
    }

    @Test
    void match_pastUpperBound_returnsMissing() {
        LocalDateTime postedAt = LocalDateTime.of(2026, 4, 22, 14, 0);
        var e = entry("e1", "alice", postedAt);
        var r = reel("SHORT1", toInstant(postedAt.plusMinutes(31)));  // hors fenêtre haute

        List<MatchResult> results = matcher.match(List.of(e), List.of(r));

        assertEquals(VerificationStatus.MISSING, results.get(0).status());
        assertNull(results.get(0).matchedShortcode());
    }

    @Test
    void match_beforeLowerBound_returnsMissing() {
        LocalDateTime postedAt = LocalDateTime.of(2026, 4, 22, 14, 0);
        var e = entry("e1", "alice", postedAt);
        var r = reel("SHORT1", toInstant(postedAt.minusMinutes(6)));  // hors fenêtre basse

        List<MatchResult> results = matcher.match(List.of(e), List.of(r));

        assertEquals(VerificationStatus.MISSING, results.get(0).status());
    }

    @Test
    void match_multipleCandidates_picksClosest() {
        LocalDateTime postedAt = LocalDateTime.of(2026, 4, 22, 14, 0);
        var e = entry("e1", "alice", postedAt);
        var close  = reel("CLOSE",  toInstant(postedAt.plusMinutes(2)));
        var farther = reel("FARTHER", toInstant(postedAt.plusMinutes(20)));

        List<MatchResult> results = matcher.match(List.of(e), List.of(close, farther));

        assertEquals(VerificationStatus.VERIFIED, results.get(0).status());
        assertEquals("CLOSE", results.get(0).matchedShortcode());
    }

    @Test
    void match_consumesReelOnce_secondEntryIsMissing() {
        LocalDateTime t = LocalDateTime.of(2026, 4, 22, 14, 0);
        var e1 = entry("e1", "alice", t);
        var e2 = entry("e2", "alice", t.plusMinutes(3));  // très proche de e1
        var r  = reel("ONLY", toInstant(t.plusMinutes(1)));

        List<MatchResult> results = matcher.match(List.of(e1, e2), List.of(r));

        // e1 consomme le seul reel disponible ; e2 n'a plus de candidat
        assertEquals("ONLY", results.get(0).matchedShortcode());
        assertEquals(VerificationStatus.MISSING, results.get(1).status());
    }

    @Test
    void match_emptyScraperReels_allMissing() {
        var e = entry("e1", "alice", LocalDateTime.now());

        List<MatchResult> results = matcher.match(List.of(e), List.of());

        assertEquals(VerificationStatus.MISSING, results.get(0).status());
    }
}
```

- [ ] **Step 3 : Run les tests — doivent échouer (classe `ReelMatcher` absente)**

Run:
```bash
./mvnw test -Dtest=ReelMatcherTest
```
Expected: compile error "cannot find symbol: class ReelMatcher".

- [ ] **Step 4 : Écrire `ReelMatcher`**

```java
package com.automation.instagram.service.reelverification;

import com.automation.instagram.model.mongo.PostingHistoryEntry;
import com.automation.instagram.model.mongo.VerificationStatus;
import com.automation.instagram.service.reelstats.scraper.ScraperReelStatsDto;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Règle pure de matching entre {@link PostingHistoryEntry} locaux et reels vus par le scraper.
 *
 * <p>Pour chaque entry (triée par {@code postedAt} ascendant pour prioriser les plus anciennes) :
 * on cherche parmi les reels scraper non-encore-consommés ceux dont {@code publishedAt}
 * tombe dans la fenêtre {@code [postedAt - 5min ; postedAt + 30min]}. Si au moins un match :
 * on prend le reel le plus proche de {@code postedAt}, on le marque consommé, l'entry est
 * {@code VERIFIED}. Sinon {@code MISSING}.</p>
 *
 * <p>Fenêtre asymétrique : -5min couvre un décalage d'horloge serveur, +30min couvre la
 * latence de queue Instagram + propagation RapidAPI.</p>
 */
@Component
public class ReelMatcher {

    private static final Duration LOOKBACK  = Duration.ofMinutes(5);
    private static final Duration LOOKAHEAD = Duration.ofMinutes(30);

    public List<MatchResult> match(List<PostingHistoryEntry> entries,
                                   List<ScraperReelStatsDto> scraperReels) {
        List<PostingHistoryEntry> sorted = new ArrayList<>(entries);
        sorted.sort(Comparator.comparing(PostingHistoryEntry::getPostedAt));

        Set<String> consumed = new HashSet<>();  // shortcodes déjà attribués
        List<MatchResult> results = new ArrayList<>(sorted.size());

        for (PostingHistoryEntry entry : sorted) {
            Instant postedInstant = toInstant(entry.getPostedAt());
            Instant lower = postedInstant.minus(LOOKBACK);
            Instant upper = postedInstant.plus(LOOKAHEAD);

            ScraperReelStatsDto best = null;
            long bestDistance = Long.MAX_VALUE;

            for (ScraperReelStatsDto reel : scraperReels) {
                if (reel.shortcode() != null && consumed.contains(reel.shortcode())) continue;
                if (reel.publishedAt() == null) continue;
                if (reel.publishedAt().isBefore(lower) || reel.publishedAt().isAfter(upper)) continue;

                long dist = Math.abs(reel.publishedAt().toEpochMilli() - postedInstant.toEpochMilli());
                if (dist < bestDistance) {
                    bestDistance = dist;
                    best = reel;
                }
            }

            if (best == null) {
                results.add(new MatchResult(entry, VerificationStatus.MISSING, null));
            } else {
                if (best.shortcode() != null) consumed.add(best.shortcode());
                results.add(new MatchResult(entry, VerificationStatus.VERIFIED, best.shortcode()));
            }
        }

        return results;
    }

    private static Instant toInstant(java.time.LocalDateTime dt) {
        return dt.atZone(ZoneId.systemDefault()).toInstant();
    }
}
```

- [ ] **Step 5 : Run les tests — tous doivent passer**

Run:
```bash
./mvnw test -Dtest=ReelMatcherTest
```
Expected: PASS (6 cas).

- [ ] **Step 6 : Commit**

```bash
git add src/main/java/com/automation/instagram/service/reelverification/ReelMatcher.java \
        src/main/java/com/automation/instagram/service/reelverification/MatchResult.java \
        src/test/java/com/automation/instagram/service/reelverification/ReelMatcherTest.java
git commit -m "feat(reel-verification): add pure ReelMatcher with time-window rule"
```

---

## Chunk 3 : Automation — service d'orchestration, registry, scraper client, listener

### Task 3.1 — Ajouter `findByPostedAtAfter` sur `PostingHistoryRepository`

**Files:**
- Modify: `InstagramAutomation/src/main/java/com/automation/instagram/repository/PostingHistoryRepository.java`

- [ ] **Step 1 : Ajouter la méthode de requête dérivée**

```java
import java.time.LocalDateTime;

// ... dans l'interface existante ...
List<PostingHistoryEntry> findByPostedAtAfter(LocalDateTime threshold);
```
(Spring Data génère la query Mongo : `{ postedAt: { $gt: threshold } }`.)

- [ ] **Step 2 : Compile**

Run:
```bash
./mvnw compile
```
Expected: BUILD SUCCESS.

- [ ] **Step 3 : Commit**

```bash
git add src/main/java/com/automation/instagram/repository/PostingHistoryRepository.java
git commit -m "feat(posting-history): add findByPostedAtAfter query method"
```

---

### Task 3.2 — Créer `ScanRun`, `ScanStatus`, `ScanRunRegistry`

**Context:** État des scans global en mémoire. Pas de persistance. TTL 1h via `@Scheduled`. Concurrence : un seul scan running à la fois (idempotence).

**Files:**
- Create: `InstagramAutomation/src/main/java/com/automation/instagram/service/reelverification/ScanStatus.java`
- Create: `InstagramAutomation/src/main/java/com/automation/instagram/service/reelverification/ScanRun.java`
- Create: `InstagramAutomation/src/main/java/com/automation/instagram/service/reelverification/ScanRunRegistry.java`
- Test: `InstagramAutomation/src/test/java/com/automation/instagram/service/reelverification/ScanRunRegistryTest.java`

- [ ] **Step 1 : Créer `ScanStatus`**

```java
package com.automation.instagram.service.reelverification;

public enum ScanStatus { RUNNING, COMPLETED, FAILED }
```

- [ ] **Step 2 : Créer `ScanRun` (record immuable avec méthodes de transition)**

```java
package com.automation.instagram.service.reelverification;

import java.time.Instant;
import java.util.UUID;

/**
 * État d'un scan (manuel ou déclenché par event). Immuable — chaque transition
 * retourne une nouvelle instance via with*. Stocké dans ScanRunRegistry.
 */
public record ScanRun(
        UUID id,
        ScanStatus status,
        int total,
        int done,
        int errors,
        int missingCount,
        Instant startedAt,
        Instant finishedAt,
        String error
) {
    public static ScanRun start(UUID id, int total) {
        return new ScanRun(id, ScanStatus.RUNNING, total, 0, 0, 0, Instant.now(), null, null);
    }

    public ScanRun withProgress(int done, int errors, int missingCount) {
        return new ScanRun(id, status, total, done, errors, missingCount, startedAt, finishedAt, error);
    }

    public ScanRun completed() {
        return new ScanRun(id, ScanStatus.COMPLETED, total, done, errors, missingCount,
                startedAt, Instant.now(), null);
    }

    public ScanRun failed(String message) {
        return new ScanRun(id, ScanStatus.FAILED, total, done, errors, missingCount,
                startedAt, Instant.now(), message);
    }
}
```

- [ ] **Step 3 : Écrire des tests pour `ScanRunRegistry`**

```java
package com.automation.instagram.service.reelverification;

import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

class ScanRunRegistryTest {

    @Test
    void startOrGet_whenNoRunning_createsNew() {
        ScanRunRegistry reg = new ScanRunRegistry();
        ScanRun run = reg.startOrGet(5);
        assertNotNull(run);
        assertEquals(ScanStatus.RUNNING, run.status());
        assertEquals(5, run.total());
    }

    @Test
    void startOrGet_whenRunningExists_returnsExisting() {
        ScanRunRegistry reg = new ScanRunRegistry();
        ScanRun first  = reg.startOrGet(5);
        ScanRun second = reg.startOrGet(10);   // total ignoré, idempotent
        assertEquals(first.id(), second.id());
    }

    @Test
    void complete_freesCurrentRunning_allowsNewScan() {
        ScanRunRegistry reg = new ScanRunRegistry();
        ScanRun first = reg.startOrGet(5);
        reg.complete(first.id());
        ScanRun second = reg.startOrGet(3);
        assertNotEquals(first.id(), second.id());
    }

    @Test
    void get_returnsEmptyForUnknownId() {
        ScanRunRegistry reg = new ScanRunRegistry();
        assertTrue(reg.get(UUID.randomUUID()).isEmpty());
    }

    @Test
    void pruneExpired_removesCompletedOlderThanTtl() {
        ScanRunRegistry reg = new ScanRunRegistry();
        ScanRun run = reg.startOrGet(1);
        reg.complete(run.id());
        // Forcer un finishedAt ancien via manipulation interne : la méthode prune prend
        // un threshold Instant en paramètre pour tester sans sleep.
        reg.pruneExpired(Instant.now().plusSeconds(3700)); // simuler 1h+ plus tard
        assertTrue(reg.get(run.id()).isEmpty());
    }
}
```

- [ ] **Step 4 : Run — doit échouer (classe absente)**

Run:
```bash
./mvnw test -Dtest=ScanRunRegistryTest
```
Expected: compile error.

- [ ] **Step 5 : Implémenter `ScanRunRegistry`**

```java
package com.automation.instagram.service.reelverification;

import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Registre global en mémoire des scans de vérification Reels.
 * Thread-safe. TTL 1h pour les scans terminés (via prune périodique).
 * Un seul scan RUNNING à la fois : {@link #startOrGet(int)} retourne le scan en cours
 * s'il y en a un (idempotence côté API).
 */
@Slf4j
@Component
public class ScanRunRegistry {

    private static final Duration TTL = Duration.ofHours(1);

    private final Map<UUID, ScanRun> runs = new ConcurrentHashMap<>();
    private final AtomicReference<UUID> currentRunning = new AtomicReference<>();

    /**
     * Démarre un scan OU retourne le scan en cours s'il y en a un.
     */
    public synchronized ScanRun startOrGet(int total) {
        UUID existingId = currentRunning.get();
        if (existingId != null) {
            ScanRun existing = runs.get(existingId);
            if (existing != null && existing.status() == ScanStatus.RUNNING) {
                return existing;
            }
        }
        UUID id = UUID.randomUUID();
        ScanRun run = ScanRun.start(id, total);
        runs.put(id, run);
        currentRunning.set(id);
        return run;
    }

    public Optional<ScanRun> get(UUID id) {
        return Optional.ofNullable(runs.get(id));
    }

    public synchronized void updateProgress(UUID id, int done, int errors, int missingCount) {
        ScanRun r = runs.get(id);
        if (r == null) return;
        runs.put(id, r.withProgress(done, errors, missingCount));
    }

    public synchronized void complete(UUID id) {
        ScanRun r = runs.get(id);
        if (r == null) return;
        runs.put(id, r.completed());
        currentRunning.compareAndSet(id, null);
    }

    public synchronized void fail(UUID id, String message) {
        ScanRun r = runs.get(id);
        if (r == null) return;
        runs.put(id, r.failed(message));
        currentRunning.compareAndSet(id, null);
    }

    /**
     * Nettoie les scans terminés depuis plus de {@link #TTL} avant {@code now}.
     * Méthode exposée pour test ; le prune programmé appelle {@code pruneExpired(Instant.now())}.
     */
    public synchronized void pruneExpired(Instant now) {
        Instant cutoff = now.minus(TTL);
        runs.entrySet().removeIf(e -> {
            ScanRun r = e.getValue();
            return r.finishedAt() != null && r.finishedAt().isBefore(cutoff);
        });
    }

    @Scheduled(fixedRate = 10 * 60 * 1000L)  // toutes les 10 min
    public void pruneScheduled() {
        pruneExpired(Instant.now());
    }
}
```

- [ ] **Step 6 : Vérifier qu'il existe déjà un `@EnableScheduling` dans le projet**

Run:
```bash
grep -rn "@EnableScheduling" src/main/java/com/automation/instagram/
```
Expected: au moins une classe de config qui l'active. Si absent, ajouter `@EnableScheduling` sur une config existante (ex: `Application.java` ou `AsyncConfig`).

- [ ] **Step 7 : Run les tests**

Run:
```bash
./mvnw test -Dtest=ScanRunRegistryTest
```
Expected: PASS.

- [ ] **Step 8 : Commit**

```bash
git add src/main/java/com/automation/instagram/service/reelverification/ScanStatus.java \
        src/main/java/com/automation/instagram/service/reelverification/ScanRun.java \
        src/main/java/com/automation/instagram/service/reelverification/ScanRunRegistry.java \
        src/test/java/com/automation/instagram/service/reelverification/ScanRunRegistryTest.java
git commit -m "feat(reel-verification): add in-memory ScanRunRegistry with TTL pruning"
```

---

### Task 3.3 — Créer `ScraperCheckNowClient` (client HTTP vers le nouvel endpoint scraper)

**Context:** Réutiliser le même pattern d'auth JWT que `RawScraperStatsClient` (login lazy + cache token + retry-once-on-401). Pour éviter la duplication, on extrait un helper token OU on injecte simplement `RawScraperStatsClient` pour accéder au token. Solution pragmatique retenue : dans un premier temps, on duplique le pattern (simple, lisible) — si une 3e classe vient, on refactore.

**Alternative plus propre** : extraire un bean `ScraperJwtTokenProvider` que `RawScraperStatsClient` et `ScraperCheckNowClient` partageraient. **Retenue pour ce plan** : refactor léger — isoler la gestion de token dans un nouveau bean.

**Files:**
- Create: `InstagramAutomation/src/main/java/com/automation/instagram/service/reelstats/scraper/ScraperJwtTokenProvider.java`
- Modify: `InstagramAutomation/src/main/java/com/automation/instagram/service/reelstats/scraper/RawScraperStatsClient.java` (délègue au provider)
- Modify: `InstagramAutomation/src/main/java/com/automation/instagram/config/ScraperStatsClientConfig.java` (wire le provider)
- Create: `InstagramAutomation/src/main/java/com/automation/instagram/service/reelverification/scraper/ScraperCheckNowClient.java`
- Test: `InstagramAutomation/src/test/java/com/automation/instagram/service/reelverification/scraper/ScraperCheckNowClientTest.java`

> **Si le refactor du token s'avère compliqué à faire in place sans casser les tests existants de `RawScraperStatsClient`**, plan B : implémenter `ScraperCheckNowClient` avec sa propre gestion de token (duplication assumée) et laisser un TODO pour consolidation future. Décider à l'exécution selon la complexité observée.

- [ ] **Step 1 : Lire `RawScraperStatsClient` en entier pour comprendre le flux de token**

Run:
```bash
cd /Users/samyhne/IG-bot/InstagramAutomation
cat src/main/java/com/automation/instagram/service/reelstats/scraper/RawScraperStatsClient.java | wc -l
cat src/main/java/com/automation/instagram/service/reelstats/scraper/RawScraperStatsClient.java
cat src/main/java/com/automation/instagram/config/ScraperStatsProperties.java
cat src/main/java/com/automation/instagram/config/ScraperStatsClientConfig.java
```
Noter :
- Méthode de login (chemin `/auth/login`, body, parsing du `accessToken`).
- Comment le token est caché (`cachedAccessToken`, `tokenExpiry`).
- Retry-once-on-401.

- [ ] **Step 2 : Écrire le test de `ScraperCheckNowClient`**

Le plus propre : test d'intégration avec un `MockWebServer` (OkHttp) qui simule les réponses du scraper. Vérifier que le code client existant utilise déjà ce pattern :
```bash
grep -rn "MockWebServer\|WireMock" src/test/java/
```
Adopter la même lib.

Cas à tester :
1. `checkNow("alice")` → appelle `POST /internal/accounts/by-username/alice/check-now` avec `Authorization: Bearer <token>` et retourne `CheckNowSuccess`.
2. Réponse 401 → retry après re-login, puis succès.
3. Réponse 404 → throw `ScraperStatsException.NotFoundException`.
4. Réponse 500 → throw `ScraperStatsException.TransportException`.

Gabarit :
```java
@Test
void checkNow_successfulResponse() throws Exception {
    // given : MockWebServer enqueue 200 avec body {"success":true,...}
    // when  : client.checkNow("alice")
    // then  : pas d'exception, résultat renvoyé
}
```

- [ ] **Step 3 : Run — doit échouer (classe absente)**

Run:
```bash
./mvnw test -Dtest=ScraperCheckNowClientTest
```
Expected: compile error.

- [ ] **Step 4 : Extraire `ScraperJwtTokenProvider`**

Créer un bean qui encapsule le cache de token + login + retry. Interface :
```java
public interface ScraperJwtTokenProvider {
    String getToken() throws InterruptedException;
    void invalidate();
}
```
Implémenter avec le code extrait de `RawScraperStatsClient.login()` + `cachedAccessToken`/`tokenExpiry`.

Dans `RawScraperStatsClient`, remplacer la gestion locale par une injection de `ScraperJwtTokenProvider`. Les tests existants de `RawScraperStatsClient` doivent continuer de passer (mocker le provider).

- [ ] **Step 5 : Écrire `ScraperCheckNowClient`**

```java
package com.automation.instagram.service.reelverification.scraper;

import com.automation.instagram.config.ScraperStatsProperties;
import com.automation.instagram.service.reelstats.scraper.ScraperJwtTokenProvider;
import com.automation.instagram.service.reelstats.scraper.ScraperStatsException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

/**
 * Client HTTP vers POST /internal/accounts/by-username/{username}/check-now du scraper.
 * Force un scrape live RapidAPI côté scraper (non-cachable). Utilisé par
 * ReelVerificationService avant de lire les reels via ScraperStatsClient.
 */
@Slf4j
@Component
public class ScraperCheckNowClient {

    private final ScraperStatsProperties properties;
    private final ScraperJwtTokenProvider tokenProvider;
    private final ObjectMapper objectMapper;
    private final HttpClient http;

    public ScraperCheckNowClient(ScraperStatsProperties properties,
                                 ScraperJwtTokenProvider tokenProvider,
                                 ObjectMapper objectMapper) {
        this.properties = properties;
        this.tokenProvider = tokenProvider;
        this.objectMapper = objectMapper;
        this.http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
    }

    public CheckNowResult checkNow(String username) throws InterruptedException {
        HttpResponse<String> resp = call(username, false);
        if (resp.statusCode() == 401) {
            log.debug("[ScraperCheckNow] 401 sur check-now, retry after re-login");
            tokenProvider.invalidate();
            resp = call(username, true);
        }
        int status = resp.statusCode();
        if (status == 404) {
            throw new ScraperStatsException.NotFoundException("Compte inconnu côté scraper : " + username);
        }
        if (status / 100 == 5) {
            // TransportException a une signature (String, Throwable) — pas de single-arg constructor.
            throw new ScraperStatsException.TransportException("check-now 5xx : " + status, null);
        }
        if (status != 200) {
            throw new ScraperStatsException.TransportException("check-now status inattendu : " + status, null);
        }
        try {
            JsonNode node = objectMapper.readTree(resp.body());
            return new CheckNowResult(
                    node.path("success").asBoolean(false),
                    node.path("durationMs").asLong(0),
                    node.path("reelsTouched").asInt(0),
                    node.path("reelsSkipped").asInt(0),
                    node.path("error").isNull() ? null : node.path("error").asText());
        } catch (Exception e) {
            throw new ScraperStatsException.TransportException("Parse check-now response failed: " + e.getMessage(), e);
        }
    }

    private HttpResponse<String> call(String username, boolean afterRelogin) throws InterruptedException {
        String token = tokenProvider.getToken();
        HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(properties.getBaseUrl() + "/internal/accounts/by-username/" + username + "/check-now"))
                .header("Authorization", "Bearer " + token)
                .header("Content-Type", "application/json")
                .timeout(Duration.ofSeconds(30))
                .POST(HttpRequest.BodyPublishers.noBody())
                .build();
        try {
            return http.send(req, HttpResponse.BodyHandlers.ofString());
        } catch (java.io.IOException e) {
            throw new ScraperStatsException.TransportException("check-now transport failure: " + e.getMessage(), e);
        }
    }

    public record CheckNowResult(boolean success, long durationMs,
                                 int reelsTouched, int reelsSkipped, String error) {}
}
```

- [ ] **Step 6 : Run les tests — doivent passer**

Run:
```bash
./mvnw test -Dtest=ScraperCheckNowClientTest
./mvnw test -Dtest=RawScraperStatsClientTest   # non-régression sur le refactor token
```
Expected: PASS.

- [ ] **Step 7 : Run toute la suite**

Run:
```bash
./mvnw test
```
Expected: PASS.

- [ ] **Step 8 : Commit**

```bash
git add src/main/java/com/automation/instagram/service/reelstats/scraper/ScraperJwtTokenProvider.java \
        src/main/java/com/automation/instagram/service/reelstats/scraper/RawScraperStatsClient.java \
        src/main/java/com/automation/instagram/config/ScraperStatsClientConfig.java \
        src/main/java/com/automation/instagram/service/reelverification/scraper/ScraperCheckNowClient.java \
        src/test/java/com/automation/instagram/service/reelverification/scraper/ScraperCheckNowClientTest.java \
        src/test/java/com/automation/instagram/service/reelstats/scraper/RawScraperStatsClientTest.java
git commit -m "feat(reel-verification): add ScraperCheckNowClient with shared JWT provider"
```

---

### Task 3.4 — Créer `ReelVerificationService` + `ReelScanRunner`

**Context:** Cœur de la feature. Orchestre : scan global async, vérification unitaire synchrone, retry × 1 sur échec scraper, persistence des résultats sur `PostingHistoryEntry`.

> **Gotcha Spring `@Async`** : on ne peut PAS appeler une méthode `@Async` depuis une autre méthode du même bean — l'appel passe à côté du proxy AOP et s'exécute synchronement. Solution retenue : **séparer le runner dans un bean distinct** (`ReelScanRunner`). `ReelVerificationService.startScan(...)` prépare les données, démarre le `ScanRun` dans le registry, puis délègue l'exécution asynchrone à `reelScanRunner.runAsync(scanId, byUser)`. C'est `runAsync` (sur un bean différent) qui porte `@Async` et s'exécute dans un thread du pool.

**Files:**
- Create: `InstagramAutomation/src/main/java/com/automation/instagram/service/reelverification/ReelVerificationService.java`
- Create: `InstagramAutomation/src/main/java/com/automation/instagram/service/reelverification/ReelScanRunner.java`
- Test: `InstagramAutomation/src/test/java/com/automation/instagram/service/reelverification/ReelVerificationServiceTest.java`
- Test: `InstagramAutomation/src/test/java/com/automation/instagram/service/reelverification/ReelScanRunnerTest.java`

- [ ] **Step 1 : Écrire le test avec mocks**

Cas à couvrir :
1. `startScan(6)` avec 0 posts récents → retourne ScanRun avec `total=0, status=COMPLETED` immédiat.
2. `startScan(6)` avec 2 usernames → lance scan async, chaque username déclenche `checkNow` puis `fetchReelsStats` → ordre des appels vérifié.
3. Retry × 1 : `checkNow` throw une fois, succès au retry → le scan continue, entries de ce user vérifiées normalement.
4. Double échec `checkNow` : `scanRun.errors` incrémenté, entries de ce user **non modifiées**, les autres usernames continuent.
5. 404 sur `checkNow` : entries marquées `MISSING` (le compte IG est invalide/privé).
6. `verifyOneEntry(entryId)` : lit l'entry, fait checkNow + fetchReelsStats + match, persiste, retourne l'entry modifiée.
7. `verifyOneEntry` avec entryId inconnu → throw `NoSuchElementException`.

Gabarit (partiel) :
```java
@ExtendWith(MockitoExtension.class)
class ReelVerificationServiceTest {

    @Mock PostingHistoryRepository postingHistoryRepo;
    @Mock AccountRepository accountRepo;
    @Mock ScraperCheckNowClient checkNowClient;
    @Mock ScraperStatsClient statsClient;
    @Mock ReelMatcher matcher;
    @Mock ScanRunRegistry registry;

    // Exécuter @Async en synchrone pour les tests :
    // fournir un Executor.directExecutor() ou tester startScan en mode synchrone via
    // un séparateur de méthode (runScanInternal) directement appelé.

    @Test
    void startScan_emptyWindow_completesImmediately() { /* ... */ }

    @Test
    void startScan_twoUsers_callsCheckNowBeforeFetch() { /* InOrder */ }

    @Test
    void runScanInternal_retryOnceAfterCheckNowFailure() { /* ... */ }

    @Test
    void runScanInternal_doubleFailure_incrementsErrorsAndContinues() { /* ... */ }

    @Test
    void runScanInternal_notFound_marksEntriesMissing() { /* ... */ }

    @Test
    void verifyOneEntry_happyPath() { /* ... */ }

    @Test
    void verifyOneEntry_unknownId_throws() { /* ... */ }
}
```

**Conseil design** : extraire la logique async du scan dans une méthode package-private `runScanInternal(UUID scanId, Map<String, List<PostingHistoryEntry>> byUsername)` testable sans executor. `startScan` prépare les données puis délègue à `@Async void runScanInternal(...)`.

- [ ] **Step 2 : Run — échec attendu (classe absente)**

Run:
```bash
./mvnw test -Dtest=ReelVerificationServiceTest
```
Expected: compile error.

- [ ] **Step 3 : Implémenter `ReelVerificationService`**

Ce service ne porte **plus** la méthode `@Async` — il délègue à `ReelScanRunner` (Step 3b) pour éviter le piège proxy AOP. Il garde : `startScan` (préparation + kick-off async), `verifyOneEntry` (synchrone), `listMissing`, et la méthode utilitaire `verifyAccount` (package-private, réutilisée par `ReelScanRunner`).

```java
package com.automation.instagram.service.reelverification;

import com.automation.instagram.model.InstagramAccount;
import com.automation.instagram.model.mongo.PostingHistoryEntry;
import com.automation.instagram.model.mongo.VerificationStatus;
import com.automation.instagram.repository.AccountRepository;
import com.automation.instagram.repository.PostingHistoryRepository;
import com.automation.instagram.service.reelstats.scraper.ScraperAccountReelsStats;
import com.automation.instagram.service.reelstats.scraper.ScraperReelStatsDto;
import com.automation.instagram.service.reelstats.scraper.ScraperStatsClient;
import com.automation.instagram.service.reelstats.scraper.ScraperStatsException;
import com.automation.instagram.service.reelverification.scraper.ScraperCheckNowClient;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class ReelVerificationService {

    private final PostingHistoryRepository postingHistoryRepo;
    private final AccountRepository accountRepo;
    private final ScraperCheckNowClient checkNowClient;
    private final ScraperStatsClient statsClient;
    private final ReelMatcher matcher;
    private final ScanRunRegistry registry;
    private final ReelScanRunner runner;   // bean séparé, porte @Async

    /** Démarre un scan (idempotent si un scan tourne déjà). Retourne immédiatement. */
    public ScanRun startScan(int lookbackHours) {
        LocalDateTime threshold = LocalDateTime.now().minusHours(lookbackHours);
        List<PostingHistoryEntry> recent = postingHistoryRepo.findByPostedAtAfter(threshold);

        Set<String> activeUsernames = accountRepo.findByStatus(InstagramAccount.AccountStatus.ACTIVE)
                .stream().map(InstagramAccount::getUsername).collect(Collectors.toSet());

        Map<String, List<PostingHistoryEntry>> byUser = recent.stream()
                .filter(e -> activeUsernames.contains(e.getUsername()))
                .collect(Collectors.groupingBy(PostingHistoryEntry::getUsername));

        ScanRun run = registry.startOrGet(byUser.size());
        log.info("Scan vérification démarré — scanId={}, fenêtre={}h, comptes={}",
                run.id(), lookbackHours, byUser.size());

        if (byUser.isEmpty()) {
            registry.complete(run.id());
            return registry.get(run.id()).orElse(run);
        }

        // Délègue à un bean séparé pour que @Async soit pris en compte par le proxy Spring.
        runner.runAsync(run.id(), byUser);
        return run;
    }

    /**
     * Vérifie un username (check-now + fetch + match + persist). Retry × 1 sur checkNow.
     * Throw {@link ScraperStatsException.NotFoundException} si le compte est inconnu du scraper
     * (le caller décide du marquage MISSING). Throw le reste sur double échec transport/auth.
     * Package-private : appelé par ReelScanRunner.
     */
    void verifyAccount(String username, List<PostingHistoryEntry> entries) throws InterruptedException {
        ScraperCheckNowClient.CheckNowResult cn;
        try {
            cn = checkNowClient.checkNow(username);
        } catch (ScraperStatsException.NotFoundException e) {
            throw e;  // propagation → marquage MISSING côté caller
        } catch (Exception first) {
            log.debug("Compte '{}' : 1er checkNow KO ({}) — retry", username, first.getMessage());
            cn = checkNowClient.checkNow(username);  // 1 retry, peut re-throw
        }
        log.info("Compte '{}' : check-now OK, success={}, reelsTouched={}",
                username, cn.success(), cn.reelsTouched());

        ScraperAccountReelsStats stats = statsClient.fetchReelsStats(username);
        List<ScraperReelStatsDto> reels = stats.reels() != null ? stats.reels() : List.of();

        List<MatchResult> results = matcher.match(entries, reels);
        LocalDateTime now = LocalDateTime.now();
        for (MatchResult r : results) {
            r.entry().setVerificationStatus(r.status());
            r.entry().setVerifiedAt(now);
            r.entry().setMatchedShortcode(r.matchedShortcode());
            if (r.status() == VerificationStatus.MISSING) {
                log.info("Reel MISSING détecté — username={}, postedAt={}, entryId={}",
                        r.entry().getUsername(), r.entry().getPostedAt(), r.entry().getId());
            }
        }
        postingHistoryRepo.saveAll(results.stream().map(MatchResult::entry).toList());
    }

    /** Re-vérifie une seule entry (synchrone, ~3s). Utilisé par l'endpoint recheck ET par le listener post-workflow. */
    public PostingHistoryEntry verifyOneEntry(String entryId) throws InterruptedException {
        PostingHistoryEntry entry = postingHistoryRepo.findById(entryId)
                .orElseThrow(() -> new NoSuchElementException("Entry introuvable : " + entryId));
        try {
            verifyAccount(entry.getUsername(), List.of(entry));
        } catch (ScraperStatsException.NotFoundException nf) {
            entry.setVerificationStatus(VerificationStatus.MISSING);
            entry.setVerifiedAt(LocalDateTime.now());
            entry.setMatchedShortcode(null);
            postingHistoryRepo.save(entry);
        }
        return entry;
    }

    /** Renvoie les entries MISSING dans la fenêtre (utilisé par GET /missing). */
    public List<PostingHistoryEntry> listMissing(int lookbackHours) {
        LocalDateTime threshold = LocalDateTime.now().minusHours(lookbackHours);
        return postingHistoryRepo.findByPostedAtAfter(threshold).stream()
                .filter(e -> e.getVerificationStatus() == VerificationStatus.MISSING)
                .sorted(Comparator.comparing(PostingHistoryEntry::getPostedAt).reversed())
                .toList();
    }
}
```

- [ ] **Step 3b : Implémenter `ReelScanRunner` (bean séparé, porte `@Async`)**

```java
package com.automation.instagram.service.reelverification;

import com.automation.instagram.model.mongo.PostingHistoryEntry;
import com.automation.instagram.model.mongo.VerificationStatus;
import com.automation.instagram.repository.PostingHistoryRepository;
import com.automation.instagram.service.reelstats.scraper.ScraperStatsException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Runner asynchrone du scan global. Séparé de {@link ReelVerificationService} car
 * {@code @Async} requiert un appel via proxy Spring — impossible en self-invocation.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ReelScanRunner {

    private final ReelVerificationService service;
    private final PostingHistoryRepository postingHistoryRepo;
    private final ScanRunRegistry registry;

    @Async
    public void runAsync(UUID scanId, Map<String, List<PostingHistoryEntry>> byUser) {
        try {
            runInternal(scanId, byUser);
        } catch (Exception e) {
            log.error("Scan {} échec global : {}", scanId, e.getMessage(), e);
            registry.fail(scanId, e.getMessage());
        }
    }

    /** Package-private pour être testé en synchrone (sans executor). */
    void runInternal(UUID scanId, Map<String, List<PostingHistoryEntry>> byUser) {
        int done = 0, errors = 0, missing = 0;
        for (Map.Entry<String, List<PostingHistoryEntry>> e : byUser.entrySet()) {
            String username = e.getKey();
            List<PostingHistoryEntry> entries = e.getValue();
            try {
                service.verifyAccount(username, entries);
                long miss = entries.stream()
                        .filter(pe -> pe.getVerificationStatus() == VerificationStatus.MISSING).count();
                missing += (int) miss;
                done++;
            } catch (ScraperStatsException.NotFoundException nf) {
                entries.forEach(en -> {
                    en.setVerificationStatus(VerificationStatus.MISSING);
                    en.setVerifiedAt(LocalDateTime.now());
                    en.setMatchedShortcode(null);
                });
                postingHistoryRepo.saveAll(entries);
                missing += entries.size();
                done++;
                log.info("Compte '{}' inconnu côté scraper : entries marquées MISSING", username);
            } catch (InterruptedException ie) {
                Thread.currentThread().interrupt();
                errors++;
                log.warn("Compte '{}' : scan interrompu", username);
            } catch (Exception ex) {
                errors++;
                log.warn("Compte '{}' : scraper KO après retry, scan ignoré — {}", username, ex.getMessage());
            }
            registry.updateProgress(scanId, done, errors, missing);
        }
        registry.complete(scanId);
        int verified = Math.max(0, done - errors - missing);
        log.info("Scan terminé — scanId={}, verified={}, missing={}, errors={}",
                scanId, verified, missing, errors);
    }
}
```

- [ ] **Step 4 : Écrire un test `ReelScanRunnerTest`**

Test focalisé sur `runInternal(...)` (appelable synchroniquement) :
- iter sur plusieurs usernames → `verifyAccount` appelé une fois par user
- si `verifyAccount` throw `NotFoundException` pour un user → entries de ce user persistés en MISSING, `done++`
- si `verifyAccount` throw `TransportException` → `errors++`, entries **non** modifiés, itération continue pour les autres users
- les compteurs du `ScanRun` sont mis à jour après chaque user (via `registry.updateProgress`)
- `registry.complete(scanId)` est appelé en fin.

- [ ] **Step 5 : Run les tests — doivent passer**

Run:
```bash
./mvnw test -Dtest=ReelVerificationServiceTest
./mvnw test -Dtest=ReelScanRunnerTest
```
Expected: PASS (7 cas service + 4 cas runner). Si un test échoue, vérifier que les mocks sont cohérents avec la signature réelle implémentée.

- [ ] **Step 6 : Run toute la suite**

Run:
```bash
./mvnw test
```
Expected: PASS.

- [ ] **Step 7 : Commit**

```bash
git add src/main/java/com/automation/instagram/service/reelverification/ReelVerificationService.java \
        src/main/java/com/automation/instagram/service/reelverification/ReelScanRunner.java \
        src/test/java/com/automation/instagram/service/reelverification/ReelVerificationServiceTest.java \
        src/test/java/com/automation/instagram/service/reelverification/ReelScanRunnerTest.java
git commit -m "feat(reel-verification): add ReelVerificationService + async ReelScanRunner"
```

---

### Task 3.5 — Créer `ReelVerificationEventListener` (@Async + délai 60s)

**Context:** Listener qui reçoit `ReelPostedEvent` et planifie `verifyOneEntry(...)` 60s plus tard via `TaskScheduler`.

**Files:**
- Create: `InstagramAutomation/src/main/java/com/automation/instagram/service/reelverification/ReelVerificationEventListener.java`
- Modify: `InstagramAutomation/src/main/java/com/automation/instagram/config/ReelStatsAsyncConfig.java` (ajouter un `TaskScheduler` bean si absent)
- Test: `InstagramAutomation/src/test/java/com/automation/instagram/service/reelverification/ReelVerificationEventListenerTest.java`

- [ ] **Step 1 : Vérifier la présence / absence d'un bean `TaskScheduler`**

Run:
```bash
grep -rn "TaskScheduler\|ThreadPoolTaskScheduler" src/main/java/com/automation/instagram/config/
```
S'il n'y a pas de bean `TaskScheduler`, en ajouter un dans `ReelStatsAsyncConfig.java` :
```java
@Bean(name = "reelVerificationScheduler")
public TaskScheduler reelVerificationScheduler() {
    ThreadPoolTaskScheduler s = new ThreadPoolTaskScheduler();
    s.setPoolSize(2);
    s.setThreadNamePrefix("reel-verif-");
    s.initialize();
    return s;
}
```

- [ ] **Step 2 : Écrire le test du listener**

Idée : mocker `TaskScheduler` et vérifier qu'il reçoit un `Runnable` + un `Instant` ≈ `now + 60s` (tolérance quelques secondes).
```java
@Test
void onReelPosted_schedulesVerifyAfter60s() {
    ReelVerificationService service = mock(ReelVerificationService.class);
    TaskScheduler scheduler = mock(TaskScheduler.class);
    ReelVerificationEventListener listener = new ReelVerificationEventListener(service, scheduler);

    LocalDateTime now = LocalDateTime.now();
    ReelPostedEvent event = new ReelPostedEvent("alice", "entry-42", now);

    listener.onReelPosted(event);

    ArgumentCaptor<Instant> whenCaptor = ArgumentCaptor.forClass(Instant.class);
    verify(scheduler).schedule(any(Runnable.class), whenCaptor.capture());
    Instant scheduledFor = whenCaptor.getValue();
    Instant expected = Instant.now().plusSeconds(60);
    assertTrue(Math.abs(scheduledFor.toEpochMilli() - expected.toEpochMilli()) < 5000);
}
```

- [ ] **Step 3 : Run — échec attendu**

Run:
```bash
./mvnw test -Dtest=ReelVerificationEventListenerTest
```
Expected: compile error.

- [ ] **Step 4 : Implémenter le listener**

```java
package com.automation.instagram.service.reelverification;

import com.automation.instagram.event.ReelPostedEvent;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.TaskScheduler;
import org.springframework.stereotype.Component;

import java.time.Instant;

@Slf4j
@Component
public class ReelVerificationEventListener {

    private final ReelVerificationService service;
    private final TaskScheduler scheduler;

    public ReelVerificationEventListener(ReelVerificationService service,
                                         @Qualifier("reelVerificationScheduler") TaskScheduler scheduler) {
        this.service = service;
        this.scheduler = scheduler;
    }

    @EventListener
    public void onReelPosted(ReelPostedEvent event) {
        Instant runAt = Instant.now().plusSeconds(60);
        log.debug("Vérification post-publication planifiée pour entry={} à {}",
                event.postingHistoryEntryId(), runAt);
        scheduler.schedule(() -> {
            try {
                service.verifyOneEntry(event.postingHistoryEntryId());
            } catch (Exception e) {
                log.error("Vérification post-publication KO pour entry={} : {}",
                        event.postingHistoryEntryId(), e.getMessage(), e);
            }
        }, runAt);
    }
}
```

- [ ] **Step 5 : Run les tests**

Run:
```bash
./mvnw test -Dtest=ReelVerificationEventListenerTest
```
Expected: PASS.

- [ ] **Step 6 : Run la suite complète**

Run:
```bash
./mvnw test
```
Expected: PASS.

- [ ] **Step 7 : Commit**

```bash
git add src/main/java/com/automation/instagram/service/reelverification/ReelVerificationEventListener.java \
        src/main/java/com/automation/instagram/config/ReelStatsAsyncConfig.java \
        src/test/java/com/automation/instagram/service/reelverification/ReelVerificationEventListenerTest.java
git commit -m "feat(reel-verification): add async event listener with 60s delay"
```

---

## Chunk 4 : Automation — controller REST + wiring PostReelWorkflow

### Task 4.1 — Créer le controller `ReelVerificationController` et ses DTOs de réponse

**Context:** 4 endpoints exposés au Dashboard.

**Files:**
- Create: `InstagramAutomation/src/main/java/com/automation/instagram/controller/ReelVerificationController.java`
- Create: `InstagramAutomation/src/main/java/com/automation/instagram/dto/reelverification/ScanStartResponse.java`
- Create: `InstagramAutomation/src/main/java/com/automation/instagram/dto/reelverification/ScanRunSnapshot.java`
- Create: `InstagramAutomation/src/main/java/com/automation/instagram/dto/reelverification/MissingReelView.java`
- Create: `InstagramAutomation/src/main/java/com/automation/instagram/dto/reelverification/RecheckRequest.java`
- Create: `InstagramAutomation/src/main/java/com/automation/instagram/dto/reelverification/RecheckResponse.java`
- Test: `InstagramAutomation/src/test/java/com/automation/instagram/controller/ReelVerificationControllerTest.java`

- [ ] **Step 1 : Créer les DTOs**

```java
// ScanStartResponse.java
public record ScanStartResponse(UUID scanId, int total, Instant startedAt) {}

// ScanRunSnapshot.java
public record ScanRunSnapshot(
    UUID scanId, ScanStatus status, int total, int done, int errors, int missingCount,
    Instant startedAt, Instant finishedAt, String error
) {
    public static ScanRunSnapshot of(ScanRun r) {
        return new ScanRunSnapshot(r.id(), r.status(), r.total(), r.done(), r.errors(),
                r.missingCount(), r.startedAt(), r.finishedAt(), r.error());
    }
}

// MissingReelView.java
// Note : le spec (ligne 237) mentionne un champ optionnel `device?`. Dropped ici : PostingHistoryEntry
// n'a pas de deviceUdid, et la feature n'exige pas de l'exposer au MVP. À rajouter plus tard si le
// besoin ressort, en joinant via AccountRepository.findByUsername → InstagramAccount.deviceUdid.
public record MissingReelView(
    String entryId, String username, String baseVideo, LocalDateTime postedAt,
    VerificationStatus verificationStatus, LocalDateTime verifiedAt, String matchedShortcode
) {
    public static MissingReelView of(PostingHistoryEntry e) {
        return new MissingReelView(e.getId(), e.getUsername(), e.getBaseVideo(), e.getPostedAt(),
                e.getVerificationStatus(), e.getVerifiedAt(), e.getMatchedShortcode());
    }
}

// RecheckRequest.java
public record RecheckRequest(String entryId) {}

// RecheckResponse.java
public record RecheckResponse(
    String entryId, VerificationStatus verificationStatus,
    LocalDateTime verifiedAt, String matchedShortcode
) {
    public static RecheckResponse of(PostingHistoryEntry e) {
        return new RecheckResponse(e.getId(), e.getVerificationStatus(),
                e.getVerifiedAt(), e.getMatchedShortcode());
    }
}
```

- [ ] **Step 2 : Écrire le test du controller avec MockMvc**

Note convention : le projet n'a pas d'autre test de controller en `@WebMvcTest` à l'heure actuelle (`AccountControllerTest` est en pur Mockito). Utiliser `@WebMvcTest(ReelVerificationController.class)` + `@MockBean` pour ce test est acceptable et plus propre qu'un pur unit Mockito — on vérifie le wiring MVC complet (chemins, JSON, codes HTTP).

Squelette complet :
```java
package com.automation.instagram.controller;

import com.automation.instagram.dto.reelverification.*;
import com.automation.instagram.model.mongo.PostingHistoryEntry;
import com.automation.instagram.model.mongo.VerificationStatus;
import com.automation.instagram.service.reelverification.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(ReelVerificationController.class)
class ReelVerificationControllerTest {

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper om;
    @MockBean ReelVerificationService service;
    @MockBean ScanRunRegistry registry;

    @Test
    void startScan_returnsScanStartResponse() throws Exception {
        UUID id = UUID.randomUUID();
        when(service.startScan(6)).thenReturn(ScanRun.start(id, 3));
        mvc.perform(post("/api/automation/reel-verification/scan?hours=6"))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$.scanId").value(id.toString()))
           .andExpect(jsonPath("$.total").value(3));
    }

    @Test
    void getScan_unknownId_returns404() throws Exception {
        when(registry.get(any())).thenReturn(Optional.empty());
        mvc.perform(get("/api/automation/reel-verification/scan/{id}", UUID.randomUUID()))
           .andExpect(status().isNotFound());
    }

    @Test
    void getScan_knownId_returnsSnapshot() throws Exception {
        UUID id = UUID.randomUUID();
        ScanRun r = new ScanRun(id, ScanStatus.COMPLETED, 5, 5, 0, 1,
                Instant.now(), Instant.now(), null);
        when(registry.get(id)).thenReturn(Optional.of(r));
        mvc.perform(get("/api/automation/reel-verification/scan/{id}", id))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$.status").value("COMPLETED"))
           .andExpect(jsonPath("$.missingCount").value(1));
    }

    @Test
    void missing_returnsArray() throws Exception {
        PostingHistoryEntry e = PostingHistoryEntry.builder()
                .id("e1").username("alice").baseVideo("vid1")
                .postedAt(LocalDateTime.now())
                .verificationStatus(VerificationStatus.MISSING)
                .verifiedAt(LocalDateTime.now())
                .build();
        when(service.listMissing(6)).thenReturn(List.of(e));
        mvc.perform(get("/api/automation/reel-verification/missing?hours=6"))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$[0].entryId").value("e1"))
           .andExpect(jsonPath("$[0].verificationStatus").value("MISSING"));
    }

    @Test
    void recheck_knownEntry_returnsResponse() throws Exception {
        PostingHistoryEntry updated = PostingHistoryEntry.builder()
                .id("e42").username("alice")
                .verificationStatus(VerificationStatus.VERIFIED)
                .matchedShortcode("ABC123")
                .verifiedAt(LocalDateTime.now())
                .build();
        when(service.verifyOneEntry("e42")).thenReturn(updated);
        mvc.perform(post("/api/automation/reel-verification/recheck")
                .contentType(MediaType.APPLICATION_JSON)
                .content(om.writeValueAsString(new RecheckRequest("e42"))))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$.verificationStatus").value("VERIFIED"))
           .andExpect(jsonPath("$.matchedShortcode").value("ABC123"));
    }

    @Test
    void recheck_unknownEntry_returns404() throws Exception {
        when(service.verifyOneEntry("nope")).thenThrow(new java.util.NoSuchElementException("x"));
        mvc.perform(post("/api/automation/reel-verification/recheck")
                .contentType(MediaType.APPLICATION_JSON)
                .content(om.writeValueAsString(new RecheckRequest("nope"))))
           .andExpect(status().isNotFound());
    }

    @Test
    void startScan_idempotent_returnsExistingScanIdWhenOneIsRunning() throws Exception {
        // Le comportement d'idempotence vit dans ScanRunRegistry, pas dans le controller.
        // Ce test vérifie juste que le controller appelle service.startScan deux fois et retourne
        // le scanId renvoyé à chaque fois (cohérent même si le même id revient).
        UUID id = UUID.randomUUID();
        when(service.startScan(6)).thenReturn(ScanRun.start(id, 1));
        mvc.perform(post("/api/automation/reel-verification/scan?hours=6")).andExpect(status().isOk());
        mvc.perform(post("/api/automation/reel-verification/scan?hours=6"))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$.scanId").value(id.toString()));
    }
}
```

- [ ] **Step 3 : Run — échec attendu**

Run:
```bash
./mvnw test -Dtest=ReelVerificationControllerTest
```
Expected: compile error.

- [ ] **Step 4 : Implémenter `ReelVerificationController`**

```java
package com.automation.instagram.controller;

import com.automation.instagram.dto.reelverification.*;
import com.automation.instagram.model.mongo.PostingHistoryEntry;
import com.automation.instagram.service.reelverification.ReelVerificationService;
import com.automation.instagram.service.reelverification.ScanRun;
import com.automation.instagram.service.reelverification.ScanRunRegistry;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@Slf4j
@RestController
@RequestMapping("/api/automation/reel-verification")
@RequiredArgsConstructor
public class ReelVerificationController {

    private final ReelVerificationService service;
    private final ScanRunRegistry registry;

    @PostMapping("/scan")
    public ResponseEntity<ScanStartResponse> startScan(
            @RequestParam(defaultValue = "6") int hours) {
        ScanRun run = service.startScan(hours);
        return ResponseEntity.ok(new ScanStartResponse(run.id(), run.total(), run.startedAt()));
    }

    @GetMapping("/scan/{scanId}")
    public ResponseEntity<ScanRunSnapshot> getScan(@PathVariable UUID scanId) {
        return registry.get(scanId)
                .map(r -> ResponseEntity.ok(ScanRunSnapshot.of(r)))
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @GetMapping("/missing")
    public List<MissingReelView> missing(@RequestParam(defaultValue = "6") int hours) {
        return service.listMissing(hours).stream().map(MissingReelView::of).toList();
    }

    @PostMapping("/recheck")
    public ResponseEntity<RecheckResponse> recheck(@RequestBody RecheckRequest body) {
        try {
            PostingHistoryEntry updated = service.verifyOneEntry(body.entryId());
            return ResponseEntity.ok(RecheckResponse.of(updated));
        } catch (java.util.NoSuchElementException e) {
            return ResponseEntity.notFound().build();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return ResponseEntity.internalServerError().build();
        }
    }
}
```

- [ ] **Step 5 : Run les tests**

Run:
```bash
./mvnw test -Dtest=ReelVerificationControllerTest
```
Expected: PASS (7 cas).

- [ ] **Step 6 : Run la suite complète**

Run:
```bash
./mvnw test
```
Expected: PASS.

- [ ] **Step 7 : Commit**

```bash
git add src/main/java/com/automation/instagram/controller/ReelVerificationController.java \
        src/main/java/com/automation/instagram/dto/reelverification/ \
        src/test/java/com/automation/instagram/controller/ReelVerificationControllerTest.java
git commit -m "feat(reel-verification): expose 4 REST endpoints for dashboard"
```

---

### Task 4.2 — Wiring : `PostReelWorkflow.onAfterExecute` publie `ReelPostedEvent`

**Context:** Dans le bloc qui appelle `postingHistoryService.markAsPosted(...)` (lignes ~345-377 de `PostReelWorkflow.java`), récupérer le retour et publier l'event. Try/catch englobant pour ne jamais faire échouer le workflow.

**Files:**
- Modify: `InstagramAutomation/src/main/java/com/automation/instagram/workflow/impl/PostReelWorkflow.java`

- [ ] **Step 1 : Identifier le champ / injection d'`ApplicationEventPublisher` dans PostReelWorkflow**

Run:
```bash
grep -n "ApplicationEventPublisher\|@Autowired\|@RequiredArgsConstructor\|private final" \
  src/main/java/com/automation/instagram/workflow/impl/PostReelWorkflow.java | head -20
```
D'après exploration : la classe est `@Component` + `@RequiredArgsConstructor` (Lombok génère le constructor depuis tous les `private final`). `ApplicationEventPublisher` n'est **pas** encore injecté.

- [ ] **Step 2 : Ajouter l'injection de `ApplicationEventPublisher` AVANT de l'utiliser**

Dans `PostReelWorkflow.java`, ajouter l'import et le champ :
```java
import org.springframework.context.ApplicationEventPublisher;
import com.automation.instagram.event.ReelPostedEvent;
import com.automation.instagram.model.mongo.PostingHistoryEntry;

// ... dans la liste des champs final existants ...
private final ApplicationEventPublisher applicationEventPublisher;
```
Grâce à `@RequiredArgsConstructor`, le constructor est régénéré automatiquement.

- [ ] **Step 3 : Modifier `onAfterExecute` (bloc autour ligne 350)**

Remplacer le bloc existant de l'étape `"PostReel"` (en préservant la logique `"PostStory"` juste après) :
```java
result.getStepResults().stream()
        .filter(sr -> "PostReel".equals(sr.getStepName()) && sr.isSuccess())
        .findFirst()
        .ifPresent(sr -> {
            String postingUsername = context.get("postingUsername", String.class);
            String baseVideoName = context.get("baseVideoName", String.class);
            String postingTemplate = context.get("postingTemplate", String.class);
            String driveFilename = context.get("driveFilename", String.class);

            if (postingUsername != null && baseVideoName != null) {
                // markAsPosted peut toujours throw — comportement inchangé par rapport à la version actuelle.
                PostingHistoryEntry entry = postingHistoryService.markAsPosted(
                        postingUsername, baseVideoName, postingTemplate, driveFilename);
                log.info("[{}] Vidéo marquée dans l'historique de posting: baseVideo={}",
                        postingUsername, baseVideoName);

                // Publication de l'event — best-effort, JAMAIS bloquant pour le workflow.
                // try/catch restreint uniquement à publishEvent : on NE swallow PAS les erreurs
                // de markAsPosted (qui signalent un vrai problème de persistance Mongo).
                try {
                    applicationEventPublisher.publishEvent(
                            new ReelPostedEvent(entry.getUsername(), entry.getId(), entry.getPostedAt()));
                } catch (Exception ex) {
                    log.warn("[{}] Publication ReelPostedEvent échouée — {}",
                            postingUsername, ex.getMessage());
                }
            }
        });
```

- [ ] **Step 4 : Compile**

Run:
```bash
./mvnw compile
```
Expected: BUILD SUCCESS.

- [ ] **Step 5 : Run les tests existants de `PostReelWorkflow` (ou test d'intégration de workflow)**

Run:
```bash
grep -rln "PostReelWorkflow" src/test/java/
```
Si un test existe, le faire tourner. Vérifier que l'ajout du `publishEvent` ne casse rien.
```bash
./mvnw test
```
Expected: PASS.

- [ ] **Step 6 : Test d'intégration end-to-end (optionnel mais recommandé)**

Créer un test `ReelVerificationIntegrationTest` avec `@SpringBootTest` qui :
1. Publie manuellement un `ReelPostedEvent`.
2. Utilise `awaitility` avec un `@MockBean` `ReelVerificationService` pour vérifier que `verifyOneEntry` est appelé dans la minute.

Gabarit :
```java
@SpringBootTest
class ReelVerificationIntegrationTest {
    @Autowired ApplicationEventPublisher publisher;
    @MockBean ReelVerificationService service;

    @Test
    void eventTriggers_verifyOneEntry_within75s() {
        publisher.publishEvent(new ReelPostedEvent("alice", "entry-1", LocalDateTime.now()));
        await().atMost(75, SECONDS).untilAsserted(() ->
            verify(service).verifyOneEntry("entry-1"));
    }
}
```
Si le test est trop lent (60s de délai volontaire), le laisser désactivé via `@Disabled` mais gardé en référence.

- [ ] **Step 7 : Commit**

```bash
git add src/main/java/com/automation/instagram/workflow/impl/PostReelWorkflow.java \
        src/test/java/com/automation/instagram/service/reelverification/ReelVerificationIntegrationTest.java
git commit -m "feat(workflow): publish ReelPostedEvent after successful reel post"
```

---

## Chunk 5 : Dashboard — page, hooks, route, sidebar

### Task 5.1 — Créer les hooks React Query `useReelVerification.js`

**Files:**
- Create: `InstagramDashboard/src/hooks/useReelVerification.js`

- [ ] **Step 1 : Écrire le module**

```javascript
// InstagramDashboard/src/hooks/useReelVerification.js
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost } from '@/lib/api'

const BASE = '/api/automation/reel-verification'

export function useStartScan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (hours) => apiPost(`${BASE}/scan?hours=${hours}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reel-verification', 'missing'] })
    },
  })
}

/**
 * Poll le statut d'un scan toutes les 2s tant qu'il est RUNNING.
 * Stoppe automatiquement quand status != RUNNING ou quand scanId est falsy.
 */
export function useScanStatus(scanId) {
  return useQuery({
    queryKey: ['reel-verification', 'scan', scanId],
    queryFn: () => apiGet(`${BASE}/scan/${scanId}`),
    enabled: !!scanId,
    refetchInterval: (query) => {
      const data = query.state.data
      if (!data || data.status === 'RUNNING') return 2000
      return false
    },
    retry: 3,
  })
}

export function useMissingReels(hours) {
  return useQuery({
    queryKey: ['reel-verification', 'missing', hours],
    queryFn: () => apiGet(`${BASE}/missing?hours=${hours}`),
    staleTime: 10 * 1000,
  })
}

export function useRecheckOne() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (entryId) => apiPost(`${BASE}/recheck`, { entryId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reel-verification', 'missing'] })
    },
  })
}
```

- [ ] **Step 2 : Commit**

```bash
cd /Users/samyhne/IG-bot/InstagramDashboard
git add src/hooks/useReelVerification.js
git commit -m "feat(reel-verification): add React Query hooks for the feature"
```

---

### Task 5.2 — Créer la page `ReelVerification.jsx`

**Files:**
- Create: `InstagramDashboard/src/pages/ReelVerification.jsx`

- [ ] **Step 1 : Lire un exemple de page existante (PostingHistory.jsx) pour reproduire le style et les patterns**

Run:
```bash
cat src/pages/PostingHistory.jsx | head -200
```
Noter : header, KPI row, filtres, DataTable, dialog.

- [ ] **Step 2 : Écrire la page**

```jsx
// InstagramDashboard/src/pages/ReelVerification.jsx
import { useState, useEffect, useMemo } from 'react'
import { toast } from 'sonner'
import {
  useStartScan, useScanStatus, useMissingReels, useRecheckOne,
} from '@/hooks/useReelVerification'
import DataTable from '@/components/shared/DataTable'
import EmptyState from '@/components/shared/EmptyState'
import TimeAgo from '@/components/shared/TimeAgo'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ShieldCheck, RefreshCw, CheckCircle2, AlertCircle, Clock,
} from 'lucide-react'

const WINDOWS = [
  { value: 1,  label: '1 heure' },
  { value: 6,  label: '6 heures' },
  { value: 24, label: '24 heures' },
]

export default function ReelVerification() {
  const [hours, setHours] = useState(6)
  const [scanId, setScanId] = useState(null)

  const startScan = useStartScan()
  const scanStatus = useScanStatus(scanId)
  const missing = useMissingReels(hours)
  const recheck = useRecheckOne()

  // Sync scanId quand le scan se termine : reset au bout de 5s pour cacher le spinner
  useEffect(() => {
    const status = scanStatus.data?.status
    if (!scanId || !status) return
    if (status !== 'RUNNING') {
      const id = setTimeout(() => setScanId(null), 5000)
      const errors = scanStatus.data.errors ?? 0
      const missingCount = scanStatus.data.missingCount ?? 0
      if (status === 'COMPLETED') {
        toast.success(`Scan terminé — ${missingCount} manquant(s)${errors > 0 ? `, ${errors} erreur(s)` : ''}`)
      } else if (status === 'FAILED') {
        toast.error(`Scan échoué — ${scanStatus.data.error || 'erreur inconnue'}`)
      }
      return () => clearTimeout(id)
    }
  }, [scanId, scanStatus.data?.status, scanStatus.data?.missingCount, scanStatus.data?.errors, scanStatus.data?.error])

  const handleScan = async () => {
    try {
      const resp = await startScan.mutateAsync(hours)
      if (resp?.locked) {
        toast.error('Système verrouillé, réessayer plus tard')
        return
      }
      if (resp?.total === 0) {
        toast.info('Aucun post récent dans la fenêtre — rien à scanner')
        return
      }
      setScanId(resp.scanId)
    } catch (e) {
      toast.error(`Scan impossible — ${e.message}`)
    }
  }

  const handleRecheck = async (entryId) => {
    try {
      const resp = await recheck.mutateAsync(entryId)
      if (resp?.verificationStatus === 'VERIFIED') {
        toast.success('Reel retrouvé sur Instagram')
      } else {
        toast.info('Toujours introuvable sur Instagram')
      }
    } catch (e) {
      toast.error(`Re-vérif KO — ${e.message}`)
    }
  }

  const scanRunning = scanStatus.data?.status === 'RUNNING'
  const records = Array.isArray(missing.data) ? missing.data : (missing.data?.data || [])
  const uniqueUsers = useMemo(
    () => new Set(records.map(r => r.username)).size,
    [records],
  )

  const columns = [
    {
      accessorKey: 'username',
      header: 'Compte',
      cell: ({ row }) => <span className="font-mono">@{row.original.username}</span>,
    },
    {
      accessorKey: 'baseVideo',
      header: 'Fichier',
      cell: ({ row }) => <span className="text-sm">{row.original.baseVideo}</span>,
    },
    {
      accessorKey: 'postedAt',
      header: 'Posté à',
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="text-sm">{new Date(row.original.postedAt).toLocaleTimeString('fr-FR')}</span>
          <TimeAgo date={row.original.postedAt} className="text-xs text-muted-foreground" />
        </div>
      ),
    },
    {
      accessorKey: 'verificationStatus',
      header: 'Statut',
      cell: () => (
        <Badge variant="destructive" className="gap-1">
          <AlertCircle className="h-3 w-3" />
          MANQUANT
        </Badge>
      ),
    },
    {
      id: 'action',
      header: '',
      cell: ({ row }) => (
        <Button
          size="sm"
          variant="outline"
          disabled={recheck.isPending}
          onClick={() => handleRecheck(row.original.entryId)}
        >
          <RefreshCw className="h-3 w-3 mr-1" />
          Re-vérifier
        </Button>
      ),
    },
  ]

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <ShieldCheck className="h-6 w-6" />
            Vérification Reels
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Comptes ACTIVE ayant posté récemment — vérifie la présence du reel sur Instagram.
          </p>
        </div>
      </div>

      {/* Controls */}
      <Card>
        <CardContent className="pt-6 flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Fenêtre :</span>
            <div className="flex gap-1">
              {WINDOWS.map(w => (
                <Button
                  key={w.value}
                  size="sm"
                  variant={hours === w.value ? 'default' : 'outline'}
                  onClick={() => setHours(w.value)}
                  disabled={scanRunning}
                >
                  {w.label}
                </Button>
              ))}
            </div>
          </div>

          <Button
            onClick={handleScan}
            disabled={scanRunning || startScan.isPending}
            className="ml-auto"
          >
            {scanRunning
              ? `Scan en cours… (${scanStatus.data?.done ?? 0}/${scanStatus.data?.total ?? 0})`
              : 'Scanner maintenant'}
          </Button>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <AlertCircle className="h-4 w-4" /> Reels manquants
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-3xl font-semibold">{records.length}</span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" /> Fenêtre
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-3xl font-semibold">{hours}h</span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Comptes concernés</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-3xl font-semibold">{uniqueUsers}</span>
          </CardContent>
        </Card>
      </div>

      {/* Table / empty state */}
      {missing.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : records.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="Aucun reel manquant"
          description="Tous les reels récents sont bien visibles sur Instagram."
        />
      ) : (
        <DataTable columns={columns} data={records} pageSize={25} />
      )}
    </div>
  )
}
```

- [ ] **Step 3 : Commit**

```bash
git add src/pages/ReelVerification.jsx
git commit -m "feat(dashboard): add ReelVerification page"
```

---

### Task 5.3 — Brancher la route et la sidebar

**Files:**
- Modify: `InstagramDashboard/src/App.jsx`
- Modify: `InstagramDashboard/src/components/layout/AppLayout.jsx`

- [ ] **Step 1 : Ajouter l'import lazy + la route dans `App.jsx`**

Chercher la section des imports `lazy` et des `<Route>` existants. Ajouter :
```jsx
const ReelVerification = lazy(() => import('@/pages/ReelVerification'))
```
Puis dans le bloc des routes (à l'intérieur de `AppLayout` / `ProtectedRoute`) :
```jsx
<Route
  path="/reel-verification"
  element={<LazyPage><ReelVerification /></LazyPage>}
/>
```
(Adapter selon le pattern exact du fichier : wrapper `<Suspense>` / composant `LazyPage`.)

- [ ] **Step 2 : Ajouter l'import d'icône et l'entrée sidebar dans `AppLayout.jsx`**

Ajouter `ShieldCheck` à la liste d'imports depuis `lucide-react`. Puis, dans l'objet de la section `MONITORING` de `NAV_SECTIONS` (array), ajouter :
```jsx
{ path: '/reel-verification', label: 'Vérification Reels', icon: ShieldCheck }
```

- [ ] **Step 3 : Lancer le dev server**

Run:
```bash
cd /Users/samyhne/IG-bot/InstagramDashboard
npm run dev
```
Expected: Vite démarre sur `http://localhost:5173`.

- [ ] **Step 4 : Test manuel bout-en-bout**

Prérequis : les 2 backends doivent être running :
```bash
# Terminal 1 — InstagramScraper
cd /Users/samyhne/IG-bot/InstagramScraper && ./mvnw spring-boot:run

# Terminal 2 — InstagramAutomation
cd /Users/samyhne/IG-bot/InstagramAutomation && ./mvnw spring-boot:run
```

**Checklist de test manuel :**
- [ ] Ouvrir `http://localhost:5173/reel-verification` après login
- [ ] La page s'affiche avec header « Vérification Reels »
- [ ] La sidebar contient l'entrée « Vérification Reels » sous `MONITORING`
- [ ] Sans posts récents → EmptyState « Aucun reel manquant » visible
- [ ] Cliquer « Scanner maintenant » avec fenêtre 24h :
  - [ ] Le bouton passe à « Scan en cours… (0/N) » puis progresse
  - [ ] À la fin : toast « Scan terminé — X manquant(s) »
  - [ ] Si des reels sont MISSING → liste apparaît
- [ ] Sur une ligne MISSING, cliquer « Re-vérifier » :
  - [ ] Si le reel est devenu visible sur IG → toast vert, ligne disparaît
  - [ ] Sinon → toast info, ligne reste
- [ ] Changer la fenêtre (1h / 6h / 24h) → la liste se met à jour
- [ ] Post-workflow auto-trigger : lancer un `PostReelWorkflow` → attendre 60-90s → vérifier que l'entry correspondant a bien `verificationStatus` écrit en base (via Mongo shell ou endpoint debug).

- [ ] **Step 5 : Lint**

Run:
```bash
npm run lint
```
Expected: aucune erreur sur les nouveaux fichiers. Warnings sur l'existant : ignorer.

- [ ] **Step 6 : Commit**

```bash
git add src/App.jsx src/components/layout/AppLayout.jsx
git commit -m "feat(dashboard): wire reel-verification route and sidebar entry"
```

---

## Checklist finale cross-project

Avant de clore le plan :

- [ ] Scraper : suite de tests verte (`./mvnw test` dans `/InstagramScraper`).
- [ ] Automation : suite de tests verte (`./mvnw test` dans `/InstagramAutomation`).
- [ ] Dashboard : `npm run lint` sans erreur, `npm run build` réussit.
- [ ] Test manuel : scan manuel fonctionne + auto-trigger post-workflow déclenche bien une vérification ~60s après un reel posté.
- [ ] Les 3 repos ont des commits séparés et clairs (un par task ou par chunk cohérent).

## Points de vigilance pour l'exécuteur

- **Conventions de commentaires** : code en anglais, **commentaires et logs en français**. Ne pas normaliser en anglais le français existant.
- **Ne PAS modifier** `src/pages/Actions.jsx` du Dashboard, qui a des modifs non-committées pré-existantes sans rapport avec cette feature.
- **Refactor `ScraperJwtTokenProvider` (Task 3.3)** : si le refactor s'avère risqué (casse les tests existants de `RawScraperStatsClient`), tomber dans le **plan B** (duplication de la gestion de token dans `ScraperCheckNowClient`) et ouvrir un TODO pour consolidation. Ne pas bloquer la feature sur un refactor esthétique.
- **`@EnableAsync` et `@EnableScheduling`** : sont probablement déjà activés dans le projet (`ReelStatsAsyncConfig`). Vérifier avant d'ajouter, ne pas dupliquer.
- **Délai 60s du listener post-workflow** : si lors du test manuel bout-en-bout on observe systématiquement des `MISSING` sur le trigger auto alors que le reel est bien présent après 90s, c'est que RapidAPI ne propage pas assez vite. Dans ce cas passer à 90s ou 120s (un champ `@Value("${reel-verification.post-workflow-delay-seconds:60}")` serait une amélioration propre — hors scope initial).
- **Concurrence scan manuel + auto-trigger** : si les deux modifient la même entry en même temps, le dernier gagne. Comportement acceptable.
