import { registerRootComponent } from 'expo';
import App from './App';
import TrackPlayer from 'react-native-track-player';
import { playbackService } from './src/audio/playbackService';

registerRootComponent(App);
TrackPlayer.registerPlaybackService(() => playbackService);
