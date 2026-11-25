import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Dimensions,
  Alert,
  GestureResponderEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio, AVPlaybackStatus } from 'expo-av';
import { formatAudioTime, formatFileSize } from './bubbleUtils';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const WAVE_BAR_COUNT = 28;
const WAVE_MIN_HEIGHT = 4;
const WAVE_MAX_HEIGHT = 26;

// Deterministic waveform generator fallback
const generateVoiceWaveform = (seedId: string, barCount: number = WAVE_BAR_COUNT): number[] => {
  if (!seedId) return Array(barCount).fill(10);
  let hash = 0;
  for (let i = 0; i < seedId.length; i++) {
    hash = seedId.charCodeAt(i) + ((hash << 5) - hash);
  }
  const bars: number[] = [];
  for (let i = 0; i < barCount; i++) {
    const envelope = Math.sin((i / (barCount - 1)) * Math.PI);
    const pseudoRandom = Math.abs(Math.sin(hash + i * 9.15));
    const height = WAVE_MIN_HEIGHT + Math.floor(pseudoRandom * (WAVE_MAX_HEIGHT - 6) * envelope);
    bars.push(Math.max(WAVE_MIN_HEIGHT, height));
  }
  return bars;
};

const normalizeWaveform = (raw: unknown, barCount: number = WAVE_BAR_COUNT): number[] | null => {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const clean = raw.map((v) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.max(0, n) : 0;
  });
  const bucketSize = clean.length / barCount;
  const buckets: number[] = [];
  for (let i = 0; i < barCount; i++) {
    const start = Math.floor(i * bucketSize);
    const end = Math.max(start + 1, Math.floor((i + 1) * bucketSize));
    let sum = 0, count = 0;
    for (let j = start; j < end && j < clean.length; j++) {
      sum += clean[j];
      count++;
    }
    buckets.push(count ? sum / count : 0);
  }
  const max = Math.max(...buckets);
  if (max <= 0) return null;
  return buckets.map((v) =>
    Math.round(WAVE_MIN_HEIGHT + (v / max) * (WAVE_MAX_HEIGHT - WAVE_MIN_HEIGHT))
  );
};

let activePause: (() => Promise<void>) | null = null;

const configureAudioMode = () =>
  Audio.setAudioModeAsync({
    allowsRecordingIOS: false,
    playsInSilentModeIOS: true,
    shouldDuckAndroid: true,
    playThroughEarpieceAndroid: false,
  }).catch(() => {});

interface VoiceBubbleProps {
  audioUrl: string;
  isMe: boolean;
  messageId: string;
  waveformProp?: number[];
  mediaSize?: number;
  headers?: Record<string, string>;
}

export const VoiceBubble: React.FC<VoiceBubbleProps> = ({
  audioUrl,
  isMe,
  messageId,
  waveformProp,
  mediaSize,
  headers,
}) => {
  const soundRef = useRef<Audio.Sound | null>(null);
  const mountedRef = useRef(true);
  const loadingRef = useRef(false);
  const waveformWidthRef = useRef(0);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);

  const waveBars = useMemo(
    () => normalizeWaveform(waveformProp) ?? generateVoiceWaveform(messageId, WAVE_BAR_COUNT),
    [waveformProp, messageId]
  );

  const pauseSelf = useCallback(async () => {
    await soundRef.current?.pauseAsync().catch(() => {});
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (activePause === pauseSelf) activePause = null;
      const sound = soundRef.current;
      soundRef.current = null;
      if (sound) {
        sound.setOnPlaybackStatusUpdate(null);
        sound.unloadAsync().catch(() => {});
      }
    };
  }, [pauseSelf]);

  const onStatus = useCallback((status: AVPlaybackStatus) => {
    if (!mountedRef.current) return;
    if (!status.isLoaded) {
      if (status.error) setIsPlaying(false);
      return;
    }
    if (status.didJustFinish) {
      setIsPlaying(false);
      setPosition(0);
      setDuration(status.durationMillis ?? 0);
      soundRef.current?.setStatusAsync({ shouldPlay: false, positionMillis: 0 }).catch(() => {});
      return;
    }
    setPosition(status.positionMillis);
    setDuration(status.durationMillis ?? 0);
    setIsPlaying(status.isPlaying);
  }, []);

  const claimPlayback = async () => {
    if (activePause && activePause !== pauseSelf) {
      await activePause();
    }
    activePause = pauseSelf;
  };

  const handlePlayPause = async () => {
    if (loadingRef.current) return;
    try {
      const existing = soundRef.current;
      if (existing) {
        if (isPlaying) {
          await existing.pauseAsync();
        } else {
          await configureAudioMode();
          await claimPlayback();
          await existing.playAsync();
        }
        return;
      }
      loadingRef.current = true;
      setIsLoading(true);

      await configureAudioMode();
      await claimPlayback();

      const { sound } = await Audio.Sound.createAsync(
        { uri: audioUrl, headers },
        { shouldPlay: true, isLooping: false, progressUpdateIntervalMillis: 100 },
        onStatus
      );

      if (!mountedRef.current) {
        sound.setOnPlaybackStatusUpdate(null);
        sound.unloadAsync().catch(() => {});
        return;
      }
      soundRef.current = sound;
    } catch (error) {
      if (mountedRef.current) setIsPlaying(false);
      Alert.alert('Playback Error', 'Could not play voice message.');
    } finally {
      loadingRef.current = false;
      if (mountedRef.current) setIsLoading(false);
    }
  };

  const handleSeekWaveform = async (evt: GestureResponderEvent) => {
    const sound = soundRef.current;
    if (!sound || duration <= 0 || waveformWidthRef.current <= 0) return;
    const fraction = Math.max(0, Math.min(1, evt.nativeEvent.locationX / waveformWidthRef.current));
    const seekMillis = Math.floor(fraction * duration);
    setPosition(seekMillis);
    await sound.setPositionAsync(seekMillis).catch(() => {});
  };

  const progress = duration > 0 ? position / duration : 0;
  const filledBars = Math.round(progress * waveBars.length);
  const activeColor = isMe ? '#1E3A8A' : '#2563EB';
  const inactiveColor = isMe ? '#93C5FD' : '#CBD5E1';

  const timeLabel = isPlaying || position > 0
    ? formatAudioTime(position)
    : duration > 0
      ? formatAudioTime(duration)
      : formatFileSize(mediaSize) || '0:00';

  return (
    <View style={styles.audioCard}>
      <TouchableOpacity
        style={[styles.audioPlayBtn, isMe && styles.audioPlayBtnMe]}
        onPress={handlePlayPause}
        disabled={isLoading}
        activeOpacity={0.8}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <Ionicons
            name={isPlaying ? 'pause' : 'play'}
            size={18}
            color="#FFFFFF"
            style={{ marginLeft: isPlaying ? 0 : 2 }}
          />
        )}
      </TouchableOpacity>

      <View style={styles.audioWaveContainer}>
        <TouchableOpacity
          activeOpacity={1}
          onPress={handleSeekWaveform}
          onLayout={(e) => {
            waveformWidthRef.current = e.nativeEvent.layout.width;
          }}
          style={styles.waveformTouch}
        >
          <View style={styles.waveformRow} pointerEvents="none">
            {waveBars.map((height, index) => (
              <View
                key={index}
                style={[
                  styles.waveBar,
                  {
                    height,
                    backgroundColor: index < filledBars ? activeColor : inactiveColor,
                  },
                ]}
              />
            ))}
          </View>
        </TouchableOpacity>

        <View style={styles.audioMetaRow}>
          <Text style={[styles.audioTimeText, isMe ? styles.myTime : styles.theirTime]}>
            {timeLabel}
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  audioCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
    width: SCREEN_WIDTH * 0.58,
  },
  audioPlayBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  audioPlayBtnMe: {
    backgroundColor: '#1E3A8A',
  },
  audioWaveContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  waveformTouch: {
    height: 28,
    justifyContent: 'center',
  },
  waveformRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 28,
  },
  waveBar: {
    width: 2.5,
    borderRadius: 2,
  },
  audioMetaRow: {
    marginTop: 2,
    flexDirection: 'row',
    alignItems: 'center',
  },
  audioTimeText: {
    fontSize: 10.5,
    fontWeight: '600',
  },
  myTime: { color: '#2563EB' },
  theirTime: { color: '#94A3B8' },
});