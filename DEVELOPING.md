# Développement de MusicME

Notes techniques pour les développeurs. Le README reste volontairement
orienté utilisateur.

## Démarrer

```bash
npm install
npm run start:dev
```

Le raccourci Windows `lancer-app.cmd` lance aussi `npm run start:dev`.

## Mode audio (écran éteint, natif uniquement)

Le mode audio lit les titres en arrière-plan via `react-native-track-player`.
Le flux est résolu par l'endpoint Innertube `youtubei/v1/player` (client
Android) : seul le format progressif `itag 18` (360p, audio + vidéo) est
accessible sans signature, d'où ~4 Mo/min en écoute (le son seul est bloqué
par YouTube).

Les radios live utilisent le manifest **HLS** du direct, lu nativement par
ExoPlayer (`type: hls`).

## Build de l'APK

```bash
cd android && ./gradlew assembleRelease
```

L'APK sort dans `android/app/build/outputs/apk/release/app-release.apk`
(nécessite Android Studio + JDK 17).

## Signature de release

La build release est signée avec un keystore dédié (alias `musicme`). Les
credentials sont lus depuis `android/keystore.properties` (fichier local,
**gitignoré** — ne jamais le committer). Sans ce fichier, la build retombe sur
la clé debug (dev local uniquement).

Pour créer son propre keystore :

```bash
keytool -genkeypair -v -keystore android/app/musicme-release.jks \
  -keyalg RSA -keysize 2048 -validity 10000 -alias musicme \
  -dname "CN=MusicME, O=MusicME, C=FR"
```

puis copier `android/keystore.properties.example` vers
`android/keystore.properties` et renseigner les mots de passe.

> ⚠️ Conserver le keystore et ses mots de passe en lieu sûr : les perdre
> rend impossible la publication de mises à jour de l'app.

NB : `react-native-track-player` nécessite un correctif Kotlin appliqué via
`patch-package` (voir `patches/`).

## Structure

- `App.tsx` : import de playlist publique, recherche, mix, radio, favoris.
- `index.js` / `index.web.js` : points d'entrée (le service de lecture n'est enregistré que sur natif).
- `src/youtube/innertube.ts` : lecture des playlists, recherche, titres similaires et radios live via Innertube.
- `src/audio/` : résolveur de flux (`youtubei/v1/player`), lecteur et service react-native-track-player.
- `src/i18n.ts` : dictionnaires FR/EN et détection de langue.
- `app.json` : configuration Expo, schéma, icône et mode audio de fond.
- `package.json` : scripts Expo et vérification TypeScript.

## Stabilisation des flux via un serveur (Piped / Invidious)

### Pourquoi un serveur ?

Aujourd'hui chaque téléphone résout ses propres flux directement contre
Innertube (`youtubei/v1/player`) depuis **son IP**. Limites :

- YouTube peut **limiter / bloquer** les IP qui font beaucoup de requêtes
  `player` ;
- quand YouTube change ses signatures (**PoToken**), la résolution casse et il
  faut **mettre à jour l'app** pour tous les utilisateurs ;
- on ne peut pas obtenir l'**audio seul** (itag 140) : on lit du 360p (itag 18,
  ~4 Mo/min).

Un serveur central règle ces trois points : il résout depuis une **IP stable**,
absorbe les changements de signature (on met à jour le serveur, pas les
téléphones) et peut servir **l'audio pur** (~1 Mo/min).

### Solution recommandée : instance Piped auto-hébergée

[Piped](https://github.com/TeamPiped/Piped) est un frontend open-source qui
parle à YouTube côté serveur et expose une API JSON propre + un proxy de
streaming. Sur un petit VPS (2-5 €/mois), en Docker :

```bash
docker run -d --name piped -p 8080:8080 \
  -v piped:/app/data 1337kavin/piped:latest
```

L'app appelle alors :

```
GET https://<instance>/api/streams/{videoId}
```

Réponse utile :

- `audioStreams[]` : flux audio seuls (prendre le meilleur, itag 140 / 128
  kbps) → **lecture audio pur** ;
- `hls` : manifest pour les **radios live** ;
- `livestream` : vrai si le direct ;
- `url` des streams = URLs proxyées par l'instance (consomme la bande passante
  du serveur).

### Alternative : instance Invidious

- `GET /api/v1/videos/{id}` → champ `formatStreams` (itag 140) ;
- `GET /api/v1/latest_version?id={id}&itag=140` → redirection directe vers
  l'audio.

### Chaîne de repli à implémenter dans l'app

1. Instance personnelle (si configurée dans l'app) ;
2. Instances publiques Piped (liste dynamique) ;
3. Repli direct Innertube (comportement actuel).

### Impact code (quand on s'y met)

- `src/audio/streamResolver.ts` : `resolveAudioStream` essaie d'abord
  l'instance Piped configurée (`/streams/{id}` → itag 140), puis retombe sur
  Innertube ; `resolveLiveStreamUrl` utilise le champ `hls`.
- Ajouter un réglage « Instance Piped (URL) » dans l'app.
- Côté serveur : configurer le proxy + reverse proxy (Caddy/Nginx) pour
  `https://<instance>/`.

### Coût et modèle

- VPS ~3-5 €/mois + bande passante (le proxy consomme de la data serveur).
- C'est la base d'un éventuel **petit abonnement « serveur » (1-2 €/mois)** :
  l'utilisateur paie pour la stabilité et l'audio pur, pas pour la musique.

## Zone grise ToS

L'app interroge l'API interne de YouTube (Innertube) sans compte. Usage privé
uniquement, peut casser quand YouTube change ses signatures. **Non
distribuable sur le Google Play Store.**
