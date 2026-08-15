# MusicME

Application mobile (React Native / Expo) pour coller une playlist YouTube
**publique** et l'écouter en continu, **écran éteint**, sans compte Google,
sans clé API et sans cookie. Tout passe par l'API interne **Innertube** (la
même que le site YouTube), comme le font NewPipe et InnerTune.

> 🚧 **En développement actif** — aucune release publique pour l'instant.
> Le dépôt est créé pour suivre le projet ; l'app n'est pas encore terminée.

## Fonctionnalités

- 📋 Coller une playlist YouTube publique (jusqu'à 1000 titres, extrait
  aléatoire) et l'écouter en continu.
- 🎧 **Mode audio** écran éteint (notification + commandes sur l'écran
  verrouillé) via `react-native-track-player`.
- 🔀 **Mixes** : recherche de playlists par genre et fusion de plusieurs
  playlists en une seule liste (jusqu'à 3 mixes nommés par style).
- 📻 **Mode Radio** : titres similaires à un morceau ; **Radio live** : flux
  YouTube en direct (Lofi, Metal, Jazz…) lus en HLS.
- ❤️ **Favoris** (titres et radios), recherche dans la liste, minuterie,
  shuffle on/off.
- 🌐 Bilingue **FR/EN** (détection automatique + bascule manuelle), écran de
  bienvenue avec tutoriel au premier lancement.

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
accessible sans signature, c'est pourquoi le mode « audio » consomme
~4 Mo/min (le son seul est bloqué par YouTube).

Les radios live utilisent le manifest **HLS** du direct, lu nativement par
ExoPlayer (`type: hls`).

## Build de l'APK

```bash
cd android && ./gradlew assembleRelease
```

L'APK sort dans `android/app/build/outputs/apk/release/app-release.apk`
(nécessite Android Studio + JDK 17).

## Signature de release (pour distribuer l'APK)

La build release est signée avec un keystore dédié (alias `musicme`). Les
credentials sont lus depuis `android/keystore.properties` (fichier local,
**gitignoré** — ne jamais le committer). Sans ce fichier, la build retombe sur
la clé debug (dev local uniquement).

Pour créer ton propre keystore :

```bash
keytool -genkeypair -v -keystore android/app/musicme-release.jks \
  -keyalg RSA -keysize 2048 -validity 10000 -alias musicme \
  -dname "CN=MusicME, O=MusicME, C=FR"
```

puis copier `android/keystore.properties.example` vers
`android/keystore.properties` et y renseigner les mots de passe.

> ⚠️ Conserve le keystore et ses mots de passe en lieu sûr : perdre le keystore
> = impossibilité de publier des mises à jour de l'app.

NB : `react-native-track-player` a besoin d'un correctif Kotlin appliqué via
`patch-package` (voir `patches/`).

> Zone grise ToS : l'app interroge l'API interne de YouTube (Innertube) sans
> compte. Usage privé uniquement, peut casser quand YouTube change ses
> signatures. Non distribuable sur le Google Play Store.

## Structure

- `App.tsx` : import de playlist publique, recherche, mix, radio, favoris.
- `index.js` / `index.web.js` : points d'entrée (le service de lecture n'est enregistré que sur natif).
- `src/youtube/innertube.ts` : lecture des playlists, recherche, titres similaires et radios live via Innertube.
- `src/audio/` : résolveur de flux (`youtubei/v1/player`), lecteur et service react-native-track-player.
- `src/i18n.ts` : dictionnaires FR/EN et détection de langue.
- `app.json` : configuration Expo, schéma, icône et mode audio de fond.
- `package.json` : scripts Expo et vérification TypeScript.
