import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  Pressable,
  Modal,
  StyleSheet,
  Dimensions,
  SafeAreaView,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MessageType } from '../MessageBubble';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface ImageBubbleProps {
  mediaUrl: string;
  thumbnailUrl?: string | null;
  type: MessageType;
  mediaHeaders?: Record<string, string>;
  onPressMedia?: (url: string, type: MessageType) => void;
}

export const ImageBubble: React.FC<ImageBubbleProps> = ({
  mediaUrl,
  thumbnailUrl,
  type,
  mediaHeaders,
  onPressMedia,
}) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [failed, setFailed] = useState(false);

  const handlePress = () => {
    if (onPressMedia) {
      onPressMedia(mediaUrl, type);
    } else {
      setModalVisible(true);
    }
  };

  return (
    <>
      {type === 'IMAGE' ? (
        <Pressable onPress={handlePress} style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1 }]}>
          {failed ? (
            <View style={[styles.mediaImage, styles.mediaFallback]}>
              <Ionicons name="image-outline" size={28} color="#94A3B8" />
              <Text style={styles.mediaFallbackText}>Couldn't load image</Text>
            </View>
          ) : (
            <Image
              source={{ uri: mediaUrl, headers: mediaHeaders }}
              style={styles.mediaImage}
              resizeMode="cover"
              onError={() => setFailed(true)}
            />
          )}
        </Pressable>
      ) : (
        <Pressable
          onPress={() => onPressMedia?.(mediaUrl, 'VIDEO')}
          style={({ pressed }) => [styles.mediaVideoWrapper, { opacity: pressed ? 0.9 : 1 }]}
        >
          {thumbnailUrl ? (
            <Image
              source={{ uri: thumbnailUrl, headers: mediaHeaders }}
              style={styles.mediaImage}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.mediaImage, styles.videoPlaceholder]} />
          )}
          <View style={styles.playOverlay}>
            <View style={styles.playButtonCircle}>
              <Ionicons name="play" size={24} color="#FFFFFF" style={{ marginLeft: 3 }} />
            </View>
          </View>
        </Pressable>
      )}

      {/* Fullscreen Image Preview Lightbox */}
      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <SafeAreaView style={styles.modalContainer}>
          <TouchableOpacity style={styles.closeBtn} onPress={() => setModalVisible(false)}>
            <Ionicons name="close" size={28} color="#FFFFFF" />
          </TouchableOpacity>
          <Image
            source={{ uri: mediaUrl, headers: mediaHeaders }}
            style={styles.modalImage}
            resizeMode="contain"
          />
        </SafeAreaView>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  mediaImage: {
    width: SCREEN_WIDTH * 0.62,
    height: SCREEN_WIDTH * 0.46,
    borderRadius: 12,
    backgroundColor: '#E2E8F0',
  },
  mediaFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  mediaFallbackText: {
    fontSize: 11,
    color: '#94A3B8',
  },
  videoPlaceholder: {
    backgroundColor: '#0F172A',
  },
  mediaVideoWrapper: {
    position: 'relative',
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    borderRadius: 12,
  },
  playButtonCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtn: {
    position: 'absolute',
    top: 45,
    right: 20,
    zIndex: 10,
    padding: 8,
  },
  modalImage: {
    width: SCREEN_WIDTH,
    height: '80%',
  },
});