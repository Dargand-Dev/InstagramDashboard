// Cette couche ne modifie jamais les valeurs API : elle organise uniquement leur présentation.
export const SETTINGS_SECTIONS = [
  { id: 'publications', label: 'Publications', kicker: 'CONTENU', description: 'Quand publier, préparer les vidéos et conserver les médias.' },
  { id: 'accounts', label: 'Création de comptes', kicker: 'CRÉATION', description: 'Création automatique, profils et historique des comptes.' },
  { id: 'sms', label: 'SMS', kicker: 'VÉRIFICATION', description: 'Fournisseurs et règles de location des numéros.' },
  { id: 'identities', label: 'Identités', kicker: 'PROFILS', description: 'Photos et contenu associés aux identités.' },
  { id: 'connections', label: 'Connexions', kicker: 'SERVICES', description: 'Drive, scraper et autres services externes.' },
  { id: 'devices', label: 'Appareils', kicker: 'AUTOMATISATION', description: 'Connexion iOS, Appium et capacité d’exécution.' },
  { id: 'security', label: 'Sécurité', kicker: 'ACCÈS', description: 'Accès au tableau de bord, à l’API et aux secrets.' },
  { id: 'system', label: 'Système', kicker: 'EXPLOITATION', description: 'Serveur, journaux, supervision et réglages avancés.' },
]

const group = (id, section, label, description, keys, advanced = false) =>
  ({ id, section, label, description, keys, advanced })

const GROUPS = [
  group('publication-schedule', 'publications', 'Calendrier', 'Horaires et fuseau des publications.', ['scheduler.']),
  group('publication-history', 'publications', 'Réutilisation', 'Espacement des modèles de Reel.', ['posting-history.']),
  group('publication-video', 'publications', 'Préparation vidéo', 'Encodage et ressources utilisées pour les vidéos.', ['content-loop.ffmpeg-dir', 'content-loop.preset', 'content-loop.threads', 'content-loop.concurrency'], true),
  group('publication-video-timing', 'publications', 'Délais vidéo', 'Temps maximal et étalement des traitements.', ['content-loop.timeout-seconds', 'content-loop.spread-window-hours'], true),
  group('publication-stories', 'publications', 'Stories', 'Mise en avant des stories publiées.', ['story.']),
  group('publication-screenshots', 'publications', 'Captures', 'Enregistrement et conservation des captures.', ['screenshot.'], true),
  group('publication-reel-stats', 'publications', 'Statistiques des Reels', 'Stockage des aperçus des Reels.', ['reel-stats.'], true),
  group('accounts-auto-creation', 'accounts', 'Création automatique', 'Activation et valeurs par défaut pour les nouveaux appareils.', ['auto-creation.']),
  group('accounts-profile', 'accounts', 'Profil des comptes', 'Éléments ajoutés lors de la création.', ['profile.bio.']),
  group('accounts-history', 'accounts', 'Historique', 'Reconstitution et conservation de l’historique des comptes.', ['account-history.'], true),
  group('identities-pictures', 'identities', 'Photos de profil', 'Dossiers Drive utilisés selon l’identité.', ['profile.picture.']),
  group('sms-selection', 'sms', 'Valeurs initiales SMS', 'Valeurs initiales avant la première configuration SMS en base.', ['sms.providers', 'sms.provider', 'sms.fallback-providers'], true),
  group('sms-legacy', 'sms', 'Compatibilité GetAText', 'Ancienne clé conservée pour les installations existantes.', ['getatext.'], true),
  group('connection-google', 'connections', 'Google Drive', 'Mode de connexion et identifiants Google Drive.', ['google.drive.auth-mode', 'google.drive.credentials-path', 'google.drive.client-id', 'google.drive.client-secret']),
  group('connection-google-session', 'connections', 'Session Google Drive', 'Renouvellement et retour de la connexion OAuth.', ['google.drive.refresh-token', 'google.drive.oauth-redirect-uri'], true),
  group('connection-apify', 'connections', 'Apify', 'Compte et acteur utilisés pour récupérer les données.', ['apify.api-token', 'apify.actor-id', 'apify.base-url']),
  group('connection-apify-limits', 'connections', 'Limites Apify', 'Volume et durée des appels à Apify.', ['apify.results-limit', 'apify.timeout-seconds', 'apify.max-parallel-accounts'], true),
  group('connection-scraper', 'connections', 'Scraper', 'Connexion au service de statistiques.', ['scraper-stats.']),
  group('connection-scraper-sync', 'connections', 'Synchronisation', 'Rapprochement des comptes avec le scraper.', ['scraper-sync.'], true),
  group('connection-getmysocial', 'connections', 'GetMySocial', 'Connexion et équipe GetMySocial.', ['getmysocial.']),
  group('connection-discord', 'connections', 'Notifications Discord', 'Envoi des alertes par webhook.', ['discord-webhook.']),
  group('connection-captcha', 'connections', 'Captchas', 'Service utilisé pour résoudre les captchas.', ['captcha.'], true),
  group('connection-media', 'connections', 'Transfert des médias', 'Réception sécurisée des fichiers médias.', ['media-receiver.'], true),
  group('device-appium', 'devices', 'Appium', 'Adresse et ports du serveur Appium.', ['appium.default-host', 'appium.default-port', 'appium.max-ports'], true),
  group('device-ios-signing', 'devices', 'Signature iOS', 'Identifiants nécessaires pour lancer WebDriverAgent.', ['appium.ios.'], true),
  group('device-wda', 'devices', 'Récupération WDA', 'Relance de WebDriverAgent après un échec.', ['wda.'], true),
  group('device-ssh-access', 'devices', 'Accès SSH', 'Identifiants et port de connexion aux appareils.', ['device.ssh.user', 'device.ssh.password', 'device.ssh.port', 'device.ssh.usb-fallback-enabled'], true),
  group('device-ssh-timing', 'devices', 'Délais SSH', 'Connexion, inactivité et nettoyage des sessions.', ['device.ssh.connect-timeout-ms', 'device.ssh.idle-timeout-ms', 'device.ssh.reaper-interval-ms'], true),
  group('device-connectivity', 'devices', 'Surveillance des appareils', 'Rythme des vérifications de connectivité.', ['device.connectivity.'], true),
  group('device-execution', 'devices', 'Capacité d’exécution', 'Parallélisme et délai maximal des automatisations.', ['automation.execution.'], true),
  group('device-geo', 'devices', 'Contrôle géographique', 'Pays attendu et comportement si sa vérification échoue.', ['geo-ip-check.'], true),
  group('security-dashboard', 'security', 'Accès au tableau de bord', 'Identifiants et durée des sessions.', ['dashboard.auth.']),
  group('security-cors', 'security', 'Accès navigateur', 'Origines et méthodes autorisées pour l’API.', ['api.cors.'], true),
  group('security-server-errors', 'security', 'Détails des erreurs', 'Informations affichées dans les réponses d’erreur.', ['server.error.'], true),
  group('system-application', 'system', 'Application', 'Nom et profil Spring chargés au démarrage.', ['spring.application.', 'spring.profiles.'], true),
  group('system-database', 'system', 'Base de données', 'Connexion MongoDB et création des index.', ['spring.data.'], true),
  group('system-spring-tasks', 'system', 'Tâches Spring', 'Arrêt des tâches et taille du planificateur.', ['spring.lifecycle.', 'spring.task.'], true),
  group('system-server', 'system', 'Serveur HTTP', 'Port, chemin et mode d’arrêt du serveur.', ['server.port', 'server.shutdown', 'server.servlet.'], true),
  group('system-api', 'system', 'Requêtes API', 'Délai maximal des requêtes asynchrones.', ['api.request-timeout'], true),
  group('system-logs', 'system', 'Journaux', 'Niveau de détail des journaux par composant.', ['logging.level.'], true),
  group('system-telemetry-flow', 'system', 'Collecte de télémétrie', 'Files et lots utilisés pour les événements.', ['telemetry.enabled', 'telemetry.queue-size', 'telemetry.batch-size', 'telemetry.flush-interval-ms', 'telemetry.attributes-max-bytes'], true),
  group('system-telemetry-policy', 'system', 'Règles de télémétrie', 'Conservation et comportement en cas de surcharge.', ['telemetry.track-queue-enqueues', 'telemetry.drop-on-overflow', 'telemetry.shutdown-drain-ms', 'telemetry.retention-days'], true),
  group('system-health', 'system', 'Supervision', 'Endpoints et détails de santé visibles.', ['management.'], true),
  group('system-frontend', 'system', 'Tableau de bord intégré', 'Lancement du frontend par le backend.', ['frontend.'], true),
  group('system-clicks', 'system', 'Suivi des clics', 'Traces et captures associées aux clics.', ['click-tracking.'], true),
]

const PROVIDERS = {
  getatext: 'GetAText', daisysms: 'DaisySMS', smspool: 'SMSPool',
  verifysms: 'VerifySMS', smsbower: 'SMSBower', textverified: 'TextVerified', smsman: 'SMS-Man',
}

const providerGroupIds = new Set(Object.keys(PROVIDERS).map(provider => `sms-${provider}`))

function route(key) {
  const sms = /^sms\.([^.]+)\.(.+)$/.exec(key)
  if (sms && PROVIDERS[sms[1]]) {
    const [, provider] = sms
    const name = PROVIDERS[provider]
    return {
      id: `sms-${provider}`, section: 'sms', label: name,
      description: `Identifiants, numéros, prix et tentatives pour ${name}.`,
      advanced: true,
    }
  }
  return GROUPS.find(candidate => candidate.keys.some(prefix => key === prefix || key.startsWith(prefix))) ?? {
    id: 'system-other', section: 'system', label: 'Autres paramètres',
    description: 'Clés complémentaires exposées par le backend.', advanced: true,
  }
}

const COPY = {
  'telemetry.enabled': ['Activer la télémétrie', 'Enregistre les événements de fonctionnement du backend.'],
  'api.cors.enabled': ['Activer l’accès navigateur', 'Autorise les requêtes de navigateur depuis les origines configurées.'],
  'wda.recovery.enabled': ['Activer la récupération WDA', 'Tente de relancer WebDriverAgent après un échec.'],
  'screenshot.enabled': ['Activer les captures d’écran', 'Enregistre des captures pendant les automatisations.'],
  'scraper-stats.enabled': ['Activer les statistiques du scraper', 'Récupère les statistiques depuis le service scraper.'],
  'scraper-sync.enabled': ['Activer la synchronisation du scraper', 'Synchronise les comptes avec le service scraper.'],
  'scraper-sync.boot-reconciliation.enabled': ['Activer le rapprochement au démarrage', 'Rapproche les données du scraper avec les comptes au démarrage.'],
  'discord-webhook.enabled': ['Activer les notifications Discord', 'Envoie les alertes au webhook Discord configuré.'],
  'getmysocial.enabled': ['Activer GetMySocial', 'Utilise GetMySocial pour les opérations connectées.'],
  'click-tracking.enabled': ['Activer le suivi des clics', 'Enregistre les clics effectués pendant les automatisations.'],
  'geo-ip-check.enabled': ['Activer le contrôle géographique', 'Vérifie le pays de l’adresse IP avant de poursuivre le parcours.'],
  'frontend.enabled': ['Activer le frontend intégré', 'Démarre le tableau de bord depuis le backend.'],
  'scheduler.enabled': ['Activer la planification', 'Lance les publications aux heures définies dans les créneaux.'],
  'scheduler.timezone': ['Fuseau horaire des publications', 'Détermine l’heure locale utilisée pour les créneaux de publication.'],
  'scheduler.windows': ['Créneaux de publication', 'Périodes pendant lesquelles le planificateur peut démarrer une publication.'],
  'posting-history.template-cooldown': ['Attente avant réutilisation', 'Nombre de Reels à publier avant de reprendre le même modèle. Zéro supprime la limite.', 'Reels'],
  'story.highlights.enabled': ['Ajouter aux Highlights', 'Ajoute les stories publiées aux albums à la une.'],
  'profile.bio.enabled': ['Ajouter une bio', 'Renseigne une biographie lors de la création du compte.'],
  'profile.picture.blonde-drive-folder-id': ['Photos blondes · dossier Drive', 'Dossier source des photos de profil blondes pour les identités.'],
  'profile.picture.brunette-drive-folder-id': ['Photos brunes · dossier Drive', 'Dossier source des photos de profil brunes pour les identités.'],
  'auto-creation.global-enabled': ['Activer la création automatique', 'État initial de la création automatique au démarrage du backend.'],
  'auto-creation.default-task-priority': ['Priorité des nouvelles tâches', 'Priorité attribuée par défaut aux créations automatiques sur les nouveaux appareils.'],
  'auto-creation.default-time-buffer-multiplier': ['Multiplicateur de marge', 'Majore le temps réservé avant la prochaine publication lors d’une création automatique.'],
  'auto-creation.default-extra-buffer-minutes': ['Marge supplémentaire', 'Minutes ajoutées à la marge de sécurité avant la prochaine publication.', 'min'],
  'sms.providers': ['Pool SMS initial', 'Fournisseurs tirés au sort avant la première configuration SMS en base.'],
  'sms.provider': ['Fournisseur SMS initial', 'Fournisseur principal avant la première configuration SMS en base.'],
  'sms.fallback-providers': ['Fournisseurs SMS de secours', 'Ordre de secours initial avant la première configuration SMS en base.'],
  'dashboard.auth.username': ['Identifiant du tableau de bord', 'Nom d’utilisateur demandé à la connexion.'],
  'dashboard.auth.password': ['Empreinte du mot de passe', 'Empreinte BCrypt du mot de passe de connexion, jamais le mot de passe en clair.'],
  'dashboard.auth.jwt-secret': ['Secret des sessions', 'Clé de signature des sessions ; son changement déconnecte les utilisateurs au redémarrage.'],
  'dashboard.auth.jwt-expiration': ['Durée des sessions', 'Durée pendant laquelle une session reste valable.', 'ms'],
  'spring.profiles.active': ['Profil de démarrage', 'Profil Spring chargé au prochain démarrage.'],
  'spring.data.mongodb.uri': ['Connexion MongoDB', 'Adresse de connexion à la base qui stocke comptes, appareils et identités.'],
  'server.port': ['Port du serveur', 'Port HTTP du backend ; le proxy du tableau de bord doit utiliser le même port.'],
  'server.servlet.context-path': ['Chemin du serveur', 'Préfixe de toutes les routes HTTP du backend.'],
  'api.request-timeout': ['Délai des requêtes asynchrones', 'Durée maximale des requêtes MVC asynchrones ; les requêtes synchrones continuent normalement.', 'ms'],
  'google.drive.auth-mode': ['Mode de connexion Drive', 'Choisit OAuth utilisateur ou compte de service pour Google Drive.'],
  'google.drive.credentials-path': ['Fichier d’identifiants Drive', 'Chemin du fichier local contenant les identifiants Google Drive.'],
  'google.drive.refresh-token': ['Jeton de renouvellement Drive', 'Valeur de secours ; une connexion Drive déjà enregistrée en base reste prioritaire.'],
  'geo-ip-check.required-country': ['Pays requis', 'Code du pays dans lequel l’adresse IP de l’appareil doit être détectée.'],
  'geo-ip-check.fail-open': ['Continuer après échec du contrôle', 'Autorise la suite du parcours si la vérification de l’adresse IP échoue.'],
  'automation.execution.max-parallel-devices': ['Appareils en parallèle', 'Nombre maximal d’appareils exécutant une automatisation en même temps.'],
  'automation.execution.thread-pool-size': ['Threads d’exécution', 'Taille du pool qui exécute les automatisations.'],
  'automation.execution.device-timeout-minutes': ['Durée maximale par appareil', 'Temps maximal accordé à une automatisation sur un appareil.', 'min'],
}

const DETAIL = {
  'spring.application.name': ['Nom de l’application', 'Nom utilisé par Spring pour identifier ce backend.'],
  'spring.data.mongodb.auto-index-creation': ['Création automatique des index', 'Demande à MongoDB de créer les index au démarrage ; cette opération peut être longue sur de grandes collections.'],
  'spring.lifecycle.timeout-per-shutdown-phase': ['Délai d’arrêt des services', 'Temps laissé aux composants Spring pour terminer chaque phase d’arrêt.'],
  'spring.task.scheduling.pool.size': ['Tâches planifiées en parallèle', 'Nombre de threads disponibles pour les tâches planifiées.'],
  'telemetry.queue-size': ['Taille de la file d’événements', 'Nombre maximal d’événements en attente avant leur envoi.'],
  'telemetry.batch-size': ['Événements par lot', 'Nombre d’événements envoyés ensemble à chaque traitement.'],
  'telemetry.flush-interval-ms': ['Intervalle d’envoi', 'Temps entre deux envois des événements en attente.', 'ms'],
  'telemetry.attributes-max-bytes': ['Taille maximale des attributs', 'Taille maximale des données attachées à un événement.', 'octets'],
  'telemetry.track-queue-enqueues': ['Tracer les ajouts à la file', 'Enregistre les événements liés à l’ajout des tâches dans les files.'],
  'telemetry.drop-on-overflow': ['Ignorer en cas de surcharge', 'Écarte les événements quand la file de télémétrie est pleine.'],
  'telemetry.shutdown-drain-ms': ['Délai de vidage à l’arrêt', 'Temps laissé pour envoyer les événements restants pendant l’arrêt.', 'ms'],
  'server.shutdown': ['Mode d’arrêt du serveur', 'Choisit si les requêtes en cours se terminent avant l’arrêt HTTP.'],
  'server.error.include-message': ['Messages d’erreur visibles', 'Détermine quand le détail des erreurs apparaît dans les réponses HTTP.'],
  'server.error.include-binding-errors': ['Erreurs de validation visibles', 'Détermine quand les erreurs de liaison des paramètres apparaissent dans les réponses HTTP.'],
  'logging.level.root': ['Niveau général des journaux', 'Niveau de détail utilisé par défaut pour tous les composants.'],
  'logging.level.com.automation.instagram': ['Journaux du backend', 'Niveau de détail des journaux de l’application Instagram.'],
  'logging.level.com.automation.instagram.content.service.PostingHistoryService': ['Journaux de réutilisation', 'Niveau de détail des décisions de réutilisation des contenus.'],
  'logging.level.org.springframework.web': ['Journaux HTTP Spring', 'Niveau de détail des traitements web de Spring.'],
  'api.cors.allowed-origins': ['Origines autorisées', 'Adresses des sites qui peuvent appeler l’API depuis un navigateur.'],
  'api.cors.allowed-methods': ['Méthodes autorisées', 'Méthodes HTTP acceptées pour les appels depuis le navigateur.'],
  'api.cors.allowed-headers': ['En-têtes autorisés', 'En-têtes que le navigateur peut envoyer dans ses requêtes à l’API.'],
  'appium.ios.xcode-org-id': ['Équipe Apple de signature', 'Identifiant de l’équipe Apple utilisé pour signer WebDriverAgent.'],
  'appium.ios.xcode-signing-id': ['Certificat de signature iOS', 'Nom du certificat de développement utilisé pour signer WebDriverAgent.'],
  'appium.default-host': ['Adresse Appium', 'Hôte utilisé pour joindre le serveur Appium par défaut.'],
  'appium.default-port': ['Port Appium', 'Port utilisé pour joindre le serveur Appium par défaut.'],
  'appium.max-ports': ['Ports Appium disponibles', 'Nombre de ports réservés à l’exécution simultanée sur les appareils.'],
  'wda.recovery.timeout': ['Délai de récupération WDA', 'Temps maximal accordé à la relance de WebDriverAgent.'],
  'wda.recovery.node-command': ['Commande Node', 'Commande Node.js utilisée lors de la récupération de WebDriverAgent.'],
  'wda.recovery.ios-command': ['Commande iOS', 'Commande iOS utilisée lors de la récupération de WebDriverAgent.'],
  'management.endpoints.web.exposure.include': ['Endpoints de supervision', 'Liste des endpoints Actuator exposés par le serveur HTTP.'],
  'management.endpoint.health.show-details': ['Détails de santé', 'Détermine qui peut voir les détails du contrôle de santé.'],
  'screenshot.base-path': ['Dossier des captures', 'Dossier dans lequel les captures d’écran sont enregistrées.'],
  'screenshot.save-metadata': ['Conserver les métadonnées', 'Enregistre les informations associées à chaque capture d’écran.'],
  'apify.actor-id': ['Acteur Apify', 'Identifiant de l’acteur exécuté pour récupérer les données.'],
  'apify.results-limit': ['Résultats Apify', 'Nombre maximal de résultats récupérés par exécution.'],
  'apify.max-parallel-accounts': ['Comptes Apify simultanés', 'Nombre de comptes traités en parallèle par les appels Apify.'],
  'reel-stats.thumbnail-storage-path': ['Dossier des aperçus', 'Dossier local où sont conservées les miniatures des Reels.'],
  'scraper-sync.target-username': ['Compte cible du scraper', 'Compte sur lequel la synchronisation avec le scraper est effectuée.'],
  'discord-webhook.url': ['Webhook Discord', 'Adresse du canal Discord recevant les notifications.'],
  'getmysocial.team-id': ['Équipe GetMySocial', 'Identifiant de l’équipe utilisée pour les appels GetMySocial.'],
  'click-tracking.base-path': ['Dossier du suivi des clics', 'Dossier local où sont enregistrées les traces des clics.'],
  'click-tracking.save-screenshots': ['Capturer les clics', 'Ajoute une capture d’écran aux traces des clics.'],
  'geo-ip-check.cache-ttl-minutes': ['Durée du cache IP', 'Temps pendant lequel le résultat du contrôle géographique est réutilisé.', 'min'],
  'media-receiver.auth-token': ['Jeton de transfert', 'Jeton exigé pour recevoir des fichiers médias.'],
  'content-loop.ffmpeg-dir': ['Dossier FFmpeg', 'Dossier contenant les outils FFmpeg utilisés pour préparer les vidéos.'],
  'content-loop.preset': ['Profil d’encodage', 'Compromis entre vitesse et compression lors de la préparation des vidéos.'],
  'content-loop.spread-window-hours': ['Fenêtre de répartition', 'Période sur laquelle les traitements vidéo sont étalés.', 'h'],
  'sms.smspool.pool': ['SMSPool · pool', 'Pool de numéros demandé à SMSPool.'],
  'sms.verifysms.carriers': ['VerifySMS · opérateurs', 'Opérateurs téléphoniques acceptés par VerifySMS.'],
  'frontend.path': ['Dossier du tableau de bord', 'Chemin local du frontend lorsque son lancement intégré est activé.'],
  'google.drive.client-id': ['Identifiant client Google', 'Identifiant OAuth de l’application autorisée à accéder à Drive.'],
  'google.drive.client-secret': ['Secret client Google', 'Secret OAuth associé à l’identifiant client Google.'],
  'google.drive.oauth-redirect-uri': ['Adresse de retour OAuth', 'Adresse sur laquelle Google renvoie le navigateur après la connexion.'],
  'account-history.backfill-at-startup': ['Reconstituer l’historique au démarrage', 'Recrée les données historiques manquantes lors du prochain démarrage.'],
  'account-history.timeline.executor.pool-size': ['Threads de la chronologie', 'Nombre de traitements parallèles pour construire la chronologie des comptes.'],
  'account-history.timeline.note.text-max-length': ['Longueur maximale des notes', 'Nombre maximal de caractères conservés dans une note de chronologie.', 'caractères'],
  'device.ssh.user': ['Utilisateur SSH', 'Compte utilisé pour ouvrir une session SSH sur les appareils.'],
  'device.ssh.usb-fallback-enabled': ['Secours USB', 'Tente une connexion USB si la connexion SSH habituelle échoue.'],
  'device.ssh.connect-timeout-ms': ['Délai de connexion SSH', 'Temps maximal accordé à l’ouverture d’une session SSH.', 'ms'],
  'device.ssh.idle-timeout-ms': ['Inactivité SSH maximale', 'Temps avant fermeture d’une session SSH inactive.', 'ms'],
  'device.ssh.reaper-interval-ms': ['Nettoyage des sessions SSH', 'Temps entre deux recherches de sessions SSH inactives.', 'ms'],
}

const LEAF = {
  enabled: ['Activer', 'Active cette fonction au prochain démarrage.'],
  'api-key': ['Clé API', 'Clé utilisée pour authentifier les appels au service.'],
  'api-token': ['Jeton API', 'Jeton utilisé pour authentifier les appels au service.'],
  password: ['Mot de passe', 'Mot de passe utilisé pour se connecter au service.'],
  username: ['Identifiant', 'Identifiant utilisé pour se connecter au service.'],
  'api-username': ['Identifiant API', 'Nom de compte utilisé pour les appels API.'],
  'max-price': ['Prix maximal', 'Prix maximal accepté pour une location.'],
  'max-concurrent-rentals': ['Locations simultanées', 'Nombre maximal de numéros loués en même temps.'],
  'retry-attempts': ['Nombre de tentatives', 'Nombre maximal de tentatives avant d’abandonner.'],
  'retry-delay-ms': ['Délai entre tentatives', 'Temps d’attente entre deux tentatives.', 'ms'],
  'poll-interval-ms': ['Intervalle de vérification', 'Temps entre deux vérifications du code SMS.', 'ms'],
  'timeout-seconds': ['Délai maximal', 'Temps maximal accordé à cette opération.', 's'],
  'retention-days': ['Durée de conservation', 'Nombre de jours pendant lesquels les données sont gardées.', 'jours'],
  country: ['Pays', 'Pays demandé au fournisseur.'],
  'country-id': ['Code pays', 'Identifiant du pays attendu par le fournisseur.'],
  service: ['Service', 'Service demandé au fournisseur de numéros.'],
  'service-name': ['Nom du service', 'Nom du service demandé au fournisseur de numéros.'],
  'service-code': ['Code du service', 'Code du service demandé au fournisseur de numéros.'],
  'application-id': ['Application', 'Identifiant de l’application demandé au fournisseur.'],
  'api-url': ['Adresse API', 'Adresse du service utilisé pour les appels API.'],
  'base-url': ['Adresse du service', 'Adresse utilisée pour joindre ce service.'],
  concurrency: ['Traitements simultanés', 'Nombre de traitements exécutés en parallèle.'],
  threads: ['Threads par traitement', 'Nombre de threads attribués à un traitement.'],
  'interval-ms': ['Intervalle', 'Temps entre deux contrôles.', 'ms'],
  'initial-delay-ms': ['Délai initial', 'Attente avant le premier contrôle.', 'ms'],
  port: ['Port', 'Port utilisé pour joindre le service.'],
}

function metadataFor(field) {
  const key = field.key
  if (COPY[key] || DETAIL[key]) return COPY[key] ?? DETAIL[key]
  const sms = /^sms\.([^.]+)\.(.+)$/.exec(key)
  if (sms && PROVIDERS[sms[1]]) {
    const leaf = LEAF[sms[2]]
    if (leaf) return [`${PROVIDERS[sms[1]]} · ${leaf[0].toLocaleLowerCase('fr-FR')}`,
      `${leaf[1].replace(/\.$/, '')} chez ${PROVIDERS[sms[1]]}.`, leaf[2]]
  }
  const leaf = key.slice(key.lastIndexOf('.') + 1)
  const generic = LEAF[leaf]
  if (generic) return [generic[0],
    field.description || `${generic[1].replace(/\.$/, '')} pour ${route(key).label.toLocaleLowerCase('fr-FR')}.`, generic[2]]
  if (field.description) return [field.label || key, field.description]
  return [field.label || key, `Paramètre ${key} exposé par le backend.`]
}

export function presentSetting(field) {
  const [label, description, unit] = metadataFor(field)
  return { ...field, label, description, ...(unit ? { unit } : {}) }
}

export function presentSettingsGroups(groups = []) {
  const unique = new Set()
  const output = new Map()
  for (const source of groups) {
    for (const field of source.fields ?? []) {
      if (!field?.key || unique.has(field.key)) continue
      unique.add(field.key)
      const destination = route(field.key)
      const current = output.get(destination.id) ?? { ...destination, fields: [] }
      current.fields.push(presentSetting(field))
      output.set(destination.id, current)
    }
  }
  const sectionOrder = new Map(SETTINGS_SECTIONS.map((section, index) => [section.id, index]))
  const groupOrder = new Map(GROUPS.map((item, index) => [item.id, index]))
  return [...output.values()]
    .sort((a, b) => (sectionOrder.get(a.section) - sectionOrder.get(b.section)) ||
      ((groupOrder.get(a.id) ?? 1000) - (groupOrder.get(b.id) ?? 1000)) || a.id.localeCompare(b.id))
    .flatMap(item => item.fields.length <= 5 || providerGroupIds.has(item.id) ? [item] :
      Array.from({ length: Math.ceil(item.fields.length / 5) }, (_, index) => ({
        ...item,
        id: `${item.id}-${index + 1}`,
        label: index === 0 ? item.label : `${item.label} · suite ${index + 1}`,
        fields: item.fields.slice(index * 5, (index + 1) * 5),
      })))
}

const normalize = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr-FR')

export function filterSettingsGroups(groups, search) {
  const terms = normalize(search).trim().split(/\s+/).filter(Boolean)
  if (!terms.length) return groups
  return groups.map(item => {
    const groupText = normalize(`${item.label} ${item.description} ${SETTINGS_SECTIONS.find(section => section.id === item.section)?.label ?? ''}`)
    const allMatch = terms.every(term => groupText.includes(term))
    const fields = allMatch ? item.fields : item.fields.filter(field => {
      const text = normalize(`${groupText} ${field.key} ${field.label} ${field.description} ${field.unit ?? ''}`)
      return terms.every(term => text.includes(term))
    })
    return { ...item, fields }
  }).filter(item => item.fields.length)
}
