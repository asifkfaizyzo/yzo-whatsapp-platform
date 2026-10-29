import React from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing, borderRadius } from '../../theme/spacing';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { useCampaigns } from '../../hooks/useCampaigns';
import { useAuthStore } from '../../stores/authStore';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

type Props = NativeStackScreenProps<any, 'CampaignsList'>;

const statusColors: Record<string, string> = {
  SCHEDULED: '#F59E0B',
  PROCESSING: '#3B82F6',
  SENDING: '#3B82F6',
  COMPLETED: '#16A34A',
  PAUSED: '#8B5CF6',
  CANCELLED: '#6B7280',
  FAILED: '#DC2626',
  DRAFT: '#6B7280',
};

export const CampaignsListScreen: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { data: campaigns = [], isLoading, refetch, isRefetching } = useCampaigns();
  const userType = useAuthStore((s) => s.userType);
  const isTenant = userType === 'TENANT';

  const renderItem = ({ item }: { item: any }) => (
    <Card style={styles.campaignCard}>
      <View style={styles.campaignTop}>
        <Text style={styles.campaignName} numberOfLines={1}>
          {item.name || 'Untitled Campaign'}
        </Text>
        <View
          style={[
            styles.statusDot,
            { backgroundColor: statusColors[item.status] || '#6B7280' },
          ]}
        />
      </View>
      <Text style={styles.campaignStatus}>{item.status || 'DRAFT'}</Text>
      <View style={styles.campaignStats}>
        <Stat label="Total" value={item.totalRecipients || 0} />
        <Stat label="Sent" value={item.sent || 0} />
        <Stat label="Delivered" value={item.delivered || 0} />
        <Stat label="Failed" value={item.failed || 0} />
      </View>
      <Text style={styles.campaignDate}>
        {new Date(item.createdAt).toLocaleDateString()}
      </Text>
    </Card>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Campaigns</Text>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : campaigns.length === 0 ? (
        <EmptyState
          icon="megaphone-outline"
          title="No campaigns"
          message="Broadcast campaigns will appear here"
        />
      ) : (
        <FlatList
          data={campaigns}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={colors.primary}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* FAB — Tenant only */}
      {isTenant && (
        <TouchableOpacity
          style={[styles.fab, { bottom: insets.bottom + 100 }]}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('CampaignWizardStep1')}
        >
          <Ionicons name="add" size={28} color={colors.white} />
        </TouchableOpacity>
      )}
    </View>
  );
};

const Stat = ({ label, value }: { label: string; value: number }) => (
  <View style={styles.stat}>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  header: { paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
  headerTitle: { ...typography.h1, color: colors.darkGrey },
  list: { paddingHorizontal: spacing.xl, paddingBottom: spacing.huge },
  campaignCard: { marginBottom: spacing.md },
  campaignTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  campaignName: { ...typography.label, color: colors.darkGrey, flex: 1 },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginLeft: spacing.sm },
  campaignStatus: {
    ...typography.caption,
    color: colors.secondaryGrey,
    marginTop: 2,
  },
  campaignStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.lightGrey,
  },
  stat: { alignItems: 'center' },
  statValue: { ...typography.label, color: colors.darkGrey },
  statLabel: { ...typography.caption, color: colors.secondaryGrey, marginTop: 2 },
  campaignDate: {
    ...typography.caption,
    color: colors.secondaryGrey,
    marginTop: spacing.sm,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  fab: {
    position: 'absolute',
    right: spacing.xl,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
});