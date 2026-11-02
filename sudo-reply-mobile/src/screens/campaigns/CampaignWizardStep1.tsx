import React from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing, borderRadius } from '../../theme/spacing';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { useApprovedTemplates, getTemplateBodyInfo } from '../../hooks/useTemplates';
import { useCampaignWizardStore } from '../../stores/campaignWizardStore';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

type Props = NativeStackScreenProps<any, 'CampaignWizardStep1'>;

export const CampaignWizardStep1: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { data: templates = [], isLoading } = useApprovedTemplates();
  const {
    name,
    templateId,
    paramValues,
    paramCount,
    setName,
    setTemplate,
    setParamValue,
  } = useCampaignWizardStore();

  const handleSelectTemplate = (t: any) => {
    const { paramCount: count } = getTemplateBodyInfo(t);
    setTemplate(t.id, t.name, count);
  };

  const canProceed =
    name.trim().length > 0 &&
    templateId !== null &&
    (paramCount === 0 || paramValues.every((v) => v.trim().length > 0));

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.darkGrey} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Campaign</Text>
        <View style={styles.stepBadge}>
          <Text style={styles.stepText}>1 / 4</Text>
        </View>
      </View>

      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: '25%' }]} />
      </View>

      <FlatList
        data={templates}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <>
            <Text style={styles.sectionTitle}>Campaign Name</Text>
            <Input
              placeholder="e.g. Diwali Sale 2024"
              value={name}
              onChangeText={setName}
            />

            <Text style={[styles.sectionTitle, { marginTop: spacing.xl }]}>
              Select Template
            </Text>
            {isLoading && (
              <ActivityIndicator
                size="small"
                color={colors.primary}
                style={{ marginVertical: spacing.md }}
              />
            )}
            {!isLoading && templates.length === 0 && (
              <Text style={styles.emptyText}>No approved templates available.</Text>
            )}
          </>
        }
        renderItem={({ item }) => {
          const isSelected = templateId === item.id;
          const { bodyText, paramCount: pCount } = getTemplateBodyInfo(item);

          return (
            <TouchableOpacity onPress={() => handleSelectTemplate(item)} activeOpacity={0.7}>
              <Card style={[styles.templateCard, isSelected && styles.templateCardSelected]}>
                <View style={styles.templateTop}>
                  <Text style={styles.templateName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  {isSelected && (
                    <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
                  )}
                </View>
                <View style={styles.templateMeta}>
                  <Badge label={item.category} />
                  <Text style={styles.templateLang}>{item.language}</Text>
                </View>
                {bodyText ? (
                  <Text style={styles.templatePreview} numberOfLines={2}>
                    {bodyText}
                  </Text>
                ) : null}
                {pCount > 0 && (
                  <Text style={styles.paramHint}>
                    {pCount} variable{pCount > 1 ? 's' : ''} to fill
                  </Text>
                )}
              </Card>
            </TouchableOpacity>
          );
        }}
        ListFooterComponent={
          <>
            {paramCount > 0 && templateId && (
              <View style={styles.paramsSection}>
                <Text style={styles.sectionTitle}>Template Variables</Text>
                {Array.from({ length: paramCount }).map((_, i) => (
                  <View key={i} style={styles.paramRow}>
                    <Text style={styles.paramLabel}>{`{{${i + 1}}}`}</Text>
                    <View style={styles.paramInputWrap}>
                      <Input
                        placeholder={`Value for variable ${i + 1}`}
                        value={paramValues[i] || ''}
                        onChangeText={(v) => setParamValue(i, v)}
                      />
                    </View>
                  </View>
                ))}
              </View>
            )}

            <View style={styles.footer}>
              <Button
                title="Next: Audience"
                onPress={() => navigation.navigate('CampaignWizardStep2')}
                disabled={!canProceed}
              />
            </View>
          </>
        }
      />
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
  list: { paddingHorizontal: spacing.xl, paddingBottom: spacing.huge },
  sectionTitle: {
    ...typography.label,
    color: colors.darkGrey,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  templateCard: { marginBottom: spacing.sm },
  templateCardSelected: { borderWidth: 2, borderColor: colors.primary },
  templateTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  templateName: { ...typography.label, color: colors.darkGrey, flex: 1 },
  templateMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: spacing.sm },
  templateLang: { ...typography.caption, color: colors.secondaryGrey },
  templatePreview: { ...typography.body, color: colors.secondaryGrey, marginTop: 6 },
  paramHint: { ...typography.caption, color: colors.primary, marginTop: 4, fontWeight: '600' },
  paramsSection: { marginTop: spacing.md },
  paramRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  paramLabel: { ...typography.label, color: colors.primary, width: 44 },
  paramInputWrap: { flex: 1 },
  emptyText: { ...typography.body, color: colors.secondaryGrey, marginTop: spacing.sm },
  footer: { marginTop: spacing.xl, paddingBottom: spacing.xl },
});