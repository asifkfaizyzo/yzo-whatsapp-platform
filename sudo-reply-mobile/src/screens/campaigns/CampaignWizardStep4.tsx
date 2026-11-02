import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing, borderRadius } from '../../theme/spacing';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { ENDPOINTS } from '../../config/api';
import api from '../../services/api';
import { useCampaignWizardStore } from '../../stores/campaignWizardStore';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

type Props = NativeStackScreenProps<any, 'CampaignWizardStep4'>;

export const CampaignWizardStep4: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const wizard = useCampaignWizardStore();

  const launchMutation = useMutation({
    mutationFn: async () => {
      const body: any = {
        name: wizard.name.trim(),
        templateId: wizard.templateId,
        targetType: wizard.targetType,
      };

      if (wizard.targetType === 'TAGS') {
        body.tagIds = wizard.selectedTagIds;
      }

      if (wizard.paramCount > 0) {
        body.defaultParams = { body: wizard.paramValues };
      }

      if (wizard.sendMode === 'scheduled' && wizard.scheduledAt) {
        body.scheduledAt = wizard.scheduledAt.toISOString();
      }

      const { data } = await api.post(ENDPOINTS.broadcasts.create, body);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      wizard.reset();
      Alert.alert(
        'Campaign Launched!',
        data.message || 'Your broadcast campaign has been queued.',
        [{ text: 'OK', onPress: () => navigation.popToTop() }]
      );
    },
    onError: (error: any) => {
      const msg =
        error?.response?.data?.message || error?.message || 'Failed to launch campaign.';
      Alert.alert('Launch Failed', msg);
    },
  });

  const handleLaunch = () => {
    Alert.alert(
      'Confirm Launch',
      `Send "${wizard.name}" to ${
        wizard.targetType === 'ALL'
          ? 'all contacts'
          : `${wizard.selectedTagIds.length} tag group(s)`
      }?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Launch', onPress: () => launchMutation.mutate() },
      ]
    );
  };

  const SummaryRow = ({
    icon,
    label,
    value,
  }: {
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    value: string;
  }) => (
    <View style={styles.summaryRow}>
      <Ionicons name={icon} size={18} color={colors.primary} />
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.darkGrey} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Review</Text>
        <View style={styles.stepBadge}>
          <Text style={styles.stepText}>4 / 4</Text>
        </View>
      </View>

      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: '100%' }]} />
      </View>

      <View style={styles.content}>
        <Text style={styles.sectionTitle}>Campaign Summary</Text>

        <Card style={styles.summaryCard}>
          <SummaryRow icon="pricetag-outline" label="Name" value={wizard.name} />
          <View style={styles.divider} />
          <SummaryRow
            icon="document-text-outline"
            label="Template"
            value={wizard.templateName}
          />
          <View style={styles.divider} />
          <SummaryRow
            icon="people-outline"
            label="Audience"
            value={
              wizard.targetType === 'ALL'
                ? 'All Contacts'
                : `${wizard.selectedTagIds.length} tag(s) selected`
            }
          />
          <View style={styles.divider} />
          <SummaryRow
            icon="time-outline"
            label="Schedule"
            value={
              wizard.sendMode === 'now'
                ? 'Immediately'
                : wizard.scheduledAt?.toLocaleString('en-IN', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  }) || 'Scheduled'
            }
          />
          {wizard.paramCount > 0 && (
            <>
              <View style={styles.divider} />
              <SummaryRow
                icon="code-slash-outline"
                label="Variables"
                value={wizard.paramValues
                  .map((v, i) => `{{${i + 1}}}=${v}`)
                  .join(', ')}
              />
            </>
          )}
        </Card>

        <View style={styles.footer}>
          <Button
            title={launchMutation.isPending ? 'Launching...' : 'Launch Campaign'}
            onPress={handleLaunch}
            disabled={launchMutation.isPending}
          />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  backBtn: { marginRight: spacing.md },
  headerTitle: { ...typography.h2, color: colors.darkGrey, flex: 1 },
  stepBadge: {
    backgroundColor: colors.lightGrey,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
  },
  stepText: { ...typography.caption, color: colors.secondaryGrey, fontWeight: '700' },
  progressBar: { height: 3, backgroundColor: colors.lightGrey, marginHorizontal: spacing.xl },
  progressFill: { height: 3, backgroundColor: colors.primary, borderRadius: 2 },
  content: { flex: 1, paddingHorizontal: spacing.xl },
  sectionTitle: {
    ...typography.label,
    color: colors.darkGrey,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  summaryCard: { marginTop: spacing.sm },
  summaryRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm },
  summaryLabel: {
    ...typography.caption,
    color: colors.secondaryGrey,
    width: 80,
    marginLeft: spacing.sm,
  },
  summaryValue: { ...typography.body, color: colors.darkGrey, flex: 1, fontWeight: '600' },
  divider: { height: 1, backgroundColor: colors.lightGrey },
  footer: { marginTop: 'auto', paddingBottom: spacing.xl },
});