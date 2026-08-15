// Téléchargement hors ligne : récupère le flux progressif itag 18 (360p,
// audio + vidéo) résolu par streamResolver et le copie sur le stockage du
// téléphone. La lecture hors ligne repart du fichier local, donc zéro data
// au moment de l'écoute (utile au sport, en zone sans réseau).
//
// Les fichiers sont stockés dans Paths.document/offline/ et un index JSON
// (offline/index.json) mémorise les titres déjà téléchargés.

import { Directory, File, Paths } from 'expo-file-system';
import { resolveAudioStream } from './streamResolver';

export interface OfflineSong {
  id: string;
  title: string;
  channel: string;
  thumbnail: string;
  fileUri: string;
  sizeBytes: number;
  downloadedAt: number;
}

export interface DownloadableSong {
  id: string;
  title: string;
  channel: string;
  thumbnail: string;
}

const INDEX_FILE_NAME = 'index.json';

function offlineDirectory(): Directory {
  return new Directory(Paths.document, 'offline');
}

function ensureDirectory(): Directory {
  const dir = offlineDirectory();
  if (!dir.exists) {
    dir.create({ intermediates: true, idempotent: true });
  }
  return dir;
}

function indexFile(): File {
  return new File(ensureDirectory(), INDEX_FILE_NAME);
}

async function readIndex(): Promise<OfflineSong[]> {
  const f = indexFile();
  if (!f.exists) return [];
  try {
    const raw = await f.text();
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as OfflineSong[]) : [];
  } catch {
    return [];
  }
}

async function writeIndex(songs: OfflineSong[]): Promise<void> {
  const f = indexFile();
  if (f.exists) f.delete();
  f.create({ intermediates: true });
  f.write(JSON.stringify(songs));
}

/** Liste les titres déjà téléchargés (les fichiers manquants sont filtrés). */
export async function getOfflineSongs(): Promise<OfflineSong[]> {
  const index = await readIndex();
  return index.filter((song) => new File(song.fileUri).exists);
}

/** Télécharge un titre sur le stockage local. Retourne null si échec. */
export async function downloadSong(song: DownloadableSong): Promise<OfflineSong | null> {
  const resolved = await resolveAudioStream(song.id);
  if (!resolved?.url) return null;

  const target = new File(ensureDirectory(), `${song.id}.mp4`);
  try {
    await File.downloadFileAsync(resolved.url, target, { idempotent: true });
  } catch (e) {
    console.warn(`[offline] téléchargement échoué ${song.id}:`, (e as Error)?.message ?? String(e));
    return null;
  }

  const offline: OfflineSong = {
    id: song.id,
    title: song.title,
    channel: song.channel,
    thumbnail: song.thumbnail,
    fileUri: target.uri,
    sizeBytes: target.size ?? 0,
    downloadedAt: Date.now(),
  };

  const index = await readIndex();
  await writeIndex([...index.filter((item) => item.id !== song.id), offline]);
  return offline;
}

/** Supprime un titre téléchargé (fichier + entrée d'index). */
export async function removeOfflineSong(videoId: string): Promise<void> {
  const index = await readIndex();
  const entry = index.find((item) => item.id === videoId);
  if (entry) {
    const f = new File(entry.fileUri);
    if (f.exists) {
      try {
        f.delete();
      } catch {
        // déjà supprimé
      }
    }
  }
  await writeIndex(index.filter((item) => item.id !== videoId));
}

/** Supprime tout le cache hors ligne. */
export async function clearOfflineSongs(): Promise<void> {
  const index = await readIndex();
  for (const song of index) {
    const f = new File(song.fileUri);
    if (f.exists) {
      try {
        f.delete();
      } catch {
        // déjà supprimé
      }
    }
  }
  await writeIndex([]);
}
