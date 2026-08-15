// Stockage des « mix » (fusions de plusieurs playlists) : jusqu'à 3 mixes
// conservés avec leurs titres pour basculer entre la playlist de base et
// chaque mix. Fichier JSON (document/mix.json) côté natif, localStorage côté web.

import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

export interface MixSong {
  id: string;
  title: string;
  channel: string;
  thumbnail: string;
  unplayable: boolean;
}

export interface Mix {
  id: string;
  title: string;
  channel: string;
  thumbnail: string;
  songs: MixSong[];
  sourceIds: string[];
}

const STORAGE_KEY = 'musicme_mix';
const FILE_NAME = 'mix.json';

type BrowserStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
};

function browserStorage(): BrowserStorage | null {
  if (Platform.OS !== 'web') return null;
  return (globalThis as unknown as { localStorage?: BrowserStorage }).localStorage ?? null;
}

/** Normalise une valeur lue : tableau de mixes, ou ancien mix unique migré. */
function normalizeMixes(raw: string | null): Mix[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as Mix[];
    // Ancienne version : un seul mix stocké comme objet.
    if (parsed && typeof parsed === 'object') return [parsed as Mix];
    return [];
  } catch {
    return [];
  }
}

/** Lecture synchrone (uniquement pour l'état initial web). */
export function getStoredMixSync(): Mix[] {
  return normalizeMixes(browserStorage()?.getItem(STORAGE_KEY) ?? null);
}

function mixFile(): File {
  return new File(new Directory(Paths.document), FILE_NAME);
}

export async function loadStoredMix(): Promise<Mix[]> {
  if (Platform.OS === 'web') return getStoredMixSync();
  const file = mixFile();
  if (!file.exists) return [];
  try {
    return normalizeMixes(await file.text());
  } catch {
    return [];
  }
}

export async function saveStoredMix(mixes: Mix[]): Promise<void> {
  if (Platform.OS === 'web') {
    const storage = browserStorage();
    if (!storage) return;
    if (mixes.length) storage.setItem(STORAGE_KEY, JSON.stringify(mixes));
    else storage.removeItem(STORAGE_KEY);
    return;
  }
  const file = mixFile();
  if (mixes.length) {
    if (file.exists) file.delete();
    file.create({ intermediates: true });
    file.write(JSON.stringify(mixes));
  } else if (file.exists) {
    file.delete();
  }
}
