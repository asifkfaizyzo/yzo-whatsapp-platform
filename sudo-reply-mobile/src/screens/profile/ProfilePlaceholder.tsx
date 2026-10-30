import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Application from 'expo-application';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing, borderRadius } from '../../theme/spacing';
import { shadows } from '../../theme/shadows';
import { Avatar } from '../../components/ui/Avatar';
import { Divider } from '../../components/ui/Divider';
import { StatusDot } from '../../components/ui/StatusDot';
import { useAuthStore } from '../../stores/authStore';
import { useLogout } from '../../hooks/useAuth';

// ── Types ──────────────────────────────────────────────────────
type Availability = 'available' | 'away' | 'offline';

interface MenuItemProps {
  icon: keyof typeof Ionicons.glyphMap;
  iconBg: string;
  iconColor: string;
  label: string;
  subtitle?: string;
  onPress: () => void;
  danger?: boolean;
  showChevron?: boolean;
}

// ── Menu Item ──────────────────────────────────────────────────
const MenuItem: React.FC<MenuItemProps> = ({
  icon,
  iconBg,
  iconColor,
  label,
  subtitle,
  onPress,
  danger = false,
  showChevron = true,
}) => (
  <TouchableOpacity
    style={styles.menuItem}
    onPress={onPress}
    activeOpacity={0.6}
  >
    <View style={[styles.menuIconCircle, { backgroundColor: iconBg }]}>
      <Ionicons name={icon} size={18} color={iconColor} />
    </View>
    <View style={styles.menuTextWrap}>
      <Text
        style={[
          styles.menuLabel,
          danger && { color: colors.error },
        ]}
      >
        {label}
      </Text>
      {subtitle ? (
        <Text style={styles.menuSubtitle}>{subtitle}</Text>
      ) : null}
    </View>
    {showChevron && (
      <Ionicons
        name="chevron-forward"
        size={16}
        color={colors.secondaryGrey}
      />
    )}
  </TouchableOpacity>
);

// ── Availability Options ───────────────────────────────────────
const AVAILABILITY_OPTIONS: {
  value: Availability;
  label: string;
  desc: string;
  color: string;
}[] = [
  {
    value: 'available',
    label: 'Available',
    desc: 'Ready to take conversations',
    color: '#22C55E',
  },
  {
    value: 'away',
    label: 'Away',
    desc: 'Temporarily unavailable',
    color: '#F59E0B',
  },
  {
    value: 'offline',
    label: 'Offline',
    desc: 'Not receiving conversations',
    color: '#94A3B8',
  },
];

// ── Main Component ─────────────────────────────────────────────
export const ProfilePlaceholder: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const user = useAuthStore((s) => s.user);
  const userType = useAuthStore((s) => s.userType);
  const logout = useLogout();

  const [showAvailabilitySheet, setShowAvailabilitySheet] = useState(false);
  const [localStatus, setLocalStatus] = useState<Availability>(
    (user?.availabilityStatus?.toLowerCase() as Availability) || 'available'
  );

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
      ]
    );
  };

  const handleSetAvailability = (status: Availability) => {
    setLocalStatus(status);
    setShowAvailabilitySheet(false);
    // TODO: PATCH /api3/profile/availability when backend endpoint is ready
  };

  const currentAvail = AVAILABILITY_OPTIONS.find(
    (o) => o.value === localStatus
  ) || AVAILABILITY_OPTIONS[0];

  const appVersion = Application.nativeApplicationVersion || '1.0.0';
  const buildNumber = Application.nativeBuildVersion || '1';

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header Banner ──────────────────────────────── */}
        <View style={styles.headerBanner}>
          <View style={styles.headerPattern} />
          <Text style={styles.headerGreeting}>
            {userType === 'TENANT' ? 'Admin Panel' : 'Agent Portal'}
          </Text>
          <Text style={styles.headerSubtext}>
            Manage your account and preferences
          </Text>
        </View>

        {/* ── Profile Card (overlapping banner) ──────────── */}
        <View style={styles.profileCard}>
          <View style={styles.avatarWrap}>
            <Avatar name={user?.name} size={68} />
            <TouchableOpacity
              style={[
                styles.statusPill,
                { backgroundColor: currentAvail.color },
              ]}
              onPress={() => setShowAvailabilitySheet(true)}
              activeOpacity={0.7}
            >
              <View style={styles.statusPillDot} />
              <Text style={styles.statusPillText}>
                {currentAvail.label}
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.profileName}>
            {user?.name || 'Agent'}
          </Text>
          <Text style={styles.profileEmail}>
            {user?.email || ''}
          </Text>

          <View style={styles.roleChip}>
            <Ionicons
              name={
                userType === 'TENANT'
                  ? 'shield-checkmark'
                  : 'headset'
              }
              size={14}
              color={colors.primary}
            />
            <Text style={styles.roleChipText}>
              {userType === 'TENANT' ? 'Tenant Admin' : 'Support Agent'}
            </Text>
          </View>
        </View>

        {/* ── Workspace ──────────────────────────────────── */}
        {user?.tenant && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>WORKSPACE</Text>
            <View style={styles.menuCard}>
              <MenuItem
                icon="business"
                iconBg="#EEF2FF"
                iconColor="#4F46E5"
                label={user.tenant.tenantName || 'Unnamed Workspace'}
                subtitle="Active workspace"
                onPress={() => {}}
                showChevron={false}
              />
            </View>
          </View>
        )}

        {/* ── Settings ───────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>SETTINGS</Text>
          <View style={styles.menuCard}>
            <MenuItem
              icon="person"
              iconBg="#E8F0FE"
              iconColor={colors.primary}
              label="Edit Profile"
              subtitle="Name, photo, contact info"
              onPress={() => Alert.alert('Coming Soon', 'Profile editing will be available in the next update.')}
            />
            <Divider />
            <MenuItem
              icon="lock-closed"
              iconBg="#FEF3C7"
              iconColor="#D97706"
              label="Change Password"
              subtitle="Update your password"
              onPress={() => Alert.alert('Coming Soon', 'Password management will be available in the next update.')}
            />
            <Divider />
            <MenuItem
  icon="notifications"
  iconBg="#FEE2E2"
  iconColor="#DC2626"
  label="Notifications"
  subtitle="View all alerts and updates"
  onPress={() => navigation.navigate('NotificationSettings')}
/>
          </View>
        </View>

        {/* ── Support ────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>SUPPORT</Text>
          <View style={styles.menuCard}>
            <MenuItem
              icon="help-circle"
              iconBg="#E0F2FE"
              iconColor="#0284C7"
              label="Help & FAQ"
              subtitle="Guides and troubleshooting"
              onPress={() => Alert.alert('Coming Soon', 'Help center is under construction.')}
            />
            <Divider />
            <MenuItem
              icon="information-circle"
              iconBg="#F0FDF4"
              iconColor="#16A34A"
              label="About Sudo Reply"
              subtitle={`Version ${appVersion} (${buildNumber})`}
              onPress={() =>
                Alert.alert(
                  'Sudo Reply',
                  `Version ${appVersion} (Build ${buildNumber})\n\nWhatsApp Business Platform\nby YZO Technologies`
                )
              }
              showChevron={false}
            />
          </View>
        </View>

        {/* ── Sign Out ───────────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.menuCard}>
            <MenuItem
              icon="log-out"
              iconBg="#FEE2E2"
              iconColor={colors.error}
              label="Sign Out"
              subtitle="Log out of your account"
              onPress={handleLogout}
              danger
            />
          </View>
        </View>

        {/* ── Footer ─────────────────────────────────────── */}
        <Text style={styles.footerText}>
          Sudo Reply v{appVersion} · YZO Technologies
        </Text>
        <View style={{ height: spacing.huge + insets.bottom }} />
      </ScrollView>

      {/* ── Availability Bottom Sheet ────────────────────── */}
      <Modal
        visible={showAvailabilitySheet}
        animationType="slide"
        transparent
        onRequestClose={() => setShowAvailabilitySheet(false)}
      >
        <TouchableOpacity
          style={styles.sheetOverlay}
          activeOpacity={1}
          onPress={() => setShowAvailabilitySheet(false)}
        >
          <View style={styles.sheetContainer}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Set Availability</Text>
            <Text style={styles.sheetSubtitle}>
              This controls whether new conversations are assigned to you.
            </Text>

            {AVAILABILITY_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.sheetOption,
                  localStatus === option.value && styles.sheetOptionActive,
                ]}
                onPress={() => handleSetAvailability(option.value)}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.sheetOptionDot,
                    { backgroundColor: option.color },
                  ]}
                />
                <View style={styles.sheetOptionText}>
                  <Text
                    style={[
                      styles.sheetOptionLabel,
                      localStatus === option.value && {
                        color: colors.primary,
                      },
                    ]}
                  >
                    {option.label}
                  </Text>
                  <Text style={styles.sheetOptionDesc}>
                    {option.desc}
                  </Text>
                </View>
                {localStatus === option.value && (
                  <Ionicons
                    name="checkmark-circle"
                    size={22}
                    color={colors.primary}
                  />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

// ── Styles ─────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    paddingBottom: spacing.base,
  },

  // Header Banner
  headerBanner: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl + 34, // extra space for card overlap
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    overflow: 'hidden',
  },
  headerPattern: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  headerGreeting: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  headerSubtext: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 4,
  },

  // Profile Card
  profileCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    marginHorizontal: spacing.base,
    marginTop: -50, // overlap the banner
    ...shadows.sm,
    borderWidth: 1,
    borderColor: colors.lightGrey,
    marginBottom: spacing.lg,
  },
  avatarWrap: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 8,
  },
  statusPillDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
    marginRight: 5,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  profileName: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.darkGrey,
    textAlign: 'center',
  },
  profileEmail: {
    fontSize: 14,
    color: colors.secondaryGrey,
    marginTop: 2,
    textAlign: 'center',
  },
  roleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight || '#E8F0FE',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
    marginTop: spacing.md,
  },
  roleChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
    marginLeft: 5,
  },

  // Sections
  section: {
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.base,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.secondaryGrey,
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
    marginLeft: 4,
  },
  menuCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    ...shadows.sm,
    borderWidth: 1,
    borderColor: colors.lightGrey,
    overflow: 'hidden',
  },

  // Menu Item
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: spacing.base,
  },
  menuIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuTextWrap: {
    flex: 1,
    marginLeft: 12,
  },
  menuLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.darkGrey,
  },
  menuSubtitle: {
    fontSize: 12,
    color: colors.secondaryGrey,
    marginTop: 1,
  },

  // Footer
  footerText: {
    fontSize: 12,
    color: colors.secondaryGrey,
    textAlign: 'center',
    marginTop: spacing.base,
  },

  // Availability Sheet
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl + 20,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.lightGrey,
    alignSelf: 'center',
    marginBottom: spacing.base,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.darkGrey,
    marginBottom: 4,
  },
  sheetSubtitle: {
    fontSize: 13,
    color: colors.secondaryGrey,
    marginBottom: spacing.lg,
    lineHeight: 18,
  },
  sheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    borderRadius: 12,
    marginBottom: 6,
    backgroundColor: '#F8F9FA',
  },
  sheetOptionActive: {
    backgroundColor: '#E8F0FE',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  sheetOptionDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  sheetOptionText: {
    flex: 1,
  },
  sheetOptionLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.darkGrey,
  },
  sheetOptionDesc: {
    fontSize: 12,
    color: colors.secondaryGrey,
    marginTop: 1,
  },
});