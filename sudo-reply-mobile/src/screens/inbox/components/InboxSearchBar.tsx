import React from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../../theme/colors';
import { spacing } from '../../../theme/spacing';

interface Props {
  value: string;
  onChange: (v: string) => void;
  onFilterPress: () => void;
  filterActive: boolean;
}

export const InboxSearchBar: React.FC<Props> = ({
  value,
  onChange,
  onFilterPress,
  filterActive,
}) => (
  <View style={styles.row}>
    <View style={styles.inputWrap}>
      <Ionicons name="search-outline" size={18} color={colors.secondaryGrey} style={styles.icon} />
      <TextInput
        style={styles.input}
        placeholder="Search by name or number"
        placeholderTextColor={colors.secondaryGrey}
        value={value}
        onChangeText={onChange}
        returnKeyType="search"
        autoCorrect={false}
      />
      {value.length > 0 && (
        <TouchableOpacity onPress={() => onChange('')} hitSlop={8} style={styles.clear}>
          <Ionicons name="close-circle" size={18} color={colors.secondaryGrey} />
        </TouchableOpacity>
      )}
    </View>

    <TouchableOpacity
      style={[styles.filterBtn, filterActive && styles.filterBtnActive]}
      activeOpacity={0.7}
      onPress={onFilterPress}
    >
      <Ionicons
        name="options-outline"
        size={22}
        color={filterActive ? colors.white : colors.secondaryGrey}
      />
    </TouchableOpacity>
  </View>
);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    gap: 10,
  },
  inputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    backgroundColor: colors.lightGrey,
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  icon: { marginRight: 8 },
  input: {
    flex: 1,
    fontSize: 14,
    color: colors.darkGrey,
    padding: 0,
    height: 44,
  },
  clear: { marginLeft: 4 },
  filterBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: colors.lightGrey,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBtnActive: { backgroundColor: colors.primary },
});