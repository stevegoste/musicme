import { I18nManager, Platform } from 'react-native';

export type Language = 'fr' | 'en';

type Params = Record<string, string | number>;

const fr: Record<string, string> = {
  // Welcome / status
  'msg.welcome': 'Colle une playlist YouTube publique pour commencer.',
  'msg.loadingPlaylist': 'Chargement de la playlist...',
  'msg.loadedSongs': '{n} titre(s) chargé(s) (extrait aléatoire) depuis « {title} ».',
  'msg.emptyPlaylist': 'Cette playlist ne contient aucun titre lisible.',
  'msg.privateIgnored': '{n} vidéo(s) privée(s) ignorée(s).',
  'msg.loadError': 'Impossible de charger cette playlist.',
  'msg.invalidLink': 'Colle un lien de playlist YouTube publique valide.',
  'msg.noPlayable': 'Aucun titre lisible dans cette sélection.',

  // Audio mode
  'msg.audioWebOnly': "Le mode audio (écran éteint) n'est disponible que sur téléphone.",
  'msg.preparingAudio': 'Préparation du mode audio...',
  'msg.audioQueue': 'Mode audio actif : {n} titre(s) en file',
  'msg.loadingMore': ' (chargement de la suite...)',
  'msg.noStream': 'Aucun flux audio résolu (titres privés, supprimés ou bloqués par région).',
  'msg.audioFail': 'Échec du mode audio : {error}',
  'msg.minuterieStopped': 'Minuterie : lecture arrêtée.',
  'msg.audioActive': 'Mode audio actif',

  // Radio mode
  'msg.radioWebOnly': "Le mode Radio n'est disponible que sur téléphone.",
  'msg.preparingRadio': 'Préparation du mode Radio...',
  'msg.noRelated': 'Aucun titre similaire trouvé pour ce morceau.',
  'msg.radioQueue': 'Mode Radio : {n} titre(s) en file',
  'msg.radioNoStream': 'Aucun flux audio résolu pour ce mode Radio.',
  'msg.radioFail': 'Échec du mode Radio : {error}',

  // Offline
  'msg.offlineWebOnly': "Le téléchargement hors ligne n'est disponible que sur téléphone.",
  'msg.noDownloadable': 'Aucun titre à télécharger dans cette sélection.',
  'msg.downloading': 'Téléchargement hors ligne (reste sur le WiFi)...',
  'msg.downloadProgress': 'Téléchargement {done}/{total}{failed}...',
  'msg.downloadFailedSuffix': ' ({failed} échoué(s))',
  'msg.offlineReady': 'Hors ligne prêt : {n} titre(s) téléchargé(s).',
  'msg.offlineNone': 'Aucun titre téléchargé (flux indisponibles).',
  'msg.downloadFail': 'Échec du téléchargement : {error}',
  'msg.offlinePlayWebOnly': "La lecture hors ligne n'est disponible que sur téléphone.",
  'msg.offlineEmpty': "Aucun titre hors ligne. Télécharge d'abord ta playlist (WiFi).",
  'msg.offlinePlaying': 'Lecture hors ligne...',
  'msg.offlinePlayed': 'Lecture hors ligne : {n} titre(s).',
  'msg.offlineUnplayable': 'Aucun titre hors ligne jouable.',
  'msg.offlinePlayFail': 'Échec de la lecture hors ligne : {error}',
  'msg.cacheCleared': 'Cache hors ligne vidé.',
  'msg.downloadSingle': 'Téléchargement de « {title} »...',
  'msg.downloadSingleDone': '« {title} » disponible hors ligne.',
  'msg.downloadSingleFail': 'Échec du téléchargement de « {title} » (flux indisponible).',

  // Favorites
  'msg.favAdded': '« {title} » ajouté aux favoris.',
  'msg.favRemoved': '« {title} » retiré des favoris.',
  'msg.noFavorites': 'Aucun favori pour le moment. Touche le cœur d’un titre pour l’épingler ici.',
  'msg.noResults': 'Aucun résultat pour « {query} ».',

  // Mix / fusion de playlists
  'mix.title': 'Créer un mix',
  'mix.results': 'Résultats',
  'mix.searchPlaceholder': 'Rechercher des playlists',
  'mix.searching': 'Recherche...',
  'mix.noResults': 'Aucune playlist trouvée pour « {query} ».',
  'mix.searchFail': 'Recherche impossible : {error}',
  'mix.added': 'Playlists ajoutées ({n})',
  'mix.empty': 'Ajoute des playlists pour construire un mix.',
  'mix.load': 'Créer le mix ({n})',
  'mix.loading': 'Fusion des playlists...',
  'mix.loaded': 'Mix prêt : {n} titres de {p} playlists.',
  'mix.fail': 'Échec du mix : {error}',
  'mix.videos': '{n} vidéos',
  'mix.addedToast': '« {title} » ajoutée au mix.',
  'mix.removed': 'Playlist retirée du mix.',
  'mix.default': 'Mix',
  'mix.max': '3 mixes maximum. Ferme-en un avant d’en créer un autre.',

  // Radio live (flux YouTube en direct)
  'radio.title': 'Radio live',
  'radio.results': 'Radios live',
  'radio.loading': 'Recherche des radios live...',
  'radio.noResults': 'Aucune radio live trouvée pour ce style.',
  'radio.searchFail': 'Recherche impossible : {error}',
  'radio.loadingStream': 'Connexion à la radio...',
  'radio.fail': 'Impossible de lire cette radio.',
  'radio.playing': 'Radio live : {title}',
  'radio.webOnly': 'Les radios live ne sont disponibles que sur téléphone.',
  'radio.live': 'EN DIRECT',
  'radio.favorites': 'Radios favorites',
  'radio.favAdded': '« {title} » ajoutée aux radios favorites.',
  'radio.favRemoved': 'Radio retirée des favoris.',

  // Genres / thèmes
  'genre.metal': 'Metal',
  'genre.rock': 'Rock',
  'genre.funk': 'Funk',
  'genre.rap': 'Rap',
  'genre.jazz': 'Jazz',
  'genre.lofi': 'Lo-fi',
  'genre.pop': 'Pop',
  'genre.electro': 'Électro',
  'genre.classical': 'Classique',
  'genre.latino': 'Latino',
  'genre.reggae': 'Reggae',
  'genre.blues': 'Blues',

  // UI labels
  'label.openInYouTube': 'Ouvrir dans YouTube',
  'label.openToPlay': 'Ouvrir dans YouTube pour la lire',
  'label.yourPlaylist': 'Votre playlist',
  'label.loadingSongs': 'Chargement des titres...',
  'label.resolving': 'Résolution...',
  'label.audioMode': 'Mode audio',
  'label.offline': 'Hors ligne ({n})',
  'label.downloadingBtn': 'Téléchargement...',
  'label.downloadBtn': 'Télécharger (WiFi)',
  'label.clearCache': 'Vider le cache hors ligne ({size})',
  'label.search': 'Rechercher un artiste ou un titre...',
  'label.playlist': 'Playlist',
  'label.favorites': 'Favoris ({n})',
  'label.sleepIn': 'Arrêt dans {time}',
  'label.tracksInQueue': '{n} titres en file',
  'label.min15': '15 min',
  'label.min30': '30 min',
  'label.min60': '60 min',
  'label.inputPlaceholder': 'https://youtube.com/playlist?list=...',
  'label.publicOnly': 'Public uniquement',
  'label.loadedOk': 'Chargée',
  'label.recent': 'Récentes',
  'label.clearHistory': 'Effacer',

  // Écran de bienvenue (premier lancement)
  'welcome.tagline': 'Ton lecteur de playlists YouTube en audio.',
  'welcome.f1': 'Écoute en continu, écran éteint',
  'welcome.f2': 'Playlists publiques, sans compte ni clé',
  'welcome.f3': 'Téléchargement hors ligne (WiFi)',
  'welcome.f4': 'Crée des mixes par genre',
  'welcome.f5': 'Favoris et recherche',
  'welcome.start': 'Commencer',
  'welcome.close': 'Fermer',
  'welcome.note': 'Aucun compte Google requis.',

  // Petit tuto « Comment ça marche »
  'tuto.title': 'Comment ça marche',
  'tuto.s1': 'Colle une playlist YouTube publique.',
  'tuto.s2': 'Lance le mode audio (écran éteint) ou télécharge pour le hors ligne.',
  'tuto.s3': 'Cherche des playlists par genre et crée des mixes.',
  'tuto.s4': 'Touche le cœur pour épingler tes favoris.',

  // Footer notice
  'notice.footer':
    'Lecture audio en continu (écran éteint). Le mode « Télécharger (WiFi) » enregistre les morceaux sur le téléphone pour l’écoute hors ligne, sans data.',
};

const en: Record<string, string> = {
  'msg.welcome': 'Paste a public YouTube playlist to get started.',
  'msg.loadingPlaylist': 'Loading playlist...',
  'msg.loadedSongs': '{n} track(s) loaded (random sample) from "{title}".',
  'msg.emptyPlaylist': 'This playlist contains no playable tracks.',
  'msg.privateIgnored': '{n} private video(s) ignored.',
  'msg.loadError': 'Could not load this playlist.',
  'msg.invalidLink': 'Paste a valid public YouTube playlist link.',
  'msg.noPlayable': 'No playable tracks in this selection.',

  'msg.audioWebOnly': 'Audio mode (screen off) is only available on the phone.',
  'msg.preparingAudio': 'Preparing audio mode...',
  'msg.audioQueue': 'Audio mode active: {n} track(s) queued',
  'msg.loadingMore': ' (loading more...)',
  'msg.noStream': 'No audio stream resolved (private, deleted or region-blocked tracks).',
  'msg.audioFail': 'Audio mode failed: {error}',
  'msg.minuterieStopped': 'Sleep timer: playback stopped.',
  'msg.audioActive': 'Audio mode active',

  'msg.radioWebOnly': 'Radio mode is only available on the phone.',
  'msg.preparingRadio': 'Preparing Radio mode...',
  'msg.noRelated': 'No similar tracks found for this song.',
  'msg.radioQueue': 'Radio mode: {n} track(s) queued',
  'msg.radioNoStream': 'No audio stream resolved for this Radio mode.',
  'msg.radioFail': 'Radio mode failed: {error}',

  'msg.offlineWebOnly': 'Offline download is only available on the phone.',
  'msg.noDownloadable': 'No tracks to download in this selection.',
  'msg.downloading': 'Downloading offline (stay on WiFi)...',
  'msg.downloadProgress': 'Downloading {done}/{total}{failed}...',
  'msg.downloadFailedSuffix': ' ({failed} failed)',
  'msg.offlineReady': 'Offline ready: {n} track(s) downloaded.',
  'msg.offlineNone': 'No tracks downloaded (streams unavailable).',
  'msg.downloadFail': 'Download failed: {error}',
  'msg.offlinePlayWebOnly': 'Offline playback is only available on the phone.',
  'msg.offlineEmpty': 'No offline tracks. Download your playlist first (WiFi).',
  'msg.offlinePlaying': 'Playing offline...',
  'msg.offlinePlayed': 'Offline playback: {n} track(s).',
  'msg.offlineUnplayable': 'No playable offline tracks.',
  'msg.offlinePlayFail': 'Offline playback failed: {error}',
  'msg.cacheCleared': 'Offline cache cleared.',
  'msg.downloadSingle': 'Downloading "{title}"...',
  'msg.downloadSingleDone': '"{title}" is now available offline.',
  'msg.downloadSingleFail': 'Failed to download "{title}" (stream unavailable).',

  'msg.favAdded': '"{title}" added to favorites.',
  'msg.favRemoved': '"{title}" removed from favorites.',
  'msg.noFavorites': 'No favorites yet. Tap the heart on a track to pin it here.',
  'msg.noResults': 'No results for "{query}".',

  // Mix / merge playlists
  'mix.title': 'Create a mix',
  'mix.results': 'Results',
  'mix.searchPlaceholder': 'Search playlists',
  'mix.searching': 'Searching...',
  'mix.noResults': 'No playlists found for "{query}".',
  'mix.searchFail': 'Search failed: {error}',
  'mix.added': 'Added playlists ({n})',
  'mix.empty': 'Add playlists to build a mix.',
  'mix.load': 'Build mix ({n})',
  'mix.loading': 'Merging playlists...',
  'mix.loaded': 'Mix ready: {n} tracks from {p} playlists.',
  'mix.fail': 'Mix failed: {error}',
  'mix.videos': '{n} videos',
  'mix.addedToast': '"{title}" added to the mix.',
  'mix.removed': 'Playlist removed from the mix.',
  'mix.default': 'Mix',
  'mix.max': '3 mixes max. Close one before creating another.',

  // Live radio (YouTube live streams)
  'radio.title': 'Live radio',
  'radio.results': 'Live radios',
  'radio.loading': 'Searching live radios...',
  'radio.noResults': 'No live radio found for this style.',
  'radio.searchFail': 'Search failed: {error}',
  'radio.loadingStream': 'Connecting to radio...',
  'radio.fail': 'Could not play this radio.',
  'radio.playing': 'Live radio: {title}',
  'radio.webOnly': 'Live radios are only available on the phone.',
  'radio.live': 'LIVE',
  'radio.favorites': 'Favorite radios',
  'radio.favAdded': '"{title}" added to favorite radios.',
  'radio.favRemoved': 'Radio removed from favorites.',

  // Genres / themes
  'genre.metal': 'Metal',
  'genre.rock': 'Rock',
  'genre.funk': 'Funk',
  'genre.rap': 'Rap',
  'genre.jazz': 'Jazz',
  'genre.lofi': 'Lo-fi',
  'genre.pop': 'Pop',
  'genre.electro': 'Electro',
  'genre.classical': 'Classical',
  'genre.latino': 'Latino',
  'genre.reggae': 'Reggae',
  'genre.blues': 'Blues',

  'label.openInYouTube': 'Open in YouTube',
  'label.openToPlay': 'Open in YouTube to play it',
  'label.yourPlaylist': 'Your playlist',
  'label.loadingSongs': 'Loading tracks...',
  'label.resolving': 'Resolving...',
  'label.audioMode': 'Audio mode',
  'label.offline': 'Offline ({n})',
  'label.downloadingBtn': 'Downloading...',
  'label.downloadBtn': 'Download (WiFi)',
  'label.clearCache': 'Clear offline cache ({size})',
  'label.search': 'Search for an artist or a track...',
  'label.playlist': 'Playlist',
  'label.favorites': 'Favorites ({n})',
  'label.sleepIn': 'Stops in {time}',
  'label.tracksInQueue': '{n} tracks queued',
  'label.min15': '15 min',
  'label.min30': '30 min',
  'label.min60': '60 min',
  'label.inputPlaceholder': 'https://youtube.com/playlist?list=...',
  'label.publicOnly': 'Public only',
  'label.loadedOk': 'Loaded',
  'label.recent': 'Recent',
  'label.clearHistory': 'Clear',

  // Welcome screen (first launch)
  'welcome.tagline': 'Your YouTube playlist audio player.',
  'welcome.f1': 'Continuous playback, screen off',
  'welcome.f2': 'Public playlists, no account or key',
  'welcome.f3': 'Offline downloads over WiFi',
  'welcome.f4': 'Build mixes by genre',
  'welcome.f5': 'Favorites and search',
  'welcome.start': 'Get started',
  'welcome.close': 'Close',
  'welcome.note': 'No Google account required.',

  // Small "How it works" tutorial
  'tuto.title': 'How it works',
  'tuto.s1': 'Paste a public YouTube playlist.',
  'tuto.s2': 'Start audio mode (screen off) or download for offline.',
  'tuto.s3': 'Search playlists by genre and build mixes.',
  'tuto.s4': 'Tap the heart to pin your favorites.',

  'notice.footer':
    'Continuous audio playback (screen off). The "Download (WiFi)" mode saves tracks on the phone for offline listening, without data.',
};

const dictionaries: Record<Language, Record<string, string>> = { fr, en };

export function detectLanguage(): Language {
  // Règle : français uniquement si l'appareil est en français, anglais sinon.
  // Les locales peuvent être « fr-FR », « fr_FR » ou « fr » selon la plateforme.
  let locale = '';
  if (Platform.OS === 'web' && typeof navigator !== 'undefined') {
    locale = navigator.language || (navigator.languages?.[0] ?? '');
  }
  if (!locale) {
    try {
      locale = I18nManager.getConstants?.().localeIdentifier ?? '';
    } catch {
      // I18nManager indisponible : on retombe sur l'anglais par défaut.
    }
  }
  const code = locale.toLowerCase().split(/[-_]/)[0];
  return code === 'fr' ? 'fr' : 'en';
}

export function translate(lang: Language, key: string, params?: Params): string {
  const dict = dictionaries[lang] ?? en;
  let text = dict[key] ?? fr[key] ?? key;
  if (params) {
    for (const [name, value] of Object.entries(params)) {
      text = text.split(`{${name}}`).join(String(value));
    }
  }
  return text;
}
