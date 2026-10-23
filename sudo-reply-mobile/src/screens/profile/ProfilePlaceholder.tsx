import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing, borderRadius } from '../../theme/spacing';
import { shadows } from '../../theme/shadows';
import { ScreenHeader } from '../../components/layout/ScreenHeader';
import { Avatar } from '../../components/ui/Avatar';
import { Divider } from '../../components/ui/Divider';
import { StatusDot } from '../../components/ui/StatusDot';
import { useAuthStore } from '../../stores/authStore';
import { useLogout } from '../../hooks/useAuth';

interface MenuItemProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  danger?: boolean;
}

const MenuItem: React.FC<MenuItemProps> = ({
  icon,
  label,
  onPress,
  danger = false,
}) => (
  <TouchableOpacity
    style={styles.menuItem}
    onPress={onPress}
    activeOpacity={0.6}
  >
    <Ionicons
      name={icon}
      size={22}
      color={danger ? colors.error : colors.darkGrey}
    />
    <Text
      style={[
        styles.menuLabel,
        danger && { color: colors.error },
      ]}
    >
      {label}
    </Text>
    <Ionicons
      name="chevron-forward"
      size={18}
      color={colors.secondaryGrey}
    />
  </TouchableOpacity>
);

export const ProfilePlaceholder: React.FC = () => {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const userType = useAuthStore((s) => s.userType);
  const logout = useLogout();

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: () => logout(),
        },
      ],
    );
  };

  const availabilityStatus =
    (user?.availabilityStatus?.toLowerCase() as 'available' | 'away' | 'offline') ||
    'available';

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScreenHeader title="Profile" />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Profile Card ── */}
        <View style={styles.profileCard}>
          <Avatar
            name={user?.name}
            size={72}
          />
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>
              {user?.name || 'Loading...'}
            </Text>
            <Text style={styles.profileEmail}>
              {user?.email || ''}
            </Text>
            <View style={styles.statusRow}>
              <StatusDot status={availabilityStatus} />
              <Text style={styles.statusText}>
                {availabilityStatus.charAt(0).toUpperCase() +
                  availabilityStatus.slice(1)}
              </Text>
              <View style={styles.roleBadge}>
                <Text style={styles.roleText}>
                  {userType === 'TENANT' ? 'Admin' : 'Agent'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* ── Tenant Info ── */}
        {user?.tenant && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Workspace</Text>
            <View style={styles.infoRow}>
              <Ionicons
                name="business-outline"
                size={20}
                color={colors.secondaryGrey}
              />
              <Text style={styles.infoText}>
                {user.tenant.tenantName || 'Unnamed Workspace'}
              </Text>
            </View>
          </View>
        )}

        {/* ── Settings ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Settings</Text>
          <View style={styles.menuCard}>
            <MenuItem
              icon="person-outline"
              label="Edit Profile"
              onPress={() => Alert.alert('Coming Soon', 'Phase 4')}
            />
            <Divider />
            <MenuItem
              icon="lock-closed-outline"
              label="Change Password"
              onPress={() => Alert.alert('Coming Soon', 'Phase 4')}
            />
            <Divider />
            <MenuItem
              icon="notifications-outline"
              label="Notifications"
              onPress={() => Alert.alert('Coming Soon', 'Phase 4')}
            />
          </View>
        </View>

        {/* ── Support ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Support</Text>
          <View style={styles.menuCard}>
            <MenuItem
              icon="help-circle-outline"
              label="Help & FAQ"
              onPress={() => Alert.alert('Coming Soon')}
            />
            <Divider />
            <MenuItem
              icon="information-circle-outline"
              label="About Sudo Reply"
              onPress={() => Alert.alert('Sudo Reply', 'v1.0.0')}
            />
          </View>
        </View>

        {/* ── Logout ── */}
        <View style={styles.section}>
          <View style={styles.menuCard}>
            <MenuItem
              icon="log-out-outline"
              label="Sign Out"
              onPress={handleLogout}
              danger
            />
          </View>
        </View>

        <View style={{ height: spacing.huge }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.base,
  },
  profileCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    ...shadows.sm,
    borderWidth: 1,
    borderColor: colors.lightGrey,
    marginBottom: spacing.xl,
  },
  profileInfo: {
    flex: 1,
    marginLeft: spacing.base,
  },
  profileName: {
    ...typography.h3,
    color: colors.darkGrey,
  },
  profileEmail: {
    ...typography.body,
    color: colors.secondaryGrey,
    marginTop: 2,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  statusText: {
    ...typography.labelSmall,
    color: colors.secondaryGrey,
    marginLeft: spacing.xs,
  },
  roleBadge: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    marginLeft: spacing.sm,
  },
  roleText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.labelSmall,
    color: colors.secondaryGrey,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  menuCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    ...shadows.sm,
    borderWidth: 1,
    borderColor: colors.lightGrey,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.base,
  },
  menuLabel: {
    ...typography.body,
    color: colors.darkGrey,
    flex: 1,
    marginLeft: spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.base,
    ...shadows.sm,
    borderWidth: 1,
    borderColor: colors.lightGrey,
  },
  infoText: {
    ...typography.body,
    color: colors.darkGrey,
    marginLeft: spacing.md,
  },
});