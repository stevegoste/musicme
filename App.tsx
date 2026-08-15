import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  FlatList,
  Image,
  Linking,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';

import { TrackType } from 'react-native-track-player';

import { resolveAudioStream, resolveLiveStreamUrl } from './src/audio/streamResolver';
import {
  fetchPublicPlaylist,
  fetchRelatedTracks,
  searchLiveStreams,
  searchPlaylists,
  type InnertubeLiveStream,
} from './src/youtube/innertube';
import { detectLanguage, translate, type Language } from './src/i18n';
import {
  addAudioTrack,
  resetAudioPlayer,
  seekToPosition,
  skipToNextTrack,
  skipToPreviousTrack,
  stopAudio,
  togglePlayback,
  useActiveTrack,
  useIsPlaying,
  useProgress,
} from './src/audio/audioPlayer';
import {
  clearOfflineSongs,
  downloadSong,
  getOfflineSongs,
  OfflineSong,
} from './src/audio/audioDownloader';
import { getStoredMixSync, loadStoredMix, saveStoredMix, type Mix } from './src/storage/mix';

type Playlist = {
  id: string;
  title: string;
  channel: string;
  thumbnail: string;
  itemCount: number;
};

type Song = {
  id: string;
  title: string;
  channel: string;
  thumbnail: string;
  unplayable: boolean;
};

type PlaylistHistoryEntry = {
  id: string;
  input: string;
  title: string;
};

const colors = {
  background: '#0D0F14',
  card: '#171A22',
  cardSoft: '#20242E',
  ink: '#F7F8FA',
  muted: '#9299A8',
  accent: '#FF375F',
  border: '#292E39',
  success: '#76D5AD',
};

// On charge un echantillon de titres par playlist : 1000 suffit pour une
// longue ecoute en continu sans alourdir la persistance.
const MAX_SONGS_PER_PLAYLIST = 1000;
const AUDIO_BATCH_SIZE = 200;
const MAX_MIXES = 3;

// Genres proposés en accès rapide dans la recherche (requête YouTube + clé i18n).
const GENRES: Array<{ key: string; query: string }> = [
  { key: 'metal', query: 'metal playlist' },
  { key: 'rock', query: 'rock playlist' },
  { key: 'funk', query: 'funk playlist' },
  { key: 'rap', query: 'rap playlist' },
  { key: 'jazz', query: 'jazz playlist' },
  { key: 'lofi', query: 'lofi playlist' },
  { key: 'pop', query: 'pop playlist' },
  { key: 'electro', query: 'electro playlist' },
  { key: 'classical', query: 'classical playlist' },
  { key: 'latino', query: 'latino playlist' },
  { key: 'reggae', query: 'reggae playlist' },
  { key: 'blues', query: 'blues playlist' },
];

type BrowserStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
};

function getBrowserStorage() {
  if (Platform.OS !== 'web') return null;
  return (globalThis as unknown as { localStorage?: BrowserStorage }).localStorage ?? null;
}

const PUBLIC_PLAYLIST_STORAGE_KEY = 'public_playlist_state';
const FAVORITES_STORAGE_KEY = 'musicme_favorites';
const LANGUAGE_STORAGE_KEY = 'musicme_language';
const MIX_STORAGE_KEY = 'musicme_mix';
const PLAYLIST_HISTORY_STORAGE_KEY = 'musicme_playlist_history';
const WELCOME_STORAGE_KEY = 'musicme_welcome_seen';
const FAVORITE_RADIOS_STORAGE_KEY = 'musicme_favorite_radios';

type PublicPlaylistSnapshot = {
  input: string;
  selectedPlaylist: Playlist | null;
  songs: Song[];
};

function getStoredPublicPlaylistSnapshot(): PublicPlaylistSnapshot | null {
  const raw = getBrowserStorage()?.getItem(PUBLIC_PLAYLIST_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PublicPlaylistSnapshot;
  } catch {
    return null;
  }
}

async function persistPublicPlaylistSnapshot(snapshot: PublicPlaylistSnapshot) {
  const raw = JSON.stringify(snapshot);
  if (Platform.OS === 'web') {
    getBrowserStorage()?.setItem(PUBLIC_PLAYLIST_STORAGE_KEY, raw);
  } else {
    await SecureStore.setItemAsync(PUBLIC_PLAYLIST_STORAGE_KEY, raw);
  }
}

function getStoredFavorites(): Song[] {
  const raw = getBrowserStorage()?.getItem(FAVORITES_STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Song[]) : [];
  } catch {
    return [];
  }
}

async function persistFavorites(favorites: Song[]) {
  const raw = JSON.stringify(favorites);
  if (Platform.OS === 'web') {
    getBrowserStorage()?.setItem(FAVORITES_STORAGE_KEY, raw);
  } else {
    await SecureStore.setItemAsync(FAVORITES_STORAGE_KEY, raw);
  }
}

function getStoredLanguage(): Language | null {
  const raw = getBrowserStorage()?.getItem(LANGUAGE_STORAGE_KEY);
  return raw === 'fr' || raw === 'en' ? raw : null;
}

async function persistLanguage(lang: Language) {
  if (Platform.OS === 'web') {
    getBrowserStorage()?.setItem(LANGUAGE_STORAGE_KEY, lang);
  } else {
    await SecureStore.setItemAsync(LANGUAGE_STORAGE_KEY, lang);
  }
}

function getStoredMix(): Playlist[] {
  const raw = getBrowserStorage()?.getItem(MIX_STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Playlist[]) : [];
  } catch {
    return [];
  }
}

async function persistMix(mix: Playlist[]) {
  const raw = JSON.stringify(mix);
  if (Platform.OS === 'web') {
    getBrowserStorage()?.setItem(MIX_STORAGE_KEY, raw);
  } else {
    await SecureStore.setItemAsync(MIX_STORAGE_KEY, raw);
  }
}

function getStoredPlaylistHistory(): PlaylistHistoryEntry[] {
  const raw = getBrowserStorage()?.getItem(PLAYLIST_HISTORY_STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PlaylistHistoryEntry[]) : [];
  } catch {
    return [];
  }
}

async function persistPlaylistHistory(history: PlaylistHistoryEntry[]) {
  const raw = JSON.stringify(history);
  if (Platform.OS === 'web') {
    getBrowserStorage()?.setItem(PLAYLIST_HISTORY_STORAGE_KEY, raw);
  } else {
    await SecureStore.setItemAsync(PLAYLIST_HISTORY_STORAGE_KEY, raw);
  }
}

function getStoredWelcomeSeen(): boolean {
  const raw = getBrowserStorage()?.getItem(WELCOME_STORAGE_KEY);
  return raw === '1' || raw === 'true';
}

async function persistWelcomeSeen() {
  if (Platform.OS === 'web') {
    getBrowserStorage()?.setItem(WELCOME_STORAGE_KEY, '1');
  } else {
    await SecureStore.setItemAsync(WELCOME_STORAGE_KEY, '1');
  }
}

function getStoredFavoriteRadios(): InnertubeLiveStream[] {
  const raw = getBrowserStorage()?.getItem(FAVORITE_RADIOS_STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as InnertubeLiveStream[]) : [];
  } catch {
    return [];
  }
}

async function persistFavoriteRadios(radios: InnertubeLiveStream[]) {
  const raw = JSON.stringify(radios);
  if (Platform.OS === 'web') {
    getBrowserStorage()?.setItem(FAVORITE_RADIOS_STORAGE_KEY, raw);
  } else {
    await SecureStore.setItemAsync(FAVORITE_RADIOS_STORAGE_KEY, raw);
  }
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function formatBytes(bytes: number) {
  if (!bytes) return '0 Mo';
  const mb = bytes / (1024 * 1024);
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} Go`;
  return `${mb.toFixed(0)} Mo`;
}

function normalizeForSearch(value: string) {
  return value
    .toLowerCase()
    .replace(/[àáâãäå]/g, 'a')
    .replace(/[ç]/g, 'c')
    .replace(/[èéêë]/g, 'e')
    .replace(/[ìíîï]/g, 'i')
    .replace(/[ñ]/g, 'n')
    .replace(/[òóôõö]/g, 'o')
    .replace(/[ùúûü]/g, 'u')
    .replace(/[ýÿ]/g, 'y');
}

function extractPlaylistId(value: string) {
  const trimmed = value.trim();
  const match = trimmed.match(/[?&]list=([a-zA-Z0-9_-]+)/) ?? trimmed.match(/^([a-zA-Z0-9_-]{10,})$/);
  return match?.[1] ?? null;
}

function shuffleArray<T>(array: T[]): T[] {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function formatTime(total: number) {
  if (!Number.isFinite(total) || total < 0) return '0:00';
  const minutes = Math.floor(total / 60);
  const seconds = Math.floor(total % 60);
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function SeekBar({
  position,
  duration,
  onSeek,
}: {
  position: number;
  duration: number;
  onSeek: (position: number) => void;
}) {
  const [width, setWidth] = useState(0);
  const ratio = duration > 0 ? Math.min(1, Math.max(0, position / duration)) : 0;
  return (
    <Pressable
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      onPress={(event) => {
        if (width <= 0 || duration <= 0) return;
        const next = Math.min(1, Math.max(0, event.nativeEvent.locationX / width)) * duration;
        onSeek(next);
      }}
      style={seekBarStyles.track}
    >
      <View style={[seekBarStyles.fill, { width: `${ratio * 100}%` as `${number}%` }]} />
    </Pressable>
  );
}

const seekBarStyles = StyleSheet.create({
  track: {
    backgroundColor: colors.border,
    borderRadius: 2,
    flex: 1,
    height: 4,
    justifyContent: 'center',
  },
  fill: {
    backgroundColor: colors.accent,
    borderRadius: 2,
    height: 4,
  },
});

export default function App() {
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(
    () => getStoredPublicPlaylistSnapshot()?.selectedPlaylist ?? null,
  );
  const [songs, setSongs] = useState<Song[]>(() => getStoredPublicPlaylistSnapshot()?.songs ?? []);
  const [publicPlaylistInput, setPublicPlaylistInput] = useState(
    () => getStoredPublicPlaylistSnapshot()?.input ?? '',
  );
  const [openListId, setOpenListId] = useState<string | null>(null);
  const [loading, setLoading] = useState<'songs' | null>(null);
  const [message, setMessage] = useState('');
  const [audioLoading, setAudioLoading] = useState(false);
  const [audioMode, setAudioMode] = useState(false);
  const [audioCount, setAudioCount] = useState(0);
  const [offlineSongs, setOfflineSongs] = useState<OfflineSong[]>([]);
  const [downloadState, setDownloadState] = useState<'idle' | 'downloading'>('idle');
  const [downloadProgress, setDownloadProgress] = useState<{ done: number; total: number } | null>(null);
  const [downloadingIds, setDownloadingIds] = useState<Set<string>>(() => new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [sessionRestored, setSessionRestored] = useState(Platform.OS === 'web');
  const [welcomeSeen, setWelcomeSeen] = useState(() =>
    Platform.OS === 'web' ? getStoredWelcomeSeen() : false,
  );
  const [showWelcome, setShowWelcome] = useState(false);
  const [sleepSecondsLeft, setSleepSecondsLeft] = useState<number | null>(null);
  const [shuffleEnabled, setShuffleEnabled] = useState(true);
  const [lang, setLang] = useState<Language>(() => getStoredLanguage() ?? detectLanguage());
  const [favorites, setFavorites] = useState<Song[]>(() => getStoredFavorites());
  const [view, setView] = useState<'playlist' | 'mix' | 'favorites'>('playlist');
  const [mixPlaylists, setMixPlaylists] = useState<Playlist[]>(() => getStoredMix());
  const [mixSearchQuery, setMixSearchQuery] = useState('');
  const [mixSearchResults, setMixSearchResults] = useState<Playlist[]>([]);
  const [mixSearchLoading, setMixSearchLoading] = useState(false);
  const [mixSearchFocused, setMixSearchFocused] = useState(false);
  const [mixLoading, setMixLoading] = useState(false);
  const [mixPanelOpen, setMixPanelOpen] = useState(true);
  const [radioPanelOpen, setRadioPanelOpen] = useState(false);
  const [radioResults, setRadioResults] = useState<InnertubeLiveStream[]>([]);
  const [radioLoading, setRadioLoading] = useState(false);
  const [favoriteRadios, setFavoriteRadios] = useState<InnertubeLiveStream[]>(() =>
    getStoredFavoriteRadios(),
  );
  const [playlistHistory, setPlaylistHistory] = useState<PlaylistHistoryEntry[]>(
    () => getStoredPlaylistHistory(),
  );
  const [linkInputCollapsed, setLinkInputCollapsed] = useState(false);
  const [mixes, setMixes] = useState<Mix[]>(() => getStoredMixSync());
  const [activeMixId, setActiveMixId] = useState<string | null>(null);
  const [mixStyle, setMixStyle] = useState<string | null>(null);
  const activeMix =
    (activeMixId ? mixes.find((item) => item.id === activeMixId) : null) ?? mixes[0] ?? null;
  const { playing } = useIsPlaying();
  const { position, duration } = useProgress(1000);
  const activeTrack = useActiveTrack();
  const downloadedIds = useMemo(() => new Set(offlineSongs.map((song) => song.id)), [offlineSongs]);
  const favoriteIds = useMemo(() => new Set(favorites.map((song) => song.id)), [favorites]);
  const favoriteRadioIds = useMemo(
    () => new Set(favoriteRadios.map((radio) => radio.id)),
    [favoriteRadios],
  );
  const currentSongs = view === 'mix' ? (activeMix?.songs ?? []) : view === 'favorites' ? favorites : songs;
  const t = (key: string, params?: Record<string, string | number>) => translate(lang, key, params);
  const messageTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const welcomeAnim = useRef(new Animated.Value(0)).current;

  // Notification éphémère : s'efface automatiquement au bout de 3 s.
  function showTransient(text: string) {
    if (messageTimerRef.current) clearTimeout(messageTimerRef.current);
    setMessage(text);
    messageTimerRef.current = setTimeout(() => {
      setMessage((current) => (current === text ? '' : current));
      messageTimerRef.current = null;
    }, 3000);
  }
  const filteredSongs = useMemo(() => {
    const base = view === 'mix' ? (activeMix?.songs ?? []) : view === 'favorites' ? favorites : songs;
    const query = normalizeForSearch(searchQuery.trim());
    if (!query) return base;
    return base.filter(
      (song) =>
        normalizeForSearch(song.title).includes(query) ||
        normalizeForSearch(song.channel).includes(query),
    );
  }, [view, activeMix, favorites, songs, searchQuery]);

  useEffect(() => {
    let isMounted = true;

    async function restoreSession() {
      try {
        if (Platform.OS === 'web') return;

        const storedOffline = await getOfflineSongs();
        if (isMounted && storedOffline.length) setOfflineSongs(storedOffline);

        let snapshot: PublicPlaylistSnapshot | null = null;
        const storedPlaylistRaw = await SecureStore.getItemAsync(PUBLIC_PLAYLIST_STORAGE_KEY);
        if (storedPlaylistRaw && isMounted) {
          try {
            snapshot = JSON.parse(storedPlaylistRaw) as PublicPlaylistSnapshot;
            if (snapshot.input) setPublicPlaylistInput(snapshot.input);
            if (snapshot.selectedPlaylist) setSelectedPlaylist(snapshot.selectedPlaylist);
            if (Array.isArray(snapshot.songs) && snapshot.songs.length) setSongs(snapshot.songs);
            if (snapshot.selectedPlaylist) setLinkInputCollapsed(true);
          } catch {
            // snapshot corrompu : on repart de zero
          }
        }

        const storedFavoritesRaw = await SecureStore.getItemAsync(FAVORITES_STORAGE_KEY);
        if (storedFavoritesRaw && isMounted) {
          try {
            const favs = JSON.parse(storedFavoritesRaw);
            if (Array.isArray(favs)) setFavorites(favs as Song[]);
          } catch {
            // favoris corrompus : on repart de zero
          }
        }

        const storedLang = await SecureStore.getItemAsync(LANGUAGE_STORAGE_KEY);
        if (isMounted && (storedLang === 'fr' || storedLang === 'en')) setLang(storedLang);

        const storedMixRaw = await SecureStore.getItemAsync(MIX_STORAGE_KEY);
        if (storedMixRaw && isMounted) {
          try {
            const mix = JSON.parse(storedMixRaw);
            if (Array.isArray(mix)) setMixPlaylists(mix as Playlist[]);
          } catch {
            // mix corrompu : on repart de zero
          }
        }

        const storedHistoryRaw = await SecureStore.getItemAsync(PLAYLIST_HISTORY_STORAGE_KEY);
        if (storedHistoryRaw && isMounted) {
          try {
            const history = JSON.parse(storedHistoryRaw);
            if (Array.isArray(history)) setPlaylistHistory(history as PlaylistHistoryEntry[]);
          } catch {
            // historique corrompu : on repart de zero
          }
        }

        const storedMix = await loadStoredMix();
        if (isMounted && storedMix.length) {
          setMixes(storedMix);
          setActiveMixId(storedMix[0].id);
        }

        const storedWelcome = await SecureStore.getItemAsync(WELCOME_STORAGE_KEY);
        if (isMounted && storedWelcome) setWelcomeSeen(true);

        const storedFavoriteRadiosRaw = await SecureStore.getItemAsync(FAVORITE_RADIOS_STORAGE_KEY);
        if (storedFavoriteRadiosRaw && isMounted) {
          try {
            const radios = JSON.parse(storedFavoriteRadiosRaw);
            if (Array.isArray(radios)) setFavoriteRadios(radios as InnertubeLiveStream[]);
          } catch {
            // radios corrompues : on repart de zero
          }
        }

      } finally {
        if (isMounted) setSessionRestored(true);
      }
    }

    void restoreSession();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!sessionRestored) return;
    const snapshot: PublicPlaylistSnapshot = {
      input: publicPlaylistInput,
      selectedPlaylist,
      songs,
    };
    void persistPublicPlaylistSnapshot(snapshot);
  }, [sessionRestored, publicPlaylistInput, selectedPlaylist, songs]);

  useEffect(() => {
    if (!sessionRestored) return;
    void persistFavorites(favorites);
  }, [sessionRestored, favorites]);

  useEffect(() => {
    if (!sessionRestored) return;
    void persistLanguage(lang);
  }, [sessionRestored, lang]);

  useEffect(() => {
    if (!sessionRestored) return;
    void persistMix(mixPlaylists);
  }, [sessionRestored, mixPlaylists]);

  useEffect(() => {
    if (!sessionRestored) return;
    void persistPlaylistHistory(playlistHistory);
  }, [sessionRestored, playlistHistory]);

  useEffect(() => {
    if (!sessionRestored) return;
    void saveStoredMix(mixes);
  }, [sessionRestored, mixes]);

  useEffect(() => {
    if (!sessionRestored) return;
    void persistFavoriteRadios(favoriteRadios);
  }, [sessionRestored, favoriteRadios]);

  // Au premier lancement, on affiche l'écran de bienvenue une fois la session restaurée.
  useEffect(() => {
    if (sessionRestored && !welcomeSeen) setShowWelcome(true);
  }, [sessionRestored, welcomeSeen]);

  // Animation d'entrée de l'écran de bienvenue (fondu + glissement).
  useEffect(() => {
    if (!showWelcome) return;
    welcomeAnim.setValue(0);
    Animated.timing(welcomeAnim, {
      toValue: 1,
      duration: 650,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [showWelcome, welcomeAnim]);

  // Si l'onglet Favoris est masqué (vide), on revient sur Playlist.
  useEffect(() => {
    if (view === 'favorites' && favorites.length === 0) setView('playlist');
  }, [view, favorites.length]);

  useEffect(() => {
    if (sleepSecondsLeft == null) return;
    if (sleepSecondsLeft <= 0) {
      void (async () => {
        await stopAudio();
        setAudioMode(false);
        setAudioCount(0);
        showTransient(t('msg.minuterieStopped'));
        setSleepSecondsLeft(null);
      })();
      return;
    }
    const id = setTimeout(
      () => setSleepSecondsLeft((value) => (value == null ? null : value - 1)),
      1000,
    );
    return () => clearTimeout(id);
  }, [sleepSecondsLeft]);

  function rememberPlaylist(playlistId: string, input: string, title: string) {
    const link = input.trim() || `https://www.youtube.com/playlist?list=${playlistId}`;
    setPlaylistHistory((prev) => {
      const filtered = prev.filter((item) => item.id !== playlistId);
      return [{ id: playlistId, input: link, title }, ...filtered].slice(0, 10);
    });
  }

  async function loadPublicPlaylistSongs(playlistId: string, inputOverride?: string) {
    setOpenListId(null);
    setSelectedPlaylist(null);
    setSongs([]);
    setSearchQuery('');
    setView('playlist');
    setLoading('songs');
    setMessage(t('msg.loadingPlaylist'));

    try {
      const result = await fetchPublicPlaylist(playlistId, MAX_SONGS_PER_PLAYLIST);
      const importedSongs = shuffleArray(result.songs);

      setSelectedPlaylist({
        id: playlistId,
        title: result.title,
        channel: result.channel,
        thumbnail: importedSongs[0]?.thumbnail ?? '',
        itemCount: importedSongs.length,
      });
      setSongs(importedSongs);
      rememberPlaylist(playlistId, inputOverride ?? publicPlaylistInput, result.title);
      setLinkInputCollapsed(true);

      const unplayableCount = importedSongs.filter((song) => song.unplayable).length;
      let nextMessage = importedSongs.length
        ? t('msg.loadedSongs', { n: importedSongs.length, title: result.title })
        : t('msg.emptyPlaylist');
      if (unplayableCount > 0) {
        nextMessage += ` ${t('msg.privateIgnored', { n: unplayableCount })}`;
      }
      setMessage(nextMessage);
    } catch (error) {
      setOpenListId(playlistId);
      setMessage(getErrorMessage(error, t('msg.loadError')));
    } finally {
      setLoading(null);
    }
  }

  async function refreshPlaylist() {
    if (view === 'mix' && activeMix) {
      await reloadMix();
      return;
    }
    const playlist = selectedPlaylist;
    if (!playlist) return;
    await loadPublicPlaylistSongs(playlist.id);
  }

  async function reloadMix() {
    if (!activeMix) return;
    setLoading('songs');
    setMessage(t('mix.loading'));
    try {
      const seen = new Set<string>();
      const merged: Song[] = [];
      for (const id of activeMix.sourceIds) {
        try {
          const result = await fetchPublicPlaylist(id, MAX_SONGS_PER_PLAYLIST);
          for (const song of result.songs) {
            if (!seen.has(song.id)) {
              seen.add(song.id);
              merged.push(song);
            }
          }
        } catch {
          // playlist inaccessible : on passe à la suivante
        }
      }
      const finalSongs = shuffleArray(merged).slice(0, MAX_SONGS_PER_PLAYLIST);
      if (finalSongs.length === 0) {
        setMessage(t('msg.emptyPlaylist'));
        return;
      }
      const mixId = activeMix.id;
      setMixes((prev) =>
        prev.map((item) =>
          item.id === mixId
            ? { ...item, songs: finalSongs, thumbnail: finalSongs[0]?.thumbnail ?? item.thumbnail }
            : item,
        ),
      );
      setMessage(t('mix.loaded', { n: finalSongs.length, p: activeMix.sourceIds.length }));
    } catch (error) {
      setMessage(t('mix.fail', { error: String((error as Error)?.message ?? error) }));
    } finally {
      setLoading(null);
    }
  }

  async function searchForPlaylists(override?: string) {
    const query = (override ?? mixSearchQuery).trim();
    if (!query || mixSearchLoading) return;
    setMixSearchLoading(true);
    setMixSearchResults([]);
    try {
      const results = await searchPlaylists(query, 50);
      const mapped: Playlist[] = results.map((result) => ({
        id: result.id,
        title: result.title,
        channel: result.channel,
        thumbnail: result.thumbnail,
        itemCount: result.itemCount,
      }));
      setMixSearchResults(mapped);
      if (mapped.length === 0) setMessage(t('mix.noResults', { query }));
    } catch (error) {
      setMessage(t('mix.searchFail', { error: String((error as Error)?.message ?? error) }));
    } finally {
      setMixSearchLoading(false);
    }
  }

  function addToMix(playlist: Playlist) {
    setMixPlaylists((prev) =>
      prev.some((item) => item.id === playlist.id) ? prev : [...prev, playlist],
    );
    showTransient(t('mix.addedToast', { title: playlist.title }));
  }

  function removeFromMix(playlistId: string) {
    setMixPlaylists((prev) => prev.filter((item) => item.id !== playlistId));
    showTransient(t('mix.removed'));
  }

  function resolveMixTitle(): string {
    if (mixStyle) {
      const genre = GENRES.find((item) => item.key === mixStyle);
      if (genre) return t(`genre.${genre.key}`);
    }
    const cleaned = mixSearchQuery.trim().replace(/\s*playlist(s)?\s*$/i, '').trim();
    if (cleaned) return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    return t('mix.default');
  }

  function closeMix(mixId: string) {
    const remaining = mixes.filter((item) => item.id !== mixId);
    const wasActive = (activeMixId ?? mixes[0]?.id) === mixId;
    setMixes(remaining);
    if (wasActive) {
      if (remaining.length) {
        setActiveMixId(remaining[0].id);
        setView('mix');
      } else {
        setActiveMixId(null);
        setView('playlist');
      }
    }
  }

  async function loadMix() {
    if (mixPlaylists.length === 0) return;
    if (mixes.length >= MAX_MIXES) {
      setMessage(t('mix.max'));
      return;
    }
    setLoading('songs');
    setMessage(t('mix.loading'));
    try {
      const seen = new Set<string>();
      const merged: Song[] = [];
      for (const playlist of mixPlaylists) {
        try {
          const result = await fetchPublicPlaylist(playlist.id, MAX_SONGS_PER_PLAYLIST);
          for (const song of result.songs) {
            if (!seen.has(song.id)) {
              seen.add(song.id);
              merged.push(song);
            }
          }
        } catch {
          // playlist inaccessible ou privée : on passe à la suivante
        }
      }
      const finalSongs = shuffleArray(merged).slice(0, MAX_SONGS_PER_PLAYLIST);
      if (finalSongs.length === 0) {
        setMessage(t('msg.emptyPlaylist'));
        return;
      }
      const mixTitle = resolveMixTitle();
      const mixId = `${mixPlaylists.map((playlist) => playlist.id).join('|')}_${Date.now().toString(36)}`;
      const mixThumbnail = finalSongs[0]?.thumbnail ?? mixPlaylists[0]?.thumbnail ?? '';
      const sourceCount = mixPlaylists.length;
      const newMix: Mix = {
        id: mixId,
        title: mixTitle,
        channel: mixPlaylists.map((playlist) => playlist.channel).join(', '),
        thumbnail: mixThumbnail,
        songs: finalSongs,
        sourceIds: mixPlaylists.map((playlist) => playlist.id),
      };
      setMixes((prev) => [...prev, newMix]);
      setActiveMixId(mixId);
      setView('mix');
      setMixPanelOpen(false);
      setSearchQuery('');
      // La box « Recherche & fusion » revient à son état d'origine.
      setMixPlaylists([]);
      setMixSearchQuery('');
      setMixSearchResults([]);
      setMixStyle(null);
      setMessage(t('mix.loaded', { n: finalSongs.length, p: sourceCount }));
    } catch (error) {
      setMessage(t('mix.fail', { error: String((error as Error)?.message ?? error) }));
    } finally {
      setLoading(null);
    }
  }

  async function searchRadio(genreKey: string) {
    if (radioLoading) return;
    setRadioLoading(true);
    setRadioResults([]);
    try {
      const query = `${genreKey} radio live`;
      const results = await searchLiveStreams(query, 30);
      setRadioResults(results);
      if (results.length === 0) setMessage(t('radio.noResults'));
    } catch (error) {
      setMessage(t('radio.searchFail', { error: String((error as Error)?.message ?? error) }));
    } finally {
      setRadioLoading(false);
    }
  }

  function toggleFavoriteRadio(stream: InnertubeLiveStream) {
    const isFavorite = favoriteRadioIds.has(stream.id);
    if (isFavorite) {
      setFavoriteRadios((prev) => prev.filter((item) => item.id !== stream.id));
      showTransient(t('radio.favRemoved'));
    } else {
      setFavoriteRadios((prev) => [stream, ...prev]);
      showTransient(t('radio.favAdded', { title: stream.title }));
    }
  }

  async function playLiveStream(stream: InnertubeLiveStream) {
    if (Platform.OS === 'web') {
      setMessage(t('radio.webOnly'));
      return;
    }
    setAudioLoading(true);
    setMessage(t('radio.loadingStream'));
    try {
      const url = await resolveLiveStreamUrl(stream.id);
      if (!url) {
        setMessage(t('radio.fail'));
        return;
      }
      await resetAudioPlayer();
      await addAudioTrack(
        {
          id: stream.id,
          url,
          title: stream.title,
          artist: stream.channel,
          artwork: stream.thumbnail,
          type: TrackType.HLS,
          contentType: 'application/vnd.apple.mpegurl',
        },
        true,
      );
      setAudioMode(true);
      setAudioCount(1);
      setMessage(t('radio.playing', { title: stream.title }));
    } catch (error) {
      setMessage(t('radio.fail', { error: String((error as Error)?.message ?? error) }));
    } finally {
      setAudioLoading(false);
    }
  }

  function importPublicPlaylist() {
    const playlistId = extractPlaylistId(publicPlaylistInput);

    if (!playlistId) {
      setMessage(t('msg.invalidLink'));
      return;
    }

    setOpenListId(null);
    setSelectedPlaylist(null);
    setSongs([]);

    void loadPublicPlaylistSongs(playlistId);
  }

  async function startAudioMode(index: number, shuffle = false) {
    if (Platform.OS === 'web') {
      setMessage(t('msg.audioWebOnly'));
      return;
    }
    // `shuffle` (bouton « Mode audio ») repioche un echantillon aleatoire a
    // chaque lancement. En tapant un titre precis, on garde l'ordre de la
    // liste a partir de ce titre.
    const source = shuffle ? shuffleArray(currentSongs) : currentSongs;
    const playable = source.slice(index).filter((item) => !item.unplayable).slice(0, AUDIO_BATCH_SIZE);
    if (playable.length === 0) {
      setMessage(t('msg.noPlayable'));
      return;
    }
    setAudioLoading(true);
    setMessage(t('msg.preparingAudio'));
    try {
      await resetAudioPlayer();
      let started = false;
      let count = 0;
      for (let i = 0; i < playable.length; i++) {
        const song = playable[i];
        // Petit espacement pour ne pas déclencher la limite de débit YouTube.
        if (i > 0) await new Promise((r) => setTimeout(r, 250));
        const resolved = await resolveAudioStream(song.id);
        if (!resolved) continue;

        await addAudioTrack(
          { id: song.id, url: resolved.url, title: song.title, artist: song.channel, artwork: song.thumbnail },
          !started,
        );
        if (!started) {
          started = true;
          setAudioLoading(false);
          setAudioMode(true);
        }
        count++;
        setAudioCount(count);
        setMessage(
          `${t('msg.audioQueue', { n: count })}${i < playable.length - 1 ? t('msg.loadingMore') : '.'}`,
        );
      }
      if (!started) {
        setMessage(t('msg.noStream'));
      }
    } catch (error) {
      setMessage(t('msg.audioFail', { error: String((error as Error)?.message ?? error) }));
    } finally {
      setAudioLoading(false);
    }
  }

  async function startRadioMode(song: Song) {
    if (Platform.OS === 'web') {
      setMessage(t('msg.radioWebOnly'));
      return;
    }
    if (song.unplayable) return;
    setAudioLoading(true);
    setMessage(t('msg.preparingRadio'));
    try {
      const related = await fetchRelatedTracks(song.id, AUDIO_BATCH_SIZE);
      const pool = [song, ...related.filter((item) => item.id !== song.id)];
      if (pool.length === 0) {
        setMessage(t('msg.noRelated'));
        return;
      }
      await resetAudioPlayer();
      let started = false;
      let count = 0;
      for (let i = 0; i < pool.length; i++) {
        const item = pool[i];
        // Petit espacement pour ne pas déclencher la limite de débit YouTube.
        if (i > 0) await new Promise((r) => setTimeout(r, 250));
        const resolved = await resolveAudioStream(item.id);
        if (!resolved) continue;
        await addAudioTrack(
          { id: item.id, url: resolved.url, title: item.title, artist: item.channel, artwork: item.thumbnail },
          !started,
        );
        if (!started) {
          started = true;
          setAudioLoading(false);
          setAudioMode(true);
        }
        count++;
        setAudioCount(count);
        setMessage(
          `${t('msg.radioQueue', { n: count })}${i < pool.length - 1 ? t('msg.loadingMore') : '.'}`,
        );
      }
      if (!started) {
        setMessage(t('msg.radioNoStream'));
      }
    } catch (error) {
      setMessage(t('msg.radioFail', { error: String((error as Error)?.message ?? error) }));
    } finally {
      setAudioLoading(false);
    }
  }

  async function stopAudioMode() {
    await stopAudio();
    setAudioMode(false);
    setAudioCount(0);
    setSleepSecondsLeft(null);
  }

  async function downloadForOffline() {
    if (Platform.OS === 'web') {
      setMessage(t('msg.offlineWebOnly'));
      return;
    }
    const playable = currentSongs.filter((item) => !item.unplayable);
    if (playable.length === 0) {
      setMessage(t('msg.noDownloadable'));
      return;
    }
    setDownloadState('downloading');
    setMessage(t('msg.downloading'));
    let done = 0;
    let failed = 0;
    try {
      for (const song of playable) {
        setDownloadProgress({ done, total: playable.length });
        const offline = await downloadSong(song);
        if (offline) {
          done += 1;
          setOfflineSongs((prev) => [...prev.filter((item) => item.id !== offline.id), offline]);
        } else {
          failed += 1;
        }
        setDownloadProgress({ done, total: playable.length });
        setMessage(
          t('msg.downloadProgress', {
            done,
            total: playable.length,
            failed: failed ? t('msg.downloadFailedSuffix', { failed }) : '',
          }),
        );
        // petit espacement pour ne pas déclencher la limite de débit YouTube
        await new Promise((r) => setTimeout(r, 250));
      }
      setMessage(done > 0 ? t('msg.offlineReady', { n: done }) : t('msg.offlineNone'));
    } catch (error) {
      setMessage(t('msg.downloadFail', { error: String((error as Error)?.message ?? error) }));
    } finally {
      setDownloadState('idle');
      setDownloadProgress(null);
    }
  }

  async function startOfflineMode() {
    if (Platform.OS === 'web') {
      setMessage(t('msg.offlinePlayWebOnly'));
      return;
    }
    if (offlineSongs.length === 0) {
      setMessage(t('msg.offlineEmpty'));
      return;
    }
    setAudioLoading(true);
    setMessage(t('msg.offlinePlaying'));
    try {
      await resetAudioPlayer();
      let started = false;
      let count = 0;
      for (const song of offlineSongs) {
        await addAudioTrack(
          { id: song.id, url: song.fileUri, title: song.title, artist: song.channel, artwork: song.thumbnail },
          !started,
        );
        if (!started) {
          started = true;
          setAudioLoading(false);
          setAudioMode(true);
        }
        count += 1;
        setAudioCount(count);
      }
      setMessage(started ? t('msg.offlinePlayed', { n: count }) : t('msg.offlineUnplayable'));
    } catch (error) {
      setMessage(t('msg.offlinePlayFail', { error: String((error as Error)?.message ?? error) }));
    } finally {
      setAudioLoading(false);
    }
  }

  async function clearOfflineCache() {
    await clearOfflineSongs();
    setOfflineSongs([]);
    showTransient(t('msg.cacheCleared'));
  }

  async function downloadSingleSong(song: Song) {
    if (Platform.OS === 'web') {
      setMessage(t('msg.offlineWebOnly'));
      return;
    }
    if (song.unplayable || downloadedIds.has(song.id) || downloadingIds.has(song.id)) return;
    setDownloadingIds((prev) => new Set(prev).add(song.id));
    showTransient(t('msg.downloadSingle', { title: song.title }));
    try {
      const offline = await downloadSong(song);
      if (offline) {
        setOfflineSongs((prev) => [...prev.filter((item) => item.id !== offline.id), offline]);
        showTransient(t('msg.downloadSingleDone', { title: song.title }));
      } else {
        showTransient(t('msg.downloadSingleFail', { title: song.title }));
      }
    } catch (error) {
      setMessage(t('msg.downloadFail', { error: String((error as Error)?.message ?? error) }));
    } finally {
      setDownloadingIds((prev) => {
        const next = new Set(prev);
        next.delete(song.id);
        return next;
      });
    }
  }

  function toggleFavorite(song: Song) {
    const isFavorite = favoriteIds.has(song.id);
    if (isFavorite) {
      setFavorites((prev) => prev.filter((item) => item.id !== song.id));
      showTransient(t('msg.favRemoved', { title: song.title }));
    } else {
      setFavorites((prev) => [...prev, song]);
      showTransient(t('msg.favAdded', { title: song.title }));
    }
  }

  const renderSong = ({ item, index }: { item: Song; index: number }) => (
    <Pressable
      onPress={() => {
        if (item.unplayable) {
          Linking.openURL(`https://www.youtube.com/watch?v=${item.id}`);
        } else {
          const realIndex = currentSongs.findIndex((song) => song.id === item.id);
          void startAudioMode(realIndex >= 0 ? realIndex : index);
        }
      }}
      style={({ pressed }) => [styles.songRow, pressed && styles.pressed]}
    >
      <Text style={styles.songIndex}>{String(index + 1).padStart(2, '0')}</Text>
      {item.unplayable ? (
        <View style={styles.thumbnailFallback}>
          <Ionicons name="lock-closed" size={18} color={colors.muted} />
        </View>
      ) : (
        <Image source={{ uri: item.thumbnail }} style={styles.thumbnail} />
      )}
      <View style={styles.songCopy}>
        <Text numberOfLines={1} style={styles.songTitle}>
          {item.title}
        </Text>
        <Text numberOfLines={1} style={styles.songChannel}>
          {item.unplayable ? t('label.openToPlay') : item.channel}
        </Text>
      </View>
      <View style={styles.songActions}>
        <Pressable
          onPress={() => toggleFavorite(item)}
          hitSlop={8}
          style={({ pressed }) => [styles.downloadIconButton, pressed && styles.pressed]}
        >
          <Ionicons
            name={favoriteIds.has(item.id) ? 'heart' : 'heart-outline'}
            size={21}
            color={favoriteIds.has(item.id) ? colors.accent : colors.muted}
          />
        </Pressable>
        {!item.unplayable && (
          <Pressable
            onPress={() => void downloadSingleSong(item)}
            disabled={downloadedIds.has(item.id) || downloadingIds.has(item.id)}
            hitSlop={8}
            style={({ pressed }) => [styles.downloadIconButton, pressed && styles.pressed]}
          >
            {downloadingIds.has(item.id) ? (
              <ActivityIndicator size="small" color={colors.accent} />
            ) : (
              <Ionicons
                name={downloadedIds.has(item.id) ? 'checkmark-circle' : 'download-outline'}
                size={22}
                color={downloadedIds.has(item.id) ? colors.success : colors.muted}
              />
            )}
          </Pressable>
        )}
        {!item.unplayable && (
          <Pressable
            onPress={() => void startRadioMode(item)}
            hitSlop={8}
            style={({ pressed }) => [styles.downloadIconButton, pressed && styles.pressed]}
          >
            <Ionicons name="radio-outline" size={22} color={colors.accent} />
          </Pressable>
        )}
        <Ionicons
          name={item.unplayable ? 'open-outline' : 'headset-outline'}
          size={25}
          color={item.unplayable ? colors.muted : colors.accent}
        />
      </View>
    </Pressable>
  );

  const listHeader = (
    <>
      <View style={styles.header}>
        <Pressable
          onPress={() => setShowWelcome(true)}
          hitSlop={8}
          style={({ pressed }) => [styles.infoButton, pressed && styles.pressed]}
        >
          <Ionicons name="information-circle-outline" size={15} color={colors.muted} />
        </Pressable>
        <View style={styles.logo}>
          <Image source={require('./assets/icon.png')} style={styles.logoImage} />
        </View>
        <Text style={styles.title}>MusicME</Text>
        <Pressable
          onPress={() => setLang((value) => (value === 'fr' ? 'en' : 'fr'))}
          hitSlop={8}
          style={({ pressed }) => [styles.langButton, pressed && styles.pressed]}
        >
          <Ionicons name="globe-outline" size={15} color={colors.muted} />
          <Text style={styles.langButtonText}>{lang === 'fr' ? 'FR' : 'EN'}</Text>
        </Pressable>
      </View>

      {audioMode && (
        <View style={styles.playerCard}>
          <View style={styles.nowPlaying}>
            <View style={styles.nowPlayingCopy}>
              <Text numberOfLines={1} style={styles.nowPlayingTitle}>
                {activeTrack?.title ?? t('msg.audioActive')}
              </Text>
              <Text numberOfLines={1} style={styles.nowPlayingChannel}>
                {activeTrack?.artist ?? t('label.tracksInQueue', { n: audioCount })}
              </Text>
            </View>
            <Pressable onPress={stopAudioMode} style={styles.iconButton}>
              <Ionicons name="stop" size={18} color={colors.muted} />
            </Pressable>
          </View>

          <View style={styles.controlsRow}>
            <Pressable onPress={() => void skipToPreviousTrack()} style={styles.controlButton}>
              <Ionicons name="play-skip-back" size={22} color={colors.ink} />
            </Pressable>
            <Pressable onPress={() => void togglePlayback()} style={styles.controlButtonPrimary}>
              <Ionicons name={playing ? 'pause' : 'play'} size={26} color={colors.ink} />
            </Pressable>
            <Pressable onPress={() => void skipToNextTrack()} style={styles.controlButton}>
              <Ionicons name="play-skip-forward" size={22} color={colors.ink} />
            </Pressable>
          </View>

          <View style={styles.seekRow}>
            <Text style={styles.seekTime}>{formatTime(position)}</Text>
            <SeekBar position={position} duration={duration} onSeek={(p) => void seekToPosition(p)} />
            <Text style={styles.seekTime}>{formatTime(duration)}</Text>
          </View>

          <View style={styles.sleepRow}>
            {sleepSecondsLeft == null ? (
              <>
                <Pressable onPress={() => setSleepSecondsLeft(15 * 60)} style={styles.sleepChip}>
                  <Text style={styles.sleepChipText}>{t('label.min15')}</Text>
                </Pressable>
                <Pressable onPress={() => setSleepSecondsLeft(30 * 60)} style={styles.sleepChip}>
                  <Text style={styles.sleepChipText}>{t('label.min30')}</Text>
                </Pressable>
                <Pressable onPress={() => setSleepSecondsLeft(60 * 60)} style={styles.sleepChip}>
                  <Text style={styles.sleepChipText}>{t('label.min60')}</Text>
                </Pressable>
              </>
            ) : (
              <Pressable onPress={() => setSleepSecondsLeft(null)} style={styles.sleepChipActive}>
                <Ionicons name="moon" size={13} color={colors.ink} />
                <Text style={styles.sleepChipText}>{t('label.sleepIn', { time: formatTime(sleepSecondsLeft) })}</Text>
              </Pressable>
            )}
          </View>
        </View>
      )}

      <View style={styles.publicPanel}>
        <Text style={styles.publicTitle}>{t('label.yourPlaylist')}</Text>
        {linkInputCollapsed && selectedPlaylist ? (
          <Pressable
            onPress={() => setLinkInputCollapsed(false)}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <View style={styles.successCapsule}>
              <Ionicons name="checkmark-circle" size={15} color={colors.success} />
              <Text style={styles.successCapsuleText}>{t('label.loadedOk')}</Text>
              <Ionicons name="pencil-outline" size={13} color={colors.success} />
            </View>
          </Pressable>
        ) : (
          <>
            <Text style={styles.publicSubtitle}>{t('msg.welcome')}</Text>
            <View style={styles.publicInputRow}>
              <Ionicons name="link-outline" size={20} color={colors.muted} />
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                onChangeText={setPublicPlaylistInput}
                onSubmitEditing={importPublicPlaylist}
                placeholder={t('label.inputPlaceholder')}
                placeholderTextColor={colors.muted}
                style={styles.publicInput}
                value={publicPlaylistInput}
              />
              <Pressable onPress={importPublicPlaylist} style={({ pressed }) => [styles.publicPlayButton, pressed && styles.pressed]}>
                <Ionicons name="play" size={18} color={colors.ink} />
              </Pressable>
            </View>
            <View style={styles.publicOnlyRow}>
              <Ionicons name="lock-open-outline" size={12} color={colors.muted} />
              <Text style={styles.publicOnlyText}>{t('label.publicOnly')}</Text>
            </View>
            {playlistHistory.length > 0 && (
              <View style={styles.historyBlock}>
                <View style={styles.historyHeader}>
                  <Text style={styles.historyTitle}>{t('label.recent')}</Text>
                  <Pressable onPress={() => setPlaylistHistory([])} hitSlop={8}>
                    <Text style={styles.historyClear}>{t('label.clearHistory')}</Text>
                  </Pressable>
                </View>
                <View style={styles.historyChips}>
                  {playlistHistory.map((entry) => (
                    <Pressable
                      key={entry.id}
                      onPress={() => {
                        setPublicPlaylistInput(entry.input);
                        void loadPublicPlaylistSongs(entry.id, entry.input);
                      }}
                      style={({ pressed }) => [styles.historyChip, pressed && styles.pressed]}
                    >
                      <Ionicons name="time-outline" size={12} color={colors.muted} />
                      <Text numberOfLines={1} style={styles.historyChipText}>
                        {entry.title}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}
          </>
        )}
        {openListId && (
          <Pressable
            onPress={() => Linking.openURL(`https://www.youtube.com/playlist?list=${openListId}`)}
            style={({ pressed }) => [styles.openInYoutubeRow, pressed && styles.pressed]}
          >
            <Ionicons name="logo-youtube" size={18} color={colors.accent} />
            <Text style={styles.openInYoutubeText}>{t('label.openInYouTube')}</Text>
            <Ionicons name="open-outline" size={16} color={colors.muted} />
          </Pressable>
        )}
      </View>

      {message.length > 0 && <Text style={styles.helperText}>{message}</Text>}

      {loading === 'songs' && (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={colors.accent} size="small" />
          <Text style={styles.loadingText}>{t('label.loadingSongs')}</Text>
        </View>
      )}

      {mixPanelOpen ? (
        <View style={styles.mixPanel}>
          <Pressable
            onPress={() => setMixPanelOpen(false)}
            hitSlop={8}
            style={styles.mixCloseChevron}
          >
            <Ionicons name="chevron-up" size={18} color={colors.muted} />
          </Pressable>
          <Text style={styles.mixTitle}>{t('mix.title')}</Text>
          <View style={[styles.mixSearchRow, mixSearchFocused && styles.mixSearchRowFocused]}>
          <Ionicons
            name="search-outline"
            size={18}
            color={mixSearchFocused ? colors.accent : colors.muted}
          />
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            onBlur={() => setMixSearchFocused(false)}
            onChangeText={(text) => {
              setMixSearchQuery(text);
              setMixStyle(null);
            }}
            onFocus={() => setMixSearchFocused(true)}
            onSubmitEditing={() => void searchForPlaylists()}
            placeholder={t('mix.searchPlaceholder')}
            placeholderTextColor={colors.muted}
            style={styles.mixSearchInput}
            value={mixSearchQuery}
          />
          <Pressable
            onPress={() => void searchForPlaylists()}
            disabled={mixSearchLoading}
            hitSlop={8}
            style={({ pressed }) => pressed && styles.pressed}
          >
            {mixSearchLoading ? (
              <ActivityIndicator size="small" color={colors.accent} />
            ) : (
              <Ionicons name="arrow-forward-circle-outline" size={22} color={colors.accent} />
            )}
          </Pressable>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.genresRow}
          contentContainerStyle={styles.genresRowContent}
          keyboardShouldPersistTaps="handled"
        >
          {GENRES.map((genre) => (
            <Pressable
              key={genre.key}
              onPress={() => {
                setMixSearchQuery(genre.query);
                setMixStyle(genre.key);
                void searchForPlaylists(genre.query);
              }}
              style={({ pressed }) => [styles.genreChip, pressed && styles.pressed]}
            >
              <Text style={styles.genreChipText}>{t(`genre.${genre.key}`)}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {mixSearchResults.length > 0 && (
          <View>
            <Text style={styles.mixResultsLabel}>
              {t('mix.results')} ({mixSearchResults.length})
            </Text>
            {mixSearchResults.map((playlist) => {
              const added = mixPlaylists.some((item) => item.id === playlist.id);
              return (
                <View key={playlist.id} style={styles.mixResultRow}>
                  {playlist.thumbnail ? (
                    <Image source={{ uri: playlist.thumbnail }} style={styles.mixResultThumb} />
                  ) : (
                    <View style={styles.mixResultThumb} />
                  )}
                  <View style={styles.mixResultCopy}>
                    <Text numberOfLines={1} style={styles.mixResultTitle}>
                      {playlist.title}
                    </Text>
                    <Text numberOfLines={1} style={styles.mixResultMeta}>
                      {playlist.channel}
                      {playlist.itemCount ? ` · ${t('mix.videos', { n: playlist.itemCount })}` : ''}
                    </Text>
                  </View>
                  <Pressable onPress={() => addToMix(playlist)} disabled={added} hitSlop={8}>
                    <Ionicons
                      name={added ? 'checkmark-circle' : 'add-circle-outline'}
                      size={24}
                      color={added ? colors.success : colors.accent}
                    />
                  </Pressable>
                </View>
              );
            })}
          </View>
        )}

        {mixPlaylists.length > 0 && (
          <>
            <Text style={styles.mixSelectedTitle}>{t('mix.added', { n: mixPlaylists.length })}</Text>
            {mixPlaylists.map((playlist) => (
              <View key={playlist.id} style={styles.mixSelectedRow}>
                <Text numberOfLines={1} style={styles.mixSelectedName}>
                  {playlist.title}
                </Text>
                <Pressable onPress={() => removeFromMix(playlist.id)} hitSlop={8}>
                  <Ionicons name="close-circle" size={18} color={colors.muted} />
                </Pressable>
              </View>
            ))}
            <Pressable
              onPress={() => void loadMix()}
              disabled={mixLoading || loading === 'songs'}
              style={({ pressed }) => [styles.mixLoadButton, pressed && styles.pressed]}
            >
              <Ionicons
                name={mixLoading || loading === 'songs' ? 'hourglass-outline' : 'git-merge-outline'}
                size={16}
                color={colors.ink}
              />
              <Text style={styles.playAllText}>
                {mixLoading || loading === 'songs' ? t('mix.loading') : t('mix.load', { n: mixPlaylists.length })}
              </Text>
            </Pressable>
          </>
        )}
        </View>
      ) : (
        <Pressable
          onPress={() => setMixPanelOpen(true)}
          style={({ pressed }) => [styles.mixCollapsedBar, pressed && styles.pressed]}
        >
          <Ionicons name="git-merge-outline" size={16} color={colors.accent} />
          <Text style={styles.mixCollapsedText}>{t('mix.title')}</Text>
          <Ionicons name="chevron-down" size={16} color={colors.muted} />
        </Pressable>
      )}

      {radioPanelOpen ? (
        <View style={styles.mixPanel}>
          <Pressable
            onPress={() => setRadioPanelOpen(false)}
            hitSlop={8}
            style={styles.mixCloseChevron}
          >
            <Ionicons name="chevron-up" size={18} color={colors.muted} />
          </Pressable>
          <Text style={styles.mixTitle}>{t('radio.title')}</Text>

          {favoriteRadios.length > 0 && (
            <View>
              <Text style={styles.mixResultsLabel}>
                {t('radio.favorites')} ({favoriteRadios.length})
              </Text>
              {favoriteRadios.map((stream) => (
                <View key={stream.id} style={styles.mixResultRow}>
                  {stream.thumbnail ? (
                    <Image source={{ uri: stream.thumbnail }} style={styles.mixResultThumb} />
                  ) : (
                    <View style={styles.mixResultThumb} />
                  )}
                  <View style={styles.mixResultCopy}>
                    <Text numberOfLines={1} style={styles.mixResultTitle}>
                      {stream.title}
                    </Text>
                    <Text numberOfLines={1} style={styles.mixResultMeta}>
                      {stream.channel}
                    </Text>
                  </View>
                  <Pressable onPress={() => toggleFavoriteRadio(stream)} hitSlop={8}>
                    <Ionicons name="heart" size={21} color={colors.accent} />
                  </Pressable>
                  <Pressable onPress={() => void playLiveStream(stream)} disabled={audioLoading} hitSlop={8}>
                    <Ionicons
                      name={audioLoading ? 'hourglass-outline' : 'play-circle'}
                      size={26}
                      color={colors.accent}
                    />
                  </Pressable>
                </View>
              ))}
            </View>
          )}

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.genresRow}
            contentContainerStyle={styles.genresRowContent}
            keyboardShouldPersistTaps="handled"
          >
            {GENRES.map((genre) => (
              <Pressable
                key={genre.key}
                onPress={() => void searchRadio(genre.key)}
                style={({ pressed }) => [styles.genreChip, pressed && styles.pressed]}
              >
                <Text style={styles.genreChipText}>{t(`genre.${genre.key}`)}</Text>
              </Pressable>
            ))}
          </ScrollView>

          {radioLoading && (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={colors.accent} size="small" />
              <Text style={styles.loadingText}>{t('radio.loading')}</Text>
            </View>
          )}

          {!radioLoading && radioResults.length > 0 && (
            <View>
              <Text style={styles.mixResultsLabel}>
                {t('radio.results')} ({radioResults.length})
              </Text>
              {radioResults.map((stream) => (
                <View key={stream.id} style={styles.mixResultRow}>
                  {stream.thumbnail ? (
                    <Image source={{ uri: stream.thumbnail }} style={styles.mixResultThumb} />
                  ) : (
                    <View style={styles.mixResultThumb} />
                  )}
                  <View style={styles.mixResultCopy}>
                    <Text numberOfLines={1} style={styles.mixResultTitle}>
                      {stream.title}
                    </Text>
                    <View style={styles.radioMetaRow}>
                      <View style={styles.liveBadge}>
                        <Text style={styles.liveBadgeText}>{t('radio.live')}</Text>
                      </View>
                      <Text numberOfLines={1} style={styles.mixResultMeta}>
                        {stream.channel}
                      </Text>
                    </View>
                  </View>
                  <Pressable onPress={() => toggleFavoriteRadio(stream)} hitSlop={8}>
                    <Ionicons
                      name={favoriteRadioIds.has(stream.id) ? 'heart' : 'heart-outline'}
                      size={21}
                      color={favoriteRadioIds.has(stream.id) ? colors.accent : colors.muted}
                    />
                  </Pressable>
                  <Pressable
                    onPress={() => void playLiveStream(stream)}
                    disabled={audioLoading}
                    hitSlop={8}
                  >
                    <Ionicons
                      name={audioLoading ? 'hourglass-outline' : 'play-circle'}
                      size={26}
                      color={colors.accent}
                    />
                  </Pressable>
                </View>
              ))}
            </View>
          )}
        </View>
      ) : (
        <Pressable
          onPress={() => setRadioPanelOpen(true)}
          style={({ pressed }) => [styles.mixCollapsedBar, pressed && styles.pressed]}
        >
          <Ionicons name="radio-outline" size={16} color={colors.accent} />
          <Text style={styles.mixCollapsedText}>{t('radio.title')}</Text>
          <Ionicons name="chevron-down" size={16} color={colors.muted} />
        </Pressable>
      )}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.collectionsRow}
        contentContainerStyle={styles.collectionsRowContent}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable
          onPress={() => {
            setView('playlist');
            setSearchQuery('');
          }}
          style={({ pressed }) => [
            styles.collectionChip,
            view === 'playlist' && styles.collectionChipActive,
            pressed && styles.pressed,
          ]}
        >
          <Text
            numberOfLines={1}
            style={[
              styles.collectionChipText,
              view === 'playlist' && styles.collectionChipTextActive,
            ]}
          >
            {t('label.playlist')}
          </Text>
        </Pressable>
        {mixes.map((item) => {
          const isActive = view === 'mix' && activeMix?.id === item.id;
          return (
            <View
              key={item.id}
              style={[
                styles.collectionChip,
                isActive && styles.collectionChipActive,
              ]}
            >
              <Pressable
                onPress={() => {
                  setActiveMixId(item.id);
                  setView('mix');
                  setSearchQuery('');
                }}
                hitSlop={6}
              >
                <Text
                  numberOfLines={1}
                  style={[
                    styles.collectionChipText,
                    styles.collectionChipLabel,
                    isActive && styles.collectionChipTextActive,
                  ]}
                >
                  {item.title}
                </Text>
              </Pressable>
              <Pressable onPress={() => closeMix(item.id)} hitSlop={8}>
                <Ionicons
                  name="close-circle"
                  size={16}
                  color={isActive ? colors.ink : colors.muted}
                />
              </Pressable>
            </View>
          );
        })}
        {favorites.length > 0 && (
          <Pressable
            onPress={() => {
              setView('favorites');
              setSearchQuery('');
            }}
            style={({ pressed }) => [
              styles.collectionChip,
              view === 'favorites' && styles.collectionChipActive,
              pressed && styles.pressed,
            ]}
          >
            <Text
              style={[
                styles.collectionChipText,
                view === 'favorites' && styles.collectionChipTextActive,
              ]}
            >
              {t('label.favorites', { n: favorites.length })}
            </Text>
          </Pressable>
        )}
      </ScrollView>

      {view === 'playlist' && selectedPlaylist && (
        <View style={styles.sectionHeading}>
          <Text numberOfLines={1} style={styles.sectionTitle}>
            {selectedPlaylist.title}
          </Text>
          <View style={styles.sectionActions}>
            <Pressable
              onPress={refreshPlaylist}
              disabled={loading === 'songs'}
              hitSlop={8}
              style={({ pressed }) => pressed && styles.pressed}
            >
              <Ionicons
                name={loading === 'songs' ? 'hourglass-outline' : 'refresh'}
                size={19}
                color={colors.accent}
              />
            </Pressable>
            <Pressable onPress={() => Linking.openURL(`https://www.youtube.com/playlist?list=${selectedPlaylist.id}`)}>
              <Ionicons name="open-outline" size={19} color={colors.accent} />
            </Pressable>
          </View>
        </View>
      )}

      {view === 'mix' && activeMix && (
        <View style={styles.sectionHeading}>
          <Text numberOfLines={1} style={styles.sectionTitle}>
            {activeMix.title}
          </Text>
          <View style={styles.sectionActions}>
            <Pressable
              onPress={refreshPlaylist}
              disabled={loading === 'songs'}
              hitSlop={8}
              style={({ pressed }) => pressed && styles.pressed}
            >
              <Ionicons
                name={loading === 'songs' ? 'hourglass-outline' : 'refresh'}
                size={19}
                color={colors.accent}
              />
            </Pressable>
          </View>
        </View>
      )}

      {view === 'favorites' && favorites.length === 0 && (
        <Text style={styles.helperText}>{t('msg.noFavorites')}</Text>
      )}

      {Platform.OS !== 'web' && currentSongs.some((song) => !song.unplayable) && (
        <View style={styles.playAllRow}>
          <Pressable
            onPress={() => startAudioMode(0, shuffleEnabled)}
            disabled={audioLoading}
            style={({ pressed }) => [styles.playAllButton, styles.playAllButtonFlex, pressed && styles.pressed]}
          >
            <Ionicons name={audioLoading ? 'hourglass-outline' : 'headset-outline'} size={16} color={colors.ink} />
            <Text style={styles.playAllText}>{audioLoading ? t('label.resolving') : t('label.audioMode')}</Text>
          </Pressable>
          <Pressable
            onPress={() => setShuffleEnabled((value) => !value)}
            style={({ pressed }) => [
              styles.shuffleButton,
              shuffleEnabled && styles.shuffleButtonActive,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons name="shuffle" size={18} color={shuffleEnabled ? colors.ink : colors.muted} />
          </Pressable>
        </View>
      )}

      {Platform.OS !== 'web' && currentSongs.some((song) => !song.unplayable) && (
        <View style={styles.playAllRow}>
          <Pressable
            onPress={startOfflineMode}
            disabled={audioLoading || downloadState === 'downloading'}
            style={({ pressed }) => [styles.playAllButton, styles.audioButton, pressed && styles.pressed]}
          >
            <Ionicons name="cloud-offline-outline" size={16} color={colors.ink} />
            <Text style={styles.playAllText}>{t('label.offline', { n: offlineSongs.length })}</Text>
          </Pressable>
          <Pressable
            onPress={downloadForOffline}
            disabled={downloadState === 'downloading' || audioLoading}
            style={({ pressed }) => [styles.playAllButton, styles.audioButton, pressed && styles.pressed]}
          >
            <Ionicons
              name={downloadState === 'downloading' ? 'hourglass-outline' : 'download-outline'}
              size={16}
              color={colors.ink}
            />
            <Text style={styles.playAllText} numberOfLines={1}>
              {downloadState === 'downloading'
                ? downloadProgress
                  ? t('msg.downloadProgress', { done: downloadProgress.done, total: downloadProgress.total, failed: '' })
                  : t('label.downloadingBtn')
                : t('label.downloadBtn')}
            </Text>
          </Pressable>
        </View>
      )}

      {Platform.OS !== 'web' && offlineSongs.length > 0 && (
        <Pressable
          onPress={clearOfflineCache}
          style={({ pressed }) => [styles.clearCacheRow, pressed && styles.pressed]}
        >
          <Ionicons name="trash-outline" size={15} color={colors.muted} />
          <Text style={styles.clearCacheText}>
            {t('label.clearCache', { size: formatBytes(offlineSongs.reduce((sum, s) => sum + s.sizeBytes, 0)) })}
          </Text>
        </Pressable>
      )}

      {currentSongs.length > 0 && (
        <View style={styles.searchRow}>
          <Ionicons name="search-outline" size={18} color={colors.muted} />
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={setSearchQuery}
            placeholder={t('label.search')}
            placeholderTextColor={colors.muted}
            style={styles.searchInput}
            value={searchQuery}
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')} hitSlop={8} style={styles.searchClear}>
              <Ionicons name="close-circle" size={18} color={colors.muted} />
            </Pressable>
          )}
        </View>
      )}

      {currentSongs.length > 0 && searchQuery.trim().length > 0 && filteredSongs.length === 0 && (
        <Text style={styles.helperText}>{t('msg.noResults', { query: searchQuery.trim() })}</Text>
      )}

    </>
  );

  const listFooter = (
    <View style={styles.notice}>
      <Ionicons name="shield-checkmark-outline" size={18} color={colors.success} />
      <Text style={styles.noticeText}>{t('notice.footer')}</Text>
    </View>
  );

  if (showWelcome) {
    const features: Array<{ icon: keyof typeof Ionicons.glyphMap; key: string }> = [
      { icon: 'headset-outline', key: 'welcome.f1' },
      { icon: 'lock-open-outline', key: 'welcome.f2' },
      { icon: 'cloud-offline-outline', key: 'welcome.f3' },
      { icon: 'git-merge-outline', key: 'welcome.f4' },
      { icon: 'heart-outline', key: 'welcome.f5' },
    ];
    const tutoSteps = ['tuto.s1', 'tuto.s2', 'tuto.s3', 'tuto.s4'];
    const welcomeFade = welcomeAnim;
    const welcomeSlide = welcomeAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [30, 0],
    });
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="light" />
        <ScrollView contentContainerStyle={styles.welcomeContent} showsVerticalScrollIndicator={false}>
          {welcomeSeen && (
            <Pressable
              onPress={() => setShowWelcome(false)}
              hitSlop={8}
              style={styles.welcomeCloseButton}
            >
              <Ionicons name="close" size={22} color={colors.muted} />
            </Pressable>
          )}
          <Pressable
            onPress={() => setLang((value) => (value === 'fr' ? 'en' : 'fr'))}
            hitSlop={8}
            style={styles.welcomeLangButton}
          >
            <Ionicons name="globe-outline" size={15} color={colors.muted} />
            <Text style={styles.langButtonText}>{lang === 'fr' ? 'FR' : 'EN'}</Text>
          </Pressable>

          <Animated.View
            style={[
              styles.welcomeAnimatedContent,
              { opacity: welcomeFade, transform: [{ translateY: welcomeSlide }] },
            ]}
          >
            <View style={styles.welcomeLogo}>
              <Image source={require('./assets/icon.png')} style={styles.welcomeLogoImage} />
            </View>
            <Text style={styles.welcomeTitle}>MusicME</Text>
            <Text style={styles.welcomeTagline}>{t('welcome.tagline')}</Text>

            <View style={styles.welcomeFeatures}>
              {features.map((feature) => (
                <View key={feature.key} style={styles.welcomeFeatureRow}>
                  <Ionicons name={feature.icon} size={20} color={colors.accent} />
                  <Text style={styles.welcomeFeatureText}>{t(feature.key)}</Text>
                </View>
              ))}
            </View>

            <View style={styles.tutoCard}>
              <Text style={styles.tutoTitle}>{t('tuto.title')}</Text>
              {tutoSteps.map((step, index) => (
                <View key={step} style={styles.tutoStepRow}>
                  <View style={styles.tutoStepBadge}>
                    <Text style={styles.tutoStepNumber}>{index + 1}</Text>
                  </View>
                  <Text style={styles.tutoStepText}>{t(step)}</Text>
                </View>
              ))}
            </View>

            <Pressable
              onPress={() => {
                if (!welcomeSeen) {
                  setWelcomeSeen(true);
                  void persistWelcomeSeen();
                }
                setShowWelcome(false);
              }}
              style={({ pressed }) => [styles.welcomeStartButton, pressed && styles.pressed]}
            >
              <Text style={styles.welcomeStartText}>
                {welcomeSeen ? t('welcome.close') : t('welcome.start')}
              </Text>
              <Ionicons
                name={welcomeSeen ? 'close' : 'arrow-forward'}
                size={18}
                color={colors.ink}
              />
            </Pressable>

            <Text style={styles.welcomeNote}>{t('welcome.note')}</Text>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <FlatList
        data={filteredSongs}
        keyExtractor={(song, index) => `${song.id}-${index}`}
        renderItem={renderSong}
        ListHeaderComponent={listHeader}
        ListFooterComponent={listFooter}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={18}
        maxToRenderPerBatch={18}
        windowSize={11}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 22, paddingTop: 48, paddingBottom: 44 },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
    marginBottom: 24,
    position: 'relative',
  },
  title: { color: colors.ink, fontSize: 29, fontWeight: '800' },
  langButton: {
    alignItems: 'center',
    backgroundColor: colors.cardSoft,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 6,
    position: 'absolute',
    right: 0,
  },
  langButtonText: { color: colors.muted, fontSize: 11, fontWeight: '800' },
  infoButton: {
    alignItems: 'center',
    backgroundColor: colors.cardSoft,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: 'center',
    paddingHorizontal: 9,
    paddingVertical: 6,
    position: 'absolute',
    left: 0,
  },
  logo: {
    borderRadius: 10,
    height: 48,
    overflow: 'hidden',
    width: 48,
  },
  logoImage: {
    height: '100%',
    width: '100%',
  },
  playerCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 20,
    overflow: 'hidden',
  },
  nowPlaying: { alignItems: 'center', flexDirection: 'row', padding: 13 },
  nowPlayingCopy: { flex: 1 },
  nowPlayingTitle: { color: colors.ink, fontSize: 14, fontWeight: '800', marginBottom: 4 },
  nowPlayingChannel: { color: colors.muted, fontSize: 11 },
  iconButton: { padding: 7 },
  controlsRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    paddingBottom: 10,
    paddingHorizontal: 13,
  },
  controlButton: { alignItems: 'center', justifyContent: 'center', padding: 10 },
  controlButtonPrimary: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: 24,
    height: 48,
    justifyContent: 'center',
    marginHorizontal: 22,
    width: 48,
  },
  seekRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    paddingBottom: 12,
    paddingHorizontal: 15,
  },
  seekTime: { color: colors.muted, fontSize: 10, fontVariant: ['tabular-nums'] },
  sleepRow: {
    alignItems: 'center',
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 13,
    paddingTop: 11,
  },
  sleepChip: {
    backgroundColor: colors.cardSoft,
    borderRadius: 14,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  sleepChipActive: {
    alignItems: 'center',
    backgroundColor: colors.cardSoft,
    borderRadius: 14,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  sleepChipText: { color: colors.ink, fontSize: 11, fontWeight: '700' },
  publicPanel: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 10,
    padding: 13,
  },
  publicTitle: { color: colors.ink, fontSize: 15, fontWeight: '800', marginBottom: 11, textAlign: 'center' },
  publicSubtitle: { color: colors.muted, fontSize: 12, marginBottom: 10, textAlign: 'center' },
  publicInputRow: {
    alignItems: 'center',
    backgroundColor: colors.cardSoft,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 9,
    minHeight: 48,
    paddingLeft: 12,
    paddingRight: 6,
  },
  publicInput: { color: colors.ink, flex: 1, fontSize: 12, minWidth: 0 },
  publicPlayButton: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: 8,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  openInYoutubeRow: {
    alignItems: 'center',
    backgroundColor: colors.cardSoft,
    borderRadius: 8,
    flexDirection: 'row',
    gap: 9,
    marginTop: 10,
    minHeight: 42,
    paddingHorizontal: 12,
  },
  openInYoutubeText: { color: colors.ink, flex: 1, fontSize: 12, fontWeight: '700' },
  publicOnlyRow: { alignItems: 'center', flexDirection: 'row', gap: 5, justifyContent: 'center', marginTop: 9 },
  publicOnlyText: { color: colors.muted, fontSize: 11 },
  successCapsule: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: 'rgba(118, 213, 173, 0.14)',
    borderColor: colors.success,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  successCapsuleText: { color: colors.success, fontSize: 12, fontWeight: '800' },
  historyBlock: { borderTopColor: colors.border, borderTopWidth: 1, marginTop: 11, paddingTop: 10 },
  historyHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 7 },
  historyTitle: { color: colors.muted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  historyClear: { color: colors.accent, fontSize: 11 },
  historyChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  historyChip: {
    alignItems: 'center',
    backgroundColor: colors.cardSoft,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 5,
    maxWidth: '100%',
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  historyChipText: { color: colors.ink, fontSize: 11, flexShrink: 1 },
  pressed: { opacity: 0.7 },
  helperText: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 9, textAlign: 'center' },
  collectionsRow: { marginTop: 20 },
  collectionsRowContent: { gap: 8, paddingRight: 4 },
  collectionChip: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    maxWidth: 200,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  collectionChipLabel: {
    flexShrink: 1,
  },
  collectionChipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  collectionChipText: { color: colors.muted, fontSize: 12, fontWeight: '800' },
  collectionChipTextActive: { color: colors.ink },
  sectionHeading: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    marginTop: 24,
  },
  sectionTitle: { color: colors.ink, flex: 1, fontSize: 17, fontWeight: '800', marginRight: 12 },
  sectionActions: { alignItems: 'center', flexDirection: 'row', gap: 14 },
  playAllButton: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: 8,
    flexDirection: 'row',
    gap: 7,
    height: 40,
    justifyContent: 'center',
    marginBottom: 12,
  },
  playAllText: { color: colors.ink, fontSize: 13, fontWeight: '800' },
  playAllRow: { flexDirection: 'row', gap: 10 },
  playAllButtonFlex: { flex: 1 },
  audioButton: { backgroundColor: colors.cardSoft, flex: 1 },
  shuffleButton: {
    alignItems: 'center',
    backgroundColor: colors.cardSoft,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    marginBottom: 12,
    width: 46,
  },
  shuffleButtonActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  clearCacheRow: { alignItems: 'center', flexDirection: 'row', gap: 7, marginBottom: 12, paddingVertical: 4 },
  clearCacheText: { color: colors.muted, fontSize: 11 },
  mixPanel: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 14,
    marginTop: 14,
    padding: 13,
    position: 'relative',
  },
  mixCloseChevron: { position: 'absolute', right: 12, top: 12 },
  mixCollapsedBar: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    marginBottom: 14,
    marginTop: 14,
    paddingVertical: 12,
  },
  mixCollapsedText: { color: colors.accent, fontSize: 14, fontWeight: '800' },
  mixTitle: { color: colors.ink, fontSize: 15, fontWeight: '800', marginBottom: 11, textAlign: 'center' },
  mixSearchRow: {
    alignItems: 'center',
    backgroundColor: colors.cardSoft,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    height: 44,
    paddingHorizontal: 12,
  },
  mixSearchInput: { color: colors.ink, flex: 1, fontSize: 13 },
  mixSearchRowFocused: { borderColor: colors.accent },
  mixResultsLabel: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '800',
    marginTop: 12,
    textTransform: 'uppercase',
  },
  genresRow: { marginTop: 10 },
  genresRowContent: { gap: 6, paddingRight: 4 },
  genreChip: {
    backgroundColor: colors.cardSoft,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  genreChipText: { color: colors.ink, fontSize: 11, fontWeight: '700' },
  mixResultRow: {
    alignItems: 'center',
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    marginTop: 10,
    paddingTop: 10,
  },
  mixResultThumb: {
    backgroundColor: colors.cardSoft,
    borderRadius: 6,
    height: 40,
    marginRight: 10,
    width: 40,
  },
  mixResultCopy: { flex: 1, marginRight: 8 },
  mixResultTitle: { color: colors.ink, fontSize: 12, fontWeight: '700', marginBottom: 3 },
  mixResultMeta: { color: colors.muted, fontSize: 10 },
  radioMetaRow: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  liveBadge: {
    backgroundColor: colors.accent,
    borderRadius: 3,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  liveBadgeText: { color: colors.ink, fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  mixSelectedTitle: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 6,
    marginTop: 12,
    textTransform: 'uppercase',
  },
  mixSelectedRow: { alignItems: 'center', flexDirection: 'row', gap: 8, paddingVertical: 4 },
  mixSelectedName: { color: colors.ink, flex: 1, fontSize: 12 },
  mixLoadButton: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: 8,
    flexDirection: 'row',
    gap: 7,
    height: 40,
    justifyContent: 'center',
    marginTop: 12,
  },
  searchRow: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    height: 44,
    marginBottom: 14,
    paddingHorizontal: 12,
  },
  searchInput: { color: colors.ink, flex: 1, fontSize: 13 },
  searchClear: { padding: 4 },
  loadingRow: { alignItems: 'center', flexDirection: 'row', gap: 9, paddingVertical: 16 },
  loadingText: { color: colors.muted, fontSize: 12 },
  songRow: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    minHeight: 70,
  },
  songIndex: { color: colors.muted, fontSize: 11, fontWeight: '700', width: 25 },
  thumbnail: { backgroundColor: colors.cardSoft, borderRadius: 8, height: 47, marginRight: 11, width: 47 },
  thumbnailFallback: {
    alignItems: 'center',
    backgroundColor: colors.cardSoft,
    borderRadius: 8,
    height: 47,
    justifyContent: 'center',
    marginRight: 11,
    width: 47,
  },
  songCopy: { flex: 1, marginRight: 10 },
  songTitle: { color: colors.ink, fontSize: 13, fontWeight: '700', marginBottom: 5 },
  songChannel: { color: colors.muted, fontSize: 11 },
  songActions: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  downloadIconButton: { padding: 4 },
  notice: {
    alignItems: 'center',
    backgroundColor: '#13241F',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 9,
    marginTop: 24,
    padding: 13,
  },
  noticeText: { color: '#A5CDBD', flex: 1, fontSize: 10, lineHeight: 15 },
  welcomeContent: { alignItems: 'center', flexGrow: 1, justifyContent: 'center', padding: 28 },
  welcomeAnimatedContent: { alignItems: 'center', alignSelf: 'stretch' },
  welcomeLangButton: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 5,
    position: 'absolute',
    right: 22,
    top: 22,
  },
  welcomeCloseButton: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    left: 22,
    top: 22,
  },
  tutoCard: {
    alignSelf: 'stretch',
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 26,
    padding: 14,
  },
  tutoTitle: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  tutoStepRow: { alignItems: 'center', flexDirection: 'row', gap: 10, marginBottom: 10 },
  tutoStepBadge: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: 12,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  tutoStepNumber: { color: colors.ink, fontSize: 12, fontWeight: '800' },
  tutoStepText: { color: colors.muted, flex: 1, fontSize: 12, lineHeight: 17 },
  welcomeLogo: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 26,
    borderWidth: 1,
    height: 96,
    justifyContent: 'center',
    marginBottom: 20,
    width: 96,
  },
  welcomeLogoImage: { borderRadius: 22, height: 72, width: 72 },
  welcomeTitle: { color: colors.ink, fontSize: 34, fontWeight: '900', letterSpacing: 0.5 },
  welcomeTagline: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
    textAlign: 'center',
  },
  welcomeFeatures: {
    alignSelf: 'stretch',
    gap: 12,
    marginTop: 30,
  },
  welcomeFeatureRow: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  welcomeFeatureText: { color: colors.ink, flex: 1, fontSize: 14, fontWeight: '600' },
  welcomeStartButton: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: 12,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    marginTop: 32,
    paddingHorizontal: 24,
    paddingVertical: 14,
    alignSelf: 'stretch',
  },
  welcomeStartText: { color: colors.ink, fontSize: 15, fontWeight: '800' },
  welcomeNote: { color: colors.muted, fontSize: 11, marginTop: 16, textAlign: 'center' },
});
