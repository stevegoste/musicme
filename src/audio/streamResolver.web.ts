// Résolution des flux : native uniquement.
export interface ResolvedAudioStream {
  url: string;
  contentLength: number | null;
  mimeType: string;
}

export async function resolveAudioStream(_videoId: string): Promise<ResolvedAudioStream | null> {
  return null;
}

export function resetStreamResolver(): void {
  // rien à faire sur le web
}
