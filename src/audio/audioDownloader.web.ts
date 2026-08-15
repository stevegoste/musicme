// Le téléchargement hors ligne n'existe que sur natif (le web n'a pas accès
// à un stockage de fichiers exploitable par un lecteur audio).

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

export async function getOfflineSongs(): Promise<OfflineSong[]> {
  return [];
}

export async function downloadSong(_song: DownloadableSong): Promise<OfflineSong | null> {
  return null;
}

export async function removeOfflineSong(_videoId: string): Promise<void> {
  // rien à faire sur le web
}

export async function clearOfflineSongs(): Promise<void> {
  // rien à faire sur le web
}
