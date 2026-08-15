// Résolution des flux via l'API interne Innertube (client ANDROID).
//
// Constat important (testé en profondeur) : YouTube bloque désormais la
// récupération du flux audio SEUL :
// - le client iOS renvoie des URL audio (itag 140) mais elles n'acceptent
//   qu'un Range d'environ 1 Mo à partir de l'octet 0 → impossible de
//   télécharger/streamer un morceau complet (2,5 à 4 Mo) ;
// - le client ANDROID ne renvoie plus d'URL pour les formats adaptatifs
//   (PoToken requis) ;
// - le client WEB renvoie des URL chiffrées (PoToken) même avec cookies.
// Seul le format PROGRESSIF itag 18 (360p, audio + vidéo) reste entièrement
// accessible : il accepte n'importe quelle requête HTTP, donc il est lu
// directement par ExoPlayer. C'est le choix fiable pour l'écoute écran éteint.
// Compromis : ~4 Mo/min au lieu de ~1 Mo/min en audio pur.

const PLAYER_ENDPOINT = 'https://www.youtube.com/youtubei/v1/player';
// Clé Innertube publique du client WEB (embarquée dans youtubei.js).
const INNERTUBE_API_KEY = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';
const CLIENT_VERSION = '21.03.36';
const CLIENT_USER_AGENT = `com.google.android.youtube/${CLIENT_VERSION} (Linux; U; Android 16; en_US; SM-S908E Build/TP1A.220624.014) gzip`;

export interface ResolvedAudioStream {
  /** URL directe du flux (googlevideo). */
  url: string;
  /** Toujours null ici (streaming direct, pas de téléchargement). */
  contentLength: null;
  mimeType: string;
}

type PlayerResponse = {
  playabilityStatus?: { status?: string; reason?: string };
  streamingData?: {
    formats?: Array<{ itag?: number; url?: string; mimeType?: string }>;
    hlsManifestUrl?: string;
  };
};

function buildRequest(videoId: string): { url: string; options: RequestInit } {
  const body = {
    context: {
      client: {
        clientName: 'ANDROID',
        clientVersion: CLIENT_VERSION,
        androidSdkVersion: 36,
        hl: 'fr',
        gl: 'FR',
        utcOffsetMinutes: 60,
        userAgent: CLIENT_USER_AGENT,
      },
    },
    contentCheckOk: true,
    racyCheckOk: true,
    videoId,
  };
  return {
    url: `${PLAYER_ENDPOINT}?key=${INNERTUBE_API_KEY}&prettyPrint=false`,
    options: {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  };
}

/**
 * Résout l'URL de lecture (format progressif itag 18) d'une vidéo publique.
 * Retourne null si la vidéo est privée/supprimée/région-bloquée, ou en cas
 * d'erreur réseau.
 */
export async function resolveAudioStream(videoId: string): Promise<ResolvedAudioStream | null> {
  try {
    const { url, options } = buildRequest(videoId);
    const res = await fetch(url, options);
    if (!res.ok) {
      console.warn(`[audio] player HTTP ${res.status} pour ${videoId}`);
      return null;
    }
    const json = (await res.json()) as PlayerResponse;
    const status = json?.playabilityStatus?.status;
    if (status !== 'OK') {
      console.warn(
        `[audio] ${videoId} non lisible (status=${status ?? '?'}, reason=${json?.playabilityStatus?.reason ?? '?'})`,
      );
      return null;
    }

    const progressive = (json?.streamingData?.formats ?? []).find((f) => f?.url);
    if (progressive?.url) {
      console.log(`[audio] flux résolu ${videoId} (itag ${progressive.itag}, progressif)`);
      return { url: progressive.url, contentLength: null, mimeType: progressive.mimeType ?? 'video/mp4' };
    }

    console.warn(`[audio] aucun format progressif pour ${videoId}`);
    return null;
  } catch (e) {
    console.warn(`[audio] échec de résolution du flux ${videoId}:`, (e as Error)?.message ?? String(e));
    return null;
  }
}

/**
 * Résout l'URL HLS (m3u8) d'un flux YouTube en direct (radio live).
 * Les directs n'ont pas de format progressif : on renvoie leur manifest HLS,
 * que ExoPlayer sait lire nativement. Retourne null si indisponible.
 */
export async function resolveLiveStreamUrl(videoId: string): Promise<string | null> {
  try {
    const { url, options } = buildRequest(videoId);
    const res = await fetch(url, options);
    if (!res.ok) return null;
    const json = (await res.json()) as PlayerResponse;
    if (json?.playabilityStatus?.status !== 'OK') return null;
    const hls = json?.streamingData?.hlsManifestUrl;
    if (typeof hls === 'string' && hls) {
      console.log(`[radio] HLS résolu ${videoId}`);
      return hls;
    }
    console.warn(`[radio] pas de manifest HLS pour ${videoId}`);
    return null;
  } catch (e) {
    console.warn(`[radio] échec de résolution HLS ${videoId}:`, (e as Error)?.message ?? String(e));
    return null;
  }
}

/** Plus de session youtubei.js à réinitialiser — gardé pour compatibilité. */
export function resetStreamResolver(): void {
  // rien à faire
}
