import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing, borderRadius } from '../../theme/spacing';
import { Card } from '../../components/ui/Card';
import {
  useContact,
  useCreateContact,
  useUpdateContact,
  type ContactFormData,
} from '../../hooks/useContacts';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

type Props = NativeStackScreenProps<any, 'ContactForm'>;

export const ContactFormScreen: React.FC<Props> = ({ route, navigation }) => {
  const insets = useSafeAreaInsets();
  const editId = (route.params as any)?.id || null;
  const isEdit = !!editId;

  const { data: existingContact, isLoading: loadingContact } = useContact(editId || '');
  const createMutation = useCreateContact();
  const updateMutation = useUpdateContact();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [countryCode, setCountryCode] = useState('+91');

  // Pre-fill form when editing
  useEffect(() => {
    if (isEdit && existingContact) {
      setName(existingContact.name || '');
      setPhone(existingContact.phone || '');
      setEmail(existingContact.email || '');
      setCompany(existingContact.company || '');
      setCountryCode(existingContact.countryCode || '+91');
    }
  }, [isEdit, existingContact]);

  const isSaving = createMutation.isPending || updateMutation.isPending;

  const validate = (): boolean => {
    if (!name.trim()) {
      Alert.alert('Validation', 'Name is required');
      return false;
    }
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 8) {
      Alert.alert('Validation', 'Enter a valid phone number (min 8 digits)');
      return false;
    }
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      Alert.alert('Validation', 'Enter a valid email address');
      return false;
    }
    return true;
  };

  const handleSave = () => {
    if (!validate()) return;

    const payload: ContactFormData = {
      name: name.trim(),
      phone: phone.replace(/\D/g, ''),
      email: email.trim() || undefined,
      company: company.trim() || undefined,
      countryCode,
    };

    if (isEdit) {
      updateMutation.mutate(
        { id: editId, ...payload },
        {
          onSuccess: () => {
            Alert.alert('Success', 'Contact updated', [
              { text: 'OK', onPress: () => navigation.goBack() },
            ]);
          },
          onError: (err: any) => {
            Alert.alert('Error', err?.response?.data?.message || err.message || 'Failed to update');
          },
        },
      );
    } else {
      createMutation.mutate(payload, {
        onSuccess: () => {
          Alert.alert('Success', 'Contact created', [
            { text: 'OK', onPress: () => navigation.goBack() },
          ]);
        },
        onError: (err: any) => {
          Alert.alert('Error', err?.response?.data?.message || err.message || 'Failed to create');
        },
      });
    }
  };

  if (isEdit && loadingContact) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={24} color={colors.darkGrey} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isEdit ? 'Edit Contact' : 'New Contact'}</Text>
        <TouchableOpacity
          onPress={handleSave}
          disabled={isSaving}
          style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <Text style={styles.saveButtonText}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Avatar Preview */}
        <View style={styles.avatarPreview}>
          <View style={[styles.avatarCircle, { backgroundColor: colors.primary }]}>
            <Text style={styles.avatarText}>
              {name.trim() ? name.trim().substring(0, 2).toUpperCase() : '?'}
            </Text>
          </View>
        </View>

        <Card style={styles.formCard}>
          {/* Name */}
          <View style={styles.field}>
            <Text style={styles.label}>Full Name *</Text>
            <View style={styles.inputRow}>
              <Ionicons name="person-outline" size={20} color={colors.secondaryGrey} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="e.g. Rahul Sharma"
                placeholderTextColor={colors.secondaryGrey}
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                returnKeyType="next"
              />
            </View>
          </View>

          {/* Phone */}
          <View style={styles.field}>
            <Text style={styles.label}>Phone Number *</Text>
            <View style={styles.inputRow}>
              <Ionicons name="call-outline" size={20} color={colors.secondaryGrey} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { flex: 0, width: 55 }]}
                value={countryCode}
                onChangeText={setCountryCode}
                keyboardType="phone-pad"
                maxLength={4}
              />
              <View style={styles.phoneDivider} />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="9876543210"
                placeholderTextColor={colors.secondaryGrey}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                maxLength={15}
              />
            </View>
          </View>

          {/* Email */}
          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <View style={styles.inputRow}>
              <Ionicons name="mail-outline" size={20} color={colors.secondaryGrey} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="rahul@example.com"
                placeholderTextColor={colors.secondaryGrey}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                returnKeyType="next"
              />
            </View>
          </View>

          {/* Company */}
          <View style={styles.field}>
            <Text style={styles.label}>Company</Text>
            <View style={styles.inputRow}>
              <Ionicons name="business-outline" size={20} color={colors.secondaryGrey} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="e.g. TCS, Infosys"
                placeholderTextColor={colors.secondaryGrey}
                value={company}
                onChangeText={setCompany}
                autoCapitalize="words"
                returnKeyType="done"
              />
            </View>
          </View>
        </Card>

        {isEdit && existingContact && (
          <View style={styles.metaInfo}>
            <Text style={styles.metaText}>
              Added {new Date(existingContact.createdAt).toLocaleDateString('en-IN')}
            </Text>
            {existingContact.assignedTo && (
              <Text style={styles.metaText}>Assigned to an agent</Text>
            )}
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.lightGrey,
  },
  headerTitle: { ...typography.h2, color: colors.darkGrey },
  saveButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: borderRadius.md,
  },
  saveButtonDisabled: { opacity: 0.5 },
  saveButtonText: { ...typography.label, color: colors.white },
  content: { paddingHorizontal: spacing.xl, paddingVertical: spacing.xl },
  avatarPreview: { alignItems: 'center', marginBottom: spacing.xl },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 28, fontWeight: '700', color: colors.white },
  formCard: { padding: spacing.lg },
  field: { marginBottom: spacing.lg },
  label: {
    ...typography.caption,
    color: colors.secondaryGrey,
    marginBottom: spacing.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.lightGrey,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    height: 48,
  },
  inputIcon: { marginRight: spacing.sm },
  input: {
    flex: 1,
    ...typography.body,
    color: colors.darkGrey,
    height: 48,
  },
  phoneDivider: {
    width: 1,
    height: 24,
    backgroundColor: colors.secondaryGrey,
    marginHorizontal: spacing.sm,
    opacity: 0.3,
  },
  metaInfo: {
    alignItems: 'center',
    marginTop: spacing.xl,
    gap: 4,
  },
  metaText: { ...typography.caption, color: colors.secondaryGrey },
});