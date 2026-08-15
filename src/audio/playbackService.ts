import TrackPlayer, { Event } from 'react-native-track-player';

// Service de lecture en arrière-plan : gère les commandes de l'écran
// verrouillé, de la notification et des écouteurs/Bluetooth.
export async function playbackService(): Promise<void> {
  TrackPlayer.addEventListener(Event.RemotePlay, () => TrackPlayer.play());
  TrackPlayer.addEventListener(Event.RemotePause, () => TrackPlayer.pause());
  TrackPlayer.addEventListener(Event.RemoteNext, () => TrackPlayer.skipToNext());
  TrackPlayer.addEventListener(Event.RemotePrevious, () => TrackPlayer.skipToPrevious());
  TrackPlayer.addEventListener(Event.RemoteSeek, (event) => {
    if (typeof event.position === 'number') {
      TrackPlayer.seekTo(event.position);
    }
  });
  TrackPlayer.addEventListener(Event.RemoteStop, () => TrackPlayer.reset());
}
