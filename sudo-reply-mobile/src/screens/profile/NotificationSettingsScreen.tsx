import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing, borderRadius } from '../../theme/spacing';
import { shadows } from '../../theme/shadows';
import {
  useNotificationPreferences,
  useUpdateNotificationPreferences,
  type NotificationPreferences,
} from '../../hooks/useNotificationPreferences';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

type Props = NativeStackScreenProps<any, 'NotificationSettings'>;

interface ToggleRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  label: string;
  description: string;
  value: boolean;
  disabled?: boolean;
  onToggle: (val: boolean) => void;
}

const ToggleRow: React.FC<ToggleRowProps> = ({
  icon,
  iconColor,
  label,
  description,
  value,
  disabled = false,
  onToggle,
}) => (
  <View style={[styles.toggleRow, disabled && styles.toggleRowDisabled]}>
    <View style={[styles.toggleIconCircle, { backgroundColor: iconColor + '18' }]}>
      <Ionicons name={icon} size={18} color={disabled ? '#CBD5E1' : iconColor} />
    </View>
    <View style={styles.toggleText}>
      <Text style={[styles.toggleLabel, disabled && { color: '#94A3B8' }]}>
        {label}
      </Text>
      <Text style={styles.toggleDesc}>{description}</Text>
    </View>
    <Switch
      value={value}
      onValueChange={onToggle}
      disabled={disabled}
      trackColor={{ false: '#D1D5DB', true: colors.primary + '60' }}
      thumbColor={value ? colors.primary : '#F3F4F6'}
    />
  </View>
);

const TYPE_CONFIG: {
  key: keyof NotificationPreferences['types'];
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  label: string;
  desc: string;
}[] = [
  { key: 'new_message', icon: 'chatbubble', color: '#3B82F6', label: 'New Messages', desc: 'Incoming WhatsApp messages' },
  { key: 'conversation_reassigned', icon: 'swap-horizontal', color: '#EC4899', label: 'Reassigned Chats', desc: 'When a chat is assigned to you' },
  { key: 'broadcast_completed', icon: 'megaphone', color: '#16A34A', label: 'Broadcast Done', desc: 'Campaign finished sending' },
  { key: 'template_approved', icon: 'checkmark-circle', color: '#22C55E', label: 'Template Approved', desc: 'Meta approved your template' },
  { key: 'template_rejected', icon: 'close-circle', color: '#DC2626', label: 'Template Rejected', desc: 'Meta rejected your template' },
];

export const NotificationSettingsScreen: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { data: prefs, isLoading } = useNotificationPreferences();
  const update = useUpdateNotificationPreferences();

  const pushEnabled = prefs?.pushEnabled ?? true;
  const types = prefs?.types;

  const togglePush = (val: boolean) => {
    update.mutate({ pushEnabled: val });
  };

  const toggleType = (key: keyof NotificationPreferences['types'], val: boolean) => {
    update.mutate({ types: { ...types, [key]: val } });
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.darkGrey} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notification Settings</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Master Toggle */}
        <View style={styles.card}>
          <ToggleRow
            icon="notifications"
            iconColor={colors.primary}
            label="Push Notifications"
            description="Master switch for all push alerts"
            value={pushEnabled}
            onToggle={togglePush}
          />
        </View>

        {/* Per-Type Toggles */}
        <Text style={styles.sectionLabel}>NOTIFICATION TYPES</Text>
        <View style={styles.card}>
          {TYPE_CONFIG.map((item, idx) => (
            <React.Fragment key={item.key}>
              {idx > 0 && <View style={styles.divider} />}
              <ToggleRow
                icon={item.icon}
                iconColor={item.color}
                label={item.label}
                description={item.desc}
                value={types?.[item.key] ?? true}
                disabled={!pushEnabled}
                onToggle={(val) => toggleType(item.key, val)}
              />
            </React.Fragment>
          ))}
        </View>

        {!pushEnabled && (
          <View style={styles.warningBox}>
            <Ionicons name="information-circle" size={18} color="#D97706" />
            <Text style={styles.warningText}>
              All push notifications are paused. You'll still see alerts in the
              Notification Center when you open the app.
            </Text>
          </View>
        )}

        <View style={{ height: spacing.huge + insets.bottom }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background || '#F8F9FA' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    backgroundColor: colors.white,
  },
  backBtn: { padding: 4 },
  headerTitle: { ...typography.h2, color: colors.darkGrey },
  scroll: { paddingHorizontal: spacing.base, paddingTop: spacing.md },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.secondaryGrey,
    letterSpacing: 0.8,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    marginLeft: 4,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    ...shadows.sm,
    borderWidth: 1,
    borderColor: colors.lightGrey,
    overflow: 'hidden',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: spacing.base,
  },
  toggleRowDisabled: { opacity: 0.5 },
  toggleIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleText: { flex: 1, marginLeft: 12 },
  toggleLabel: { fontSize: 15, fontWeight: '600', color: colors.darkGrey },
  toggleDesc: { fontSize: 12, color: colors.secondaryGrey, marginTop: 1 },
  divider: { height: 1, backgroundColor: colors.lightGrey, marginHorizontal: spacing.base },
  warningBox: {
    flexDirection: 'row',
    backgroundColor: '#FEF3C7',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginTop: spacing.lg,
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    color: '#92400E',
    lineHeight: 18,
  },
});