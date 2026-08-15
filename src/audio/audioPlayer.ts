import TrackPlayer, { Capability, RepeatMode, State, TrackType } from 'react-native-track-player';

// Hooks réexportés pour l'UI (lecture/pause, progression, piste active).
export { useActiveTrack, useIsPlaying, useProgress } from 'react-native-track-player';

export interface AudioTrack {
  id: string;
  url: string;
  title: string;
  artist?: string;
  artwork?: string;
  type?: TrackType;
  contentType?: string;
}

let playerReady = false;

export async function setupAudioPlayer(): Promise<void> {
  if (playerReady) return;
  await TrackPlayer.setupPlayer();
  await TrackPlayer.updateOptions({
    capabilities: [
      Capability.Play,
      Capability.Pause,
      Capability.SkipToNext,
      Capability.SkipToPrevious,
      Capability.SeekTo,
    ],
    compactCapabilities: [Capability.Play, Capability.Pause, Capability.SkipToNext, Capability.SkipToPrevious],
    notificationCapabilities: [Capability.Play, Capability.Pause, Capability.SkipToNext, Capability.SkipToPrevious],
    progressUpdateEventInterval: 2,
  });
  await TrackPlayer.setRepeatMode(RepeatMode.Queue);
  playerReady = true;
}

/** Prépare une nouvelle session (setup + file vidée). */
export async function resetAudioPlayer(): Promise<void> {
  await setupAudioPlayer();
  await TrackPlayer.reset();
}

/** Ajoute un titre à la file ; si `playNow`, lance la lecture. */
export async function addAudioTrack(track: AudioTrack, playNow: boolean): Promise<void> {
  await TrackPlayer.add(track);
  if (playNow) await TrackPlayer.play();
}

/** Remplace la file et lance la lecture (usage legacy). */
export async function playAudioQueue(tracks: AudioTrack[]): Promise<void> {
  await setupAudioPlayer();
  await TrackPlayer.reset();
  await TrackPlayer.add(tracks);
  await TrackPlayer.play();
}

export async function stopAudio(): Promise<void> {
  try {
    await TrackPlayer.reset();
  } catch {
    // player non initialisé : rien à faire
  }
}

/** Bascule lecture/pause selon l'état réel du lecteur. */
export async function togglePlayback(): Promise<void> {
  try {
    const { state } = await TrackPlayer.getPlaybackState();
    if (state === State.Playing || state === State.Buffering || state === State.Loading) {
      await TrackPlayer.pause();
    } else {
      await TrackPlayer.play();
    }
  } catch {
    // player non initialisé : rien à faire
  }
}

export async function skipToNextTrack(): Promise<void> {
  await TrackPlayer.skipToNext();
}

export async function skipToPreviousTrack(): Promise<void> {
  await TrackPlayer.skipToPrevious();
}

export async function seekToPosition(position: number): Promise<void> {
  await TrackPlayer.seekTo(position);
}
