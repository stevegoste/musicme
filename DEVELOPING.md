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

## Zone grise ToS

L'app interroge l'API interne de YouTube (Innertube) sans compte. Usage privé
uniquement, peut casser quand YouTube change ses signatures. **Non
distribuable sur le Google Play Store.**
