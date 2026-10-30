import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
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

type Props = NativeStackScreenProps<any, 'CampaignWizardStep2'>;

const useTags = () =>
  useQuery({
    queryKey: ['tags'],
    queryFn: async () => {
      const { data } = await api.get(ENDPOINTS.tags.getAll);
      return data.data || data.tags || [];
    },
    staleTime: 5 * 60 * 1000,
  });

export const CampaignWizardStep2: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { data: tags = [], isLoading: tagsLoading } = useTags();
  const { targetType, selectedTagIds, setTargetType, toggleTag } =
    useCampaignWizardStore();

  const canProceed = targetType === 'ALL' || selectedTagIds.length > 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.darkGrey} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Audience</Text>
        <View style={styles.stepBadge}>
          <Text style={styles.stepText}>2 / 4</Text>
        </View>
      </View>

      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: '50%' }]} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionTitle}>Who should receive this campaign?</Text>

        <TouchableOpacity onPress={() => setTargetType('ALL')} activeOpacity={0.7}>
          <Card style={[styles.optionCard, targetType === 'ALL' && styles.optionCardSelected]}>
            <View style={styles.optionRow}>
              <Ionicons
                name={targetType === 'ALL' ? 'radio-button-on' : 'radio-button-off'}
                size={22}
                color={targetType === 'ALL' ? colors.primary : colors.secondaryGrey}
              />
              <View style={styles.optionText}>
                <Text style={styles.optionTitle}>All Contacts</Text>
                <Text style={styles.optionDesc}>Send to every active contact</Text>
              </View>
            </View>
          </Card>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setTargetType('TAGS')} activeOpacity={0.7}>
          <Card style={[styles.optionCard, targetType === 'TAGS' && styles.optionCardSelected]}>
            <View style={styles.optionRow}>
              <Ionicons
                name={targetType === 'TAGS' ? 'radio-button-on' : 'radio-button-off'}
                size={22}
                color={targetType === 'TAGS' ? colors.primary : colors.secondaryGrey}
              />
              <View style={styles.optionText}>
                <Text style={styles.optionTitle}>By Tags</Text>
                <Text style={styles.optionDesc}>Target specific contact groups</Text>
              </View>
            </View>
          </Card>
        </TouchableOpacity>

        {targetType === 'TAGS' && (
          <View style={styles.tagsSection}>
            <Text style={styles.sectionTitle}>Select Tags</Text>
            {tagsLoading ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : tags.length === 0 ? (
              <Text style={styles.emptyText}>
                No tags found. Create tags in Contacts first.
              </Text>
            ) : (
              <View style={styles.tagsGrid}>
                {tags.map((tag: any) => {
                  const isSelected = selectedTagIds.includes(tag.id);
                  return (
                    <TouchableOpacity
                      key={tag.id}
                      onPress={() => toggleTag(tag.id)}
                      activeOpacity={0.7}
                      style={[styles.tagChip, isSelected && styles.tagChipSelected]}
                    >
                      {isSelected && (
                        <Ionicons name="checkmark" size={14} color={colors.white} />
                      )}
                      <Text
                        style={[
                          styles.tagChipText,
                          isSelected && styles.tagChipTextSelected,
                        ]}
                      >
                        {tag.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        )}

        <View style={styles.footer}>
          <Button
            title="Next: Schedule"
            onPress={() => navigation.navigate('CampaignWizardStep3')}
            disabled={!canProceed}
          />
        </View>
      </ScrollView>
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
  content: { flex: 1 },
  scrollContent: { paddingHorizontal: spacing.xl, paddingBottom: spacing.huge },
  sectionTitle: {
    ...typography.label,
    color: colors.darkGrey,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  optionCard: { marginBottom: spacing.sm },
  optionCardSelected: { borderWidth: 2, borderColor: colors.primary },
  optionRow: { flexDirection: 'row', alignItems: 'center' },
  optionText: { marginLeft: spacing.md, flex: 1 },
  optionTitle: { ...typography.label, color: colors.darkGrey },
  optionDesc: { ...typography.caption, color: colors.secondaryGrey, marginTop: 2 },
  tagsSection: { marginTop: spacing.md },
  tagsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.lightGrey,
    gap: 4,
  },
  tagChipSelected: { backgroundColor: colors.primary },
  tagChipText: { ...typography.caption, color: colors.darkGrey, fontWeight: '600' },
  tagChipTextSelected: { color: colors.white },
  emptyText: { ...typography.body, color: colors.secondaryGrey },
  footer: { marginTop: spacing.xl, paddingBottom: spacing.xl },
});