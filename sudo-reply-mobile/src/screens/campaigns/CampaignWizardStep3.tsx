import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing, borderRadius } from '../../theme/spacing';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useCampaignWizardStore } from '../../stores/campaignWizardStore';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

type Props = NativeStackScreenProps<any, 'CampaignWizardStep3'>;

export const CampaignWizardStep3: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { sendMode, scheduledAt, setSendMode, setScheduledAt } =
    useCampaignWizardStore();
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const minDate = new Date(Date.now() + 60 * 1000);

  const onDateChange = (_: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (date) {
      const current = scheduledAt || new Date();
      const merged = new Date(date);
      merged.setHours(current.getHours(), current.getMinutes());
      if (merged.getTime() < Date.now()) merged.setDate(merged.getDate() + 1);
      setScheduledAt(merged);
    }
  };

  const onTimeChange = (_: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') setShowTimePicker(false);
    if (date) {
      const current = scheduledAt || new Date();
      const merged = new Date(current);
      merged.setHours(date.getHours(), date.getMinutes());
      if (merged.getTime() < Date.now()) merged.setDate(merged.getDate() + 1);
      setScheduledAt(merged);
    }
  };

  const canProceed =
    sendMode === 'now' || (sendMode === 'scheduled' && scheduledAt !== null);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.darkGrey} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Schedule</Text>
        <View style={styles.stepBadge}>
          <Text style={styles.stepText}>3 / 4</Text>
        </View>
      </View>

      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: '75%' }]} />
      </View>

      <View style={styles.content}>
        <Text style={styles.sectionTitle}>When should this campaign be sent?</Text>

        <TouchableOpacity onPress={() => setSendMode('now')} activeOpacity={0.7}>
          <Card style={[styles.optionCard, sendMode === 'now' && styles.optionCardSelected]}>
            <View style={styles.optionRow}>
              <Ionicons
                name={sendMode === 'now' ? 'radio-button-on' : 'radio-button-off'}
                size={22}
                color={sendMode === 'now' ? colors.primary : colors.secondaryGrey}
              />
              <View style={styles.optionText}>
                <Text style={styles.optionTitle}>Send Immediately</Text>
                <Text style={styles.optionDesc}>Launch as soon as you confirm</Text>
              </View>
            </View>
          </Card>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setSendMode('scheduled')} activeOpacity={0.7}>
          <Card
            style={[styles.optionCard, sendMode === 'scheduled' && styles.optionCardSelected]}
          >
            <View style={styles.optionRow}>
              <Ionicons
                name={sendMode === 'scheduled' ? 'radio-button-on' : 'radio-button-off'}
                size={22}
                color={sendMode === 'scheduled' ? colors.primary : colors.secondaryGrey}
              />
              <View style={styles.optionText}>
                <Text style={styles.optionTitle}>Schedule for Later</Text>
                <Text style={styles.optionDesc}>Pick a date and time</Text>
              </View>
            </View>
          </Card>
        </TouchableOpacity>

        {sendMode === 'scheduled' && (
          <View style={styles.scheduleSection}>
            <TouchableOpacity
              style={styles.pickerButton}
              onPress={() => setShowDatePicker(true)}
            >
              <Ionicons name="calendar-outline" size={20} color={colors.primary} />
              <Text style={styles.pickerLabel}>
                {scheduledAt
                  ? scheduledAt.toLocaleDateString('en-IN', { dateStyle: 'medium' })
                  : 'Select Date'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.pickerButton}
              onPress={() => setShowTimePicker(true)}
            >
              <Ionicons name="time-outline" size={20} color={colors.primary} />
              <Text style={styles.pickerLabel}>
                {scheduledAt
                  ? scheduledAt.toLocaleTimeString('en-IN', { timeStyle: 'short' })
                  : 'Select Time'}
              </Text>
            </TouchableOpacity>

            {scheduledAt && (
              <Text style={styles.scheduledPreview}>
                Will send: {scheduledAt.toLocaleString('en-IN', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </Text>
            )}

            {showDatePicker && (
              <DateTimePicker
                value={scheduledAt || minDate}
                mode="date"
                minimumDate={minDate}
                onChange={onDateChange}
              />
            )}
            {showTimePicker && (
              <DateTimePicker
                value={scheduledAt || new Date()}
                mode="time"
                onChange={onTimeChange}
              />
            )}
          </View>
        )}

        <View style={styles.footer}>
          <Button
            title="Next: Review"
            onPress={() => navigation.navigate('CampaignWizardStep4')}
            disabled={!canProceed}
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
  optionCard: { marginBottom: spacing.sm },
  optionCardSelected: { borderWidth: 2, borderColor: colors.primary },
  optionRow: { flexDirection: 'row', alignItems: 'center' },
  optionText: { marginLeft: spacing.md, flex: 1 },
  optionTitle: { ...typography.label, color: colors.darkGrey },
  optionDesc: { ...typography.caption, color: colors.secondaryGrey, marginTop: 2 },
  scheduleSection: { marginTop: spacing.lg },
  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.lightGrey,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  pickerLabel: { ...typography.body, color: colors.darkGrey },
  scheduledPreview: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
    marginTop: spacing.sm,
  },
  footer: { marginTop: 'auto', paddingBottom: spacing.xl },
});