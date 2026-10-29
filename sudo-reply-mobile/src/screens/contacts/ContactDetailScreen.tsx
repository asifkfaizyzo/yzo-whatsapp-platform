import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing, borderRadius } from '../../theme/spacing';
import { Avatar } from '../../components/ui/Avatar';
import { Card } from '../../components/ui/Card';
import { useContact, useBlockContact, useDeleteContact } from '../../hooks/useContacts';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

type Props = NativeStackScreenProps<any, 'ContactDetail'>;

export const ContactDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const insets = useSafeAreaInsets();
  const { id } = route.params as { id: string };
  const { data: contact, isLoading } = useContact(id);
  const blockMutation = useBlockContact();
  const deleteMutation = useDeleteContact();

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!contact) {
    return (
      <View style={styles.center}>
        <Text style={typography.body}>Contact not found</Text>
      </View>
    );
  }

  const handleBlock = () => {
    const action = contact.isBlocked ? 'Unblock' : 'Block';
    Alert.alert(`${action} Contact`, `${action} "${contact.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: action,
        style: contact.isBlocked ? 'default' : 'destructive',
        onPress: () => blockMutation.mutate({ id, block: !contact.isBlocked }),
      },
    ]);
  };

  const handleDelete = () => {
    Alert.alert('Delete Contact', `Permanently remove "${contact.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteMutation.mutate(id);
          navigation.goBack();
        },
      },
    ]);
  };

  const handleMessage = () => {
    if (contact.isBlocked) {
      Alert.alert('Blocked Contact', 'Unblock this contact before messaging.');
      return;
    }
    // Navigate to Chat with no conversationId (ChatScreen handles the "new conversation" case)
    navigation.navigate('Inbox', {
      screen: 'Chat',
      params: {
        conversationId: null,
        contactId: contact.id,
        contactName: contact.name || contact.phone || 'Unknown',
      },
    });
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.darkGrey} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Contact</Text>
        <TouchableOpacity onPress={() => navigation.navigate('ContactForm', { id })}>
          <Ionicons name="create-outline" size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Profile */}
        <View style={styles.profileSection}>
          <Avatar name={contact.name} size={80} />
          <Text style={styles.name}>{contact.name || 'Unknown'}</Text>
          <Text style={styles.phone}>{contact.phone}</Text>

          {/* Primary Message CTA */}
          <TouchableOpacity
            style={[
              styles.messageCta,
              contact.isBlocked && styles.messageCtaDisabled,
            ]}
            onPress={handleMessage}
            activeOpacity={0.8}
          >
            <Ionicons name="chatbubble" size={18} color={colors.white} />
            <Text style={styles.messageCtaText}>Message</Text>
          </TouchableOpacity>
        </View>

        {/* Info Card */}
        <Card style={styles.card}>
          <InfoRow icon="mail-outline" label="Email" value={contact.email || '—'} />
          <InfoRow
            icon="time-outline"
            label="Added"
            value={new Date(contact.createdAt).toLocaleDateString()}
          />
          <InfoRow
            icon="shield-outline"
            label="Status"
            value={contact.isBlocked ? 'Blocked' : 'Active'}
            valueColor={contact.isBlocked ? '#DC2626' : '#16A34A'}
          />
        </Card>

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionButton} onPress={handleBlock}>
            <Ionicons
              name={contact.isBlocked ? 'lock-open-outline' : 'ban-outline'}
              size={20}
              color={contact.isBlocked ? '#16A34A' : '#DC2626'}
            />
            <Text
              style={[
                styles.actionText,
                { color: contact.isBlocked ? '#16A34A' : '#DC2626' },
              ]}
            >
              {contact.isBlocked ? 'Unblock' : 'Block'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton} onPress={handleDelete}>
            <Ionicons name="trash-outline" size={20} color="#DC2626" />
            <Text style={[styles.actionText, { color: '#DC2626' }]}>Delete</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

const InfoRow = ({
  icon,
  label,
  value,
  valueColor,
}: {
  icon: string;
  label: string;
  value: string;
  valueColor?: string;
}) => (
  <View style={styles.infoRow}>
    <Ionicons name={icon as any} size={18} color={colors.secondaryGrey} />
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={[styles.infoValue, valueColor ? { color: valueColor } : undefined]}>
      {value}
    </Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  headerTitle: { ...typography.h2, color: colors.darkGrey },
  content: { paddingHorizontal: spacing.xl, paddingBottom: spacing.huge },
  profileSection: { alignItems: 'center', paddingVertical: spacing.xxl },
  name: { ...typography.h1, color: colors.darkGrey, marginTop: spacing.md },
  phone: { ...typography.body, color: colors.secondaryGrey, marginTop: spacing.xs },

  // ── Primary Message CTA ──
  messageCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    marginTop: spacing.lg,
    minWidth: 140,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  messageCtaDisabled: {
    backgroundColor: '#A6A6A6',
    shadowOpacity: 0,
    elevation: 0,
  },
  messageCtaText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '700',
  },

  card: { marginBottom: spacing.xl },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  infoLabel: {
    ...typography.bodySmall,
    color: colors.secondaryGrey,
    marginLeft: spacing.sm,
    width: 60,
  },
  infoValue: { ...typography.label, color: colors.darkGrey, flex: 1, textAlign: 'right' },
  actions: { flexDirection: 'row', gap: spacing.md },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.lightGrey,
  },
  actionText: { ...typography.label },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});