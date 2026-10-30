import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing, borderRadius } from '../../theme/spacing';
import { Avatar } from '../../components/ui/Avatar';
import { SearchBar } from '../../components/ui/SearchBar';
import { usePhoneContacts, type PhoneContact } from '../../hooks/usePhoneContacts';
import { useImportPhoneContacts } from '../../hooks/useContacts';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

type Props = NativeStackScreenProps<any, 'ImportPhoneContacts'>;

export const ImportPhoneContactsScreen: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { contacts, loading, permissionGranted, requestAndFetch } = usePhoneContacts();
  const importMutation = useImportPhoneContacts();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [selectAll, setSelectAll] = useState(false);

  useEffect(() => {
    requestAndFetch();
  }, []);

  const filtered = contacts.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search),
  );

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectAll) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((c) => c.id)));
    }
    setSelectAll(!selectAll);
  };

  const handleImport = () => {
    if (selected.size === 0) {
      Alert.alert('No Selection', 'Select at least one contact to import.');
      return;
    }

    const payload = Array.from(selected).map((id) => {
      const c = contacts.find((x) => x.id === id)!;
      return { name: c.name, phone: c.phone, email: c.email };
    });

    Alert.alert(
      'Import Contacts',
      `Import ${payload.length} contact(s)?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Import',
          onPress: () => {
            importMutation.mutate(payload, {
              onSuccess: (data: any) => {
                const msg = data?.message || data?.data?.message || 'Import complete';
                Alert.alert('Success', msg, [
                  { text: 'OK', onPress: () => navigation.goBack() },
                ]);
              },
              onError: (err: any) => {
                Alert.alert(
                  'Error',
                  err?.response?.data?.message || err.message || 'Import failed',
                );
              },
            });
          },
        },
      ],
    );
  };

  const renderItem = ({ item }: { item: PhoneContact }) => {
    const isSelected = selected.has(item.id);
    return (
      <TouchableOpacity
        style={styles.row}
        activeOpacity={0.6}
        onPress={() => toggleOne(item.id)}
      >
        <View style={styles.checkbox}>
          {isSelected ? (
            <Ionicons name="checkbox" size={24} color={colors.primary} />
          ) : (
            <Ionicons name="square-outline" size={24} color={colors.secondaryGrey} />
          )}
        </View>
        <Avatar name={item.name} size={38} />
        <View style={styles.contactInfo}>
          <Text style={styles.contactName} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.contactPhone} numberOfLines={1}>
            +{item.phone}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  // Permission denied state
  if (permissionGranted === false) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={colors.darkGrey} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Import Contacts</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.center}>
          <Ionicons name="lock-closed-outline" size={56} color={colors.secondaryGrey} />
          <Text style={styles.permissionText}>
            Contacts permission is required to import from your phone.
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={requestAndFetch}>
            <Text style={styles.retryText}>Grant Permission</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.darkGrey} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Import Contacts</Text>
        {selected.size > 0 ? (
          <TouchableOpacity
            style={[styles.importButton, importMutation.isPending && { opacity: 0.5 }]}
            onPress={handleImport}
            disabled={importMutation.isPending}
          >
            {importMutation.isPending ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Text style={styles.importButtonText}>
                Import ({selected.size})
              </Text>
            )}
          </TouchableOpacity>
        ) : (
          <View style={{ width: 80 }} />
        )}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Reading phone contacts...</Text>
        </View>
      ) : (
        <>
          {/* Search + Select All */}
          <View style={styles.toolbar}>
            <View style={{ flex: 1 }}>
              <SearchBar
                placeholder="Search contacts..."
                value={search}
                onChangeText={setSearch}
              />
            </View>
            <TouchableOpacity style={styles.selectAllBtn} onPress={toggleAll}>
              <Text style={styles.selectAllText}>
                {selectAll ? 'Deselect' : 'Select All'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Count */}
          <Text style={styles.countText}>
            {filtered.length} contact{filtered.length !== 1 ? 's' : ''} found
          </Text>

          {/* List */}
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.center}>
                <Text style={typography.body}>No contacts match your search</Text>
              </View>
            }
          />
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.lightGrey,
  },
  headerTitle: { ...typography.h2, color: colors.darkGrey },
  importButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: borderRadius.md,
  },
  importButtonText: { ...typography.label, color: colors.white, fontSize: 13 },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  selectAllBtn: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  selectAllText: { ...typography.caption, color: colors.primary, fontWeight: '600' },
  countText: {
    ...typography.caption,
    color: colors.secondaryGrey,
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.xs,
  },
  list: { paddingHorizontal: spacing.xl, paddingBottom: spacing.huge },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.lightGrey,
  },
  checkbox: { marginRight: spacing.sm, width: 28 },
  contactInfo: { flex: 1, marginLeft: spacing.sm },
  contactName: { ...typography.label, color: colors.darkGrey },
  contactPhone: { ...typography.bodySmall, color: colors.secondaryGrey, marginTop: 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xxl },
  loadingText: { ...typography.body, color: colors.secondaryGrey, marginTop: spacing.md },
  permissionText: {
    ...typography.body,
    color: colors.secondaryGrey,
    textAlign: 'center',
    marginTop: spacing.lg,
    lineHeight: 22,
  },
  retryButton: {
    marginTop: spacing.xl,
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: borderRadius.md,
  },
  retryText: { ...typography.label, color: colors.white },
});