// Le mode audio (écran éteint) n'existe que sur natif.
// Ce stub évite d'importer react-native-track-player (et shaka-player) sur le web.
export interface AudioTrack {
  id: string;
  url: string;
  title: string;
  artist?: string;
  artwork?: string;
}

export async function setupAudioPlayer(): Promise<void> {
  throw new Error("Le mode audio n'est pas disponible sur le web.");
}

export async function playAudioQueue(_tracks: AudioTrack[]): Promise<void> {
  throw new Error("Le mode audio n'est pas disponible sur le web.");
}

export async function resetAudioPlayer(): Promise<void> {
  throw new Error("Le mode audio n'est pas disponible sur le web.");
}

export async function addAudioTrack(_track: AudioTrack, _playNow: boolean): Promise<void> {
  throw new Error("Le mode audio n'est pas disponible sur le web.");
}

export async function stopAudio(): Promise<void> {
  // rien à faire sur le web
}

export async function togglePlayback(): Promise<void> {
  // rien à faire sur le web
}

export async function skipToNextTrack(): Promise<void> {
  // rien à faire sur le web
}

export async function skipToPreviousTrack(): Promise<void> {
  // rien à faire sur le web
}

export async function seekToPosition(_position: number): Promise<void> {
  // rien à faire sur le web
}

// Hooks stubs pour que l'UI compile sur le web sans react-native-track-player.
export function useProgress(_updateInterval?: number) {
  return { position: 0, duration: 0, buffered: 0 };
}

export function useIsPlaying() {
  return { playing: false, bufferingDuringPlay: false };
}

export function useActiveTrack() {
  return undefined;
}
