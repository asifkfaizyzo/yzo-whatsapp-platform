import React from 'react';
import { View, Text, Modal, Pressable, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../../theme/colors';
import { typography } from '../../../theme/typography';
import { spacing } from '../../../theme/spacing';

export type ChannelFilter = 'ALL' | 'WHATSAPP' | 'MESSENGER' | 'INSTAGRAM';

export const CHANNEL_OPTIONS: {
  key: ChannelFilter;
  label: string;
  icon: any;
  color: string;
}[] = [
  { key: 'ALL',       label: 'All Channels', icon: 'apps-outline',   color: colors.primary },
  { key: 'WHATSAPP',  label: 'WhatsApp',     icon: 'logo-whatsapp',  color: '#25D366' },
  { key: 'MESSENGER', label: 'Messenger',    icon: 'chatbubbles',    color: '#0084FF' },
  { key: 'INSTAGRAM', label: 'Instagram',    icon: 'logo-instagram', color: '#E1306C' },
];

interface Props {
  visible: boolean;
  active: ChannelFilter;
  onSelect: (k: ChannelFilter) => void;
  onClose: () => void;
}

export const ChannelFilterSheet: React.FC<Props> = ({ visible, active, onSelect, onClose }) => (
  <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <Pressable style={styles.overlay} onPress={onClose}>
      <Pressable style={styles.sheet} onPress={() => {}}>
        <View style={styles.handle} />
        <Text style={styles.title}>Filter by Channel</Text>

        {CHANNEL_OPTIONS.map((ch) => {
          const isActive = active === ch.key;
          return (
            <TouchableOpacity
              key={ch.key}
              style={[styles.option, isActive && styles.optionActive]}
              activeOpacity={0.7}
              onPress={() => {
                onSelect(ch.key);
                onClose();
              }}
            >
              <Ionicons name={ch.icon} size={22} color={isActive ? ch.color : colors.secondaryGrey} />
              <Text
                style={[
                  styles.optionText,
                  isActive && { color: ch.color, fontWeight: '700' },
                ]}
              >
                {ch.label}
              </Text>
              {isActive && (
                <Ionicons
                  name="checkmark-circle"
                  size={22}
                  color={ch.color}
                  style={{ marginLeft: 'auto' }}
                />
              )}
            </TouchableOpacity>
          );
        })}

        <TouchableOpacity style={styles.closeBtn} activeOpacity={0.7} onPress={onClose}>
          <Text style={styles.closeText}>Done</Text>
        </TouchableOpacity>
      </Pressable>
    </Pressable>
  </Modal>
);

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.huge,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.lightGrey,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  title: {
    ...typography.label,
    color: colors.darkGrey,
    marginBottom: spacing.md,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: 8,
    gap: 12,
  },
  optionActive: { backgroundColor: '#F0F6FF' },
  optionText: { fontSize: 15, color: colors.darkGrey, fontWeight: '500' },
  closeBtn: {
    marginTop: spacing.lg,
    height: 48,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: { fontSize: 15, fontWeight: '700', color: colors.white },
});