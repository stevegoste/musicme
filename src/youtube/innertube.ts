// Lecture d'une playlist publique via l'API interne Innertube (client WEB).
// Aucune clé YouTube Data API n'est nécessaire : on interroge l'endpoint
// `youtubei/v1/browse` comme le ferait le site YouTube. La clé utilisée est
// la clé publique du client WEB (la même que youtubei.js), elle n'est pas un
// secret.
//
// Note : YouTube a migré le rendu des playlists vers la structure
// `lockupViewModel` (plus de `playlistVideoRenderer`). On parse donc les
// lockups et on suit les continuations jusqu'à la limite demandée.

const BROWSE_ENDPOINT = 'https://www.youtube.com/youtubei/v1/browse';
const NEXT_ENDPOINT = 'https://www.youtube.com/youtubei/v1/next';
const SEARCH_ENDPOINT = 'https://www.youtube.com/youtubei/v1/search';
// Clé Innertube publique (embarquée dans le client WEB / youtubei.js).
const INNERTUBE_API_KEY = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';
const CLIENT_VERSION = '2.20260101.01.00';

export interface InnertubeSong {
  id: string;
  title: string;
  channel: string;
  thumbnail: string;
  unplayable: boolean;
}

export interface InnertubePlaylist {
  title: string;
  channel: string;
  songs: InnertubeSong[];
}

export interface InnertubePlaylistSummary {
  id: string;
  title: string;
  channel: string;
  thumbnail: string;
  itemCount: number;
}

export interface InnertubeLiveStream {
  id: string;
  title: string;
  channel: string;
  thumbnail: string;
}

function buildContext() {
  return {
    context: {
      client: {
        clientName: 'WEB',
        clientVersion: CLIENT_VERSION,
        hl: 'fr',
        gl: 'FR',
        utcOffsetMinutes: 60,
      },
    },
  };
}

async function browse(body: unknown): Promise<Record<string, unknown>> {
  const res = await fetch(`${BROWSE_ENDPOINT}?key=${INNERTUBE_API_KEY}&prettyPrint=false`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`YouTube a répondu avec le code ${res.status}.`);
  }
  return (await res.json()) as Record<string, unknown>;
}

/** Parcours récursif de la réponse pour trouver tous les objets portant une clé donnée. */
function deepFind<T>(value: unknown, key: string, out: T[]): void {
  if (value == null || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    for (const item of value) deepFind(item, key, out);
    return;
  }
  const obj = value as Record<string, unknown>;
  if (key in obj) out.push(obj[key] as T);
  for (const child of Object.values(obj)) deepFind(child, key, out);
}

/** Lit un champ texte Innertube : chaîne brute, {content}, {simpleText} ou {runs}. */
function textOf(node: unknown): string {
  if (typeof node === 'string') return node;
  if (!node || typeof node !== 'object') return '';
  const n = node as { content?: string; simpleText?: string; runs?: Array<{ text?: string }> };
  return n.content ?? n.simpleText ?? n.runs?.[0]?.text ?? '';
}

function stripChannelPrefix(label: string): string {
  const match = label?.match(
    /(?:accéder à la chaîne|aller à la chaîne|go to channel|zum kanal|ir al canal|vai al canale|accedi al canale)\s*:?\s*(.+)$/i,
  );
  return match ? match[1].trim() : '';
}

function isStatsText(value: string) {
  return (
    /vues|views|il y a|ago|abonn|subscriber|subscribers|lecture|watch|membres|members|j'aime|likes/i.test(
      value,
    ) || /^\d/.test(value)
  );
}

function channelOf(lockup: Record<string, any>): string {
  // Source fiable : l'avatar de la chaîne (`a11yLabel` « Accéder à la chaîne X »).
  const avatars: Array<{ a11yLabel?: string }> = [];
  deepFind(lockup, 'decoratedAvatarViewModel', avatars);
  for (const avatar of avatars) {
    const stripped = stripChannelPrefix(avatar.a11yLabel ?? '');
    if (stripped) return stripped;
  }

  // Repli : la première ligne de métadonnées qui ne ressemble pas à des stats.
  const rows = lockup?.metadata?.lockupMetadataViewModel?.metadata?.contentMetadataViewModel
    ?.metadataRows;
  for (const row of (rows ?? []) as Array<{ metadataParts?: Array<{ text?: unknown }> }>) {
    for (const part of row.metadataParts ?? []) {
      const text = textOf(part.text);
      if (text && !isStatsText(text)) return text;
    }
  }
  return '';
}

function isUnplayableTitle(title: string) {
  const t = title.toLowerCase().replace(/[\\[\\]]/g, '').trim();
  return ['private video', 'deleted video', 'video privee', 'video supprimee'].includes(t);
}

function toDisplayTitle(title: string) {
  const t = title.toLowerCase().replace(/[\\[\\]]/g, '').trim();
  if (t === 'private video') return 'Video privee';
  if (t === 'deleted video') return 'Video supprimee';
  return title;
}

function parseSong(lockup: Record<string, any>, fallbackChannel: string): InnertubeSong | null {
  const id = lockup?.contentId;
  const title = textOf(lockup?.metadata?.lockupMetadataViewModel?.title);
  if (!id || !title) return null;

  const sources = (lockup?.contentImage?.thumbnailViewModel?.image?.sources ??
    []) as Array<{ url?: string }>;
  const thumbnail =
    sources[1]?.url ?? sources[0]?.url ?? `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;

  return {
    id,
    title: toDisplayTitle(title),
    channel: channelOf(lockup) || fallbackChannel || 'YouTube',
    thumbnail,
    unplayable: isUnplayableTitle(title),
  };
}

/**
 * Charge les titres (et le nom) d'une playlist publique via Innertube.
 * Suit les continuations jusqu'à `limit` titres. Lève une erreur si la
 * playlist est introuvable ou privée.
 */
export async function fetchPublicPlaylist(
  playlistId: string,
  limit = 1000,
): Promise<InnertubePlaylist> {
  let response = await browse({ ...buildContext(), browseId: `VL${playlistId}` });

  const metas: Array<{ title?: unknown }> = [];
  deepFind(response, 'playlistMetadataRenderer', metas);
  let title = textOf(metas[0]?.title);
  if (!title) {
    const sidebars: Array<{ title?: unknown }> = [];
    deepFind(response, 'playlistSidebarPrimaryInfoRenderer', sidebars);
    title = textOf(sidebars[0]?.title);
  }
  if (!title) {
    const header = (response as { header?: { pageHeaderRenderer?: { pageTitle?: string } } })
      .header;
    title = header?.pageHeaderRenderer?.pageTitle ?? '';
  }
  if (!title) title = 'Playlist publique';

  const owners: Array<{ title?: unknown }> = [];
  deepFind(response, 'videoOwnerRenderer', owners);
  const ownerChannel = textOf(owners[0]?.title) || 'YouTube';

  const songs: InnertubeSong[] = [];
  let token: string | null = null;

  for (let page = 0; page < 20; page += 1) {
    const lockups: Array<Record<string, any>> = [];
    deepFind(response, 'lockupViewModel', lockups);

    for (const lockup of lockups) {
      const song = parseSong(lockup, ownerChannel);
      if (song) {
        songs.push(song);
        if (songs.length >= limit) break;
      }
    }

    if (songs.length >= limit) break;

    const continuations: Array<{
      continuationEndpoint?: { continuationCommand?: { token?: string } };
    }> = [];
    deepFind(response, 'continuationItemRenderer', continuations);
    token = continuations
      .map((c) => c.continuationEndpoint?.continuationCommand?.token)
      .find((value) => value) ?? null;
    if (!token) break;

    response = await browse({ ...buildContext(), continuation: token });
  }

  if (songs.length === 0) {
    throw new Error(
      'Cette playlist est introuvable ou privée. Elle est peut-être passée en privé : ouvre-la dans YouTube.',
    );
  }

  return { title, channel: ownerChannel, songs };
}

async function nextCall(body: unknown): Promise<Record<string, unknown>> {
  const res = await fetch(`${NEXT_ENDPOINT}?key=${INNERTUBE_API_KEY}&prettyPrint=false`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`YouTube a répondu avec le code ${res.status}.`);
  }
  return (await res.json()) as Record<string, unknown>;
}

async function searchCall(body: unknown): Promise<Record<string, unknown>> {
  const res = await fetch(`${SEARCH_ENDPOINT}?key=${INNERTUBE_API_KEY}&prettyPrint=false`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`YouTube a répondu avec le code ${res.status}.`);
  }
  return (await res.json()) as Record<string, unknown>;
}

/** Extrait le nombre de vidéos d'une playlist depuis le badge « 134 vidéos ». */
function playlistCountOf(lockup: Record<string, any>): number {
  const badges: Array<{ text?: unknown }> = [];
  deepFind(lockup, 'thumbnailBadgeViewModel', badges);
  for (const badge of badges) {
    const text = textOf(badge.text);
    const match = text.match(/(\d[\d\s\u00a0]*)/);
    if (match) {
      const num = parseInt(match[1].replace(/[\s\u00a0]/g, ''), 10);
      if (Number.isFinite(num)) return num;
    }
  }
  return 0;
}

/**
 * Recherche des playlists publiques via l'endpoint `youtubei/v1/search`.
 * Suit les continuations pour renvoyer plus de résultats (jusqu'à `limit`).
 * Retourne des résumés (id, titre, chaîne, miniature, nombre de vidéos).
 */
export async function searchPlaylists(
  query: string,
  limit = 50,
): Promise<InnertubePlaylistSummary[]> {
  const results: InnertubePlaylistSummary[] = [];
  const seen = new Set<string>();
  let response = await searchCall({ ...buildContext(), query });

  for (let page = 0; page < 10; page += 1) {
    const lockups: Array<Record<string, any>> = [];
    deepFind(response, 'lockupViewModel', lockups);

    for (const lockup of lockups) {
      if (lockup?.contentType !== 'LOCKUP_CONTENT_TYPE_PLAYLIST') continue;
      const id = lockup?.contentId;
      if (!id || !id.startsWith('PL') || seen.has(id)) continue;

      const title = textOf(lockup?.metadata?.lockupMetadataViewModel?.title);
      if (!title) continue;

      const sources = (lockup?.contentImage?.collectionThumbnailViewModel?.primaryThumbnail
        ?.thumbnailViewModel?.image?.sources ?? []) as Array<{ url?: string }>;
      const thumbnail = sources[0]?.url ?? '';

      seen.add(id);
      results.push({
        id,
        title,
        channel: channelOf(lockup) || 'YouTube',
        thumbnail,
        itemCount: playlistCountOf(lockup),
      });
      if (results.length >= limit) break;
    }

    if (results.length >= limit) break;

    const continuations: Array<{
      continuationEndpoint?: { continuationCommand?: { token?: string } };
    }> = [];
    deepFind(response, 'continuationItemRenderer', continuations);
    const token = continuations
      .map((c) => c.continuationEndpoint?.continuationCommand?.token)
      .find((value) => value) ?? null;
    if (!token) break;

    response = await searchCall({ ...buildContext(), continuation: token });
  }

  return results;
}

/**
 * Charge des titres « similaires » à une vidéo (mode Radio) via l'endpoint
 * `youtubei/v1/next` (les recommandations de la page de lecture). Suit les
 * continuations jusqu'à `limit` titres uniques.
 */
export async function fetchRelatedTracks(videoId: string, limit = 60): Promise<InnertubeSong[]> {
  const songs: InnertubeSong[] = [];
  const seen = new Set<string>();
  let token: string | null = null;
  let response = await nextCall({ ...buildContext(), videoId });

  for (let page = 0; page < 20; page += 1) {
    const lockups: Array<Record<string, any>> = [];
    deepFind(response, 'lockupViewModel', lockups);

    for (const lockup of lockups) {
      const song = parseSong(lockup, 'YouTube');
      if (song && !seen.has(song.id)) {
        seen.add(song.id);
        songs.push(song);
        if (songs.length >= limit) break;
      }
    }

    if (songs.length >= limit) break;

    const continuations: Array<{
      continuationEndpoint?: { continuationCommand?: { token?: string } };
    }> = [];
    deepFind(response, 'continuationItemRenderer', continuations);
    token = continuations
      .map((c) => c.continuationEndpoint?.continuationCommand?.token)
      .find((value) => value) ?? null;
    if (!token) break;

    response = await nextCall({ ...buildContext(), continuation: token });
  }

  return songs;
}

/**
 * Recherche des « radios live » (flux YouTube en direct) via l'endpoint
 * `youtubei/v1/search`. Les directs sont rendus en `videoRenderer` avec un
 * badge LIVE. Retourne des résumés (id, titre, chaîne, miniature).
 */
export async function searchLiveStreams(
  query: string,
  limit = 30,
): Promise<InnertubeLiveStream[]> {
  const results: InnertubeLiveStream[] = [];
  const seen = new Set<string>();
  let response = await searchCall({ ...buildContext(), query });

  for (let page = 0; page < 5; page += 1) {
    const renderers: Array<Record<string, any>> = [];
    deepFind(response, 'videoRenderer', renderers);

    for (const renderer of renderers) {
      const id = renderer?.videoId;
      if (!id || seen.has(id)) continue;

      // Le badge « EN DIRECT » a changé de structure : style
      // BADGE_STYLE_TYPE_LIVE_NOW (et iconType LIVE), l'ancien était "LIVE".
      const isLive = (renderer?.badges ?? []).some((badge: Record<string, any>) => {
        const meta = badge?.metadataBadgeRenderer;
        return (
          meta?.style === 'BADGE_STYLE_TYPE_LIVE_NOW' ||
          meta?.style === 'LIVE' ||
          meta?.icon?.iconType === 'LIVE'
        );
      });
      if (!isLive) continue;

      const title = textOf(renderer?.title);
      if (!title) continue;

      const channel = textOf(renderer?.ownerText ?? renderer?.longBylineText) || 'YouTube';
      const thumbs = (renderer?.thumbnail?.thumbnails ?? []) as Array<{ url?: string }>;
      const thumbnail = thumbs[1]?.url ?? thumbs[0]?.url ?? '';

      seen.add(id);
      results.push({ id, title, channel, thumbnail });
      if (results.length >= limit) break;
    }

    if (results.length >= limit) break;

    const continuations: Array<{
      continuationEndpoint?: { continuationCommand?: { token?: string } };
    }> = [];
    deepFind(response, 'continuationItemRenderer', continuations);
    const token = continuations
      .map((c) => c.continuationEndpoint?.continuationCommand?.token)
      .find((value) => value) ?? null;
    if (!token) break;

    response = await searchCall({ ...buildContext(), continuation: token });
  }

  return results;
}
