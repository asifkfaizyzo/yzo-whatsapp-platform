import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing, borderRadius } from '../../theme/spacing';
import { SearchBar } from '../../components/ui/SearchBar';
import { Avatar } from '../../components/ui/Avatar';
import { EmptyState } from '../../components/ui/EmptyState';
import { useContacts, useDeleteContact } from '../../hooks/useContacts';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

type Props = NativeStackScreenProps<any, 'ContactsList'>;

export const ContactsListScreen: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState('');
  const { data: contacts = [], isLoading, refetch, isRefetching } = useContacts(search);
  const deleteMutation = useDeleteContact();

  const handleDelete = (id: string, name: string) => {
    Alert.alert('Delete Contact', `Remove "${name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteMutation.mutate(id),
      },
    ]);
  };

  const renderItem = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.contactCard}
      activeOpacity={0.7}
      onPress={() => navigation.navigate('ContactDetail', { id: item.id })}
      onLongPress={() => handleDelete(item.id, item.name)}
    >
      <Avatar name={item.name} size={44} />
      <View style={styles.contactInfo}>
        <Text style={styles.contactName} numberOfLines={1}>
          {item.name || 'Unknown'}
        </Text>
        <Text style={styles.contactPhone} numberOfLines={1}>
          {item.phone}
        </Text>
      </View>
      <View style={styles.contactMeta}>
        {item.isBlocked && (
          <View style={styles.blockedBadge}>
            <Text style={styles.blockedText}>Blocked</Text>
          </View>
        )}
        <Ionicons name="chevron-forward" size={18} color={colors.secondaryGrey} />
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Contacts</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity
            style={styles.importButton}
            onPress={() => navigation.navigate('ImportPhoneContacts')}
          >
            <Ionicons name="phone-portrait-outline" size={20} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => navigation.navigate('ContactForm')}
          >
            <Ionicons name="add" size={24} color={colors.white} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <SearchBar
          placeholder="Search contacts..."
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* List */}
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : contacts.length === 0 ? (
        <EmptyState
          icon="people-outline"
          title="No contacts yet"
          message="Add your first contact to get started"
        />
      ) : (
        <FlatList
          data={contacts}
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
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  headerTitle: { ...typography.h1, color: colors.darkGrey },
  importButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchContainer: { paddingHorizontal: spacing.xl, marginBottom: spacing.sm },
  list: { paddingHorizontal: spacing.xl, paddingBottom: spacing.huge },
  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.lightGrey,
  },
  contactInfo: { flex: 1, marginLeft: spacing.md },
  contactName: { ...typography.label, color: colors.darkGrey },
  contactPhone: { ...typography.bodySmall, color: colors.secondaryGrey, marginTop: 2 },
  contactMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  blockedBadge: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  blockedText: { fontSize: 10, color: '#DC2626', fontWeight: '600' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});