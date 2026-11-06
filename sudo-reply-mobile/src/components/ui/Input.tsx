// sudo-reply-mobile/src/components/ui/Input.tsx (do not remove this comment)
import React, { useState } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInputProps,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { borderRadius, spacing } from '../../theme/spacing';

interface InputProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  error?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  isPassword?: boolean;
  containerStyle?: ViewStyle;
  compact?: boolean;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  icon,
  isPassword = false,
  containerStyle,
  compact = false,
  ...props
}) => {
  const [secure, setSecure] = useState(isPassword);
  const [focused, setFocused] = useState(false);

  const borderColor = error
    ? colors.error
    : focused
    ? colors.primary
    : colors.border;

  return (
    <View style={[compact ? styles.containerCompact : styles.container, containerStyle]}>
      {label && (
        <Text style={compact ? styles.labelCompact : styles.label}>
          {label}
        </Text>
      )}
      <View
        style={[
          compact ? styles.inputWrapperCompact : styles.inputWrapper,
          { borderColor },
        ]}
      >
        {icon && (
          <Ionicons
            name={icon}
            size={compact ? 18 : 20}
            color={focused ? colors.primary : colors.secondaryGrey}
            style={compact ? styles.iconCompact : styles.icon}
          />
        )}
        <TextInput
          style={compact ? styles.inputCompact : styles.input}
          placeholderTextColor={colors.secondaryGrey}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          secureTextEntry={secure}
          {...props}
        />
        {isPassword && (
          <TouchableOpacity
            onPress={() => setSecure(!secure)}
            hitSlop={8}
          >
            <Ionicons
              name={secure ? 'eye-off-outline' : 'eye-outline'}
              size={compact ? 18 : 20}
              color={colors.secondaryGrey}
            />
          </TouchableOpacity>
        )}
      </View>
      {error && (
        <Text style={compact ? styles.errorCompact : styles.error}>
          {error}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  /* ── Default ── */
  container: {
    marginBottom: spacing.base,
  },
  label: {
    ...typography.label,
    color: colors.darkGrey,
    marginBottom: spacing.xs,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: borderRadius.md,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    height: 50,
  },
  icon: {
    marginRight: spacing.sm,
  },
  input: {
    flex: 1,
    ...typography.body,
    color: colors.darkGrey,
    height: '100%',
  },
  error: {
    ...typography.bodySmall,
    color: colors.error,
    marginTop: spacing.xs,
  },

  /* ── Compact (scaled up from previous iteration) ── */
  containerCompact: {
    marginBottom: 16,
  },
  labelCompact: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 5,
  },
  inputWrapperCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: colors.white,
    paddingHorizontal: 12,
    height: 46,
  },
  iconCompact: {
    marginRight: 8,
  },
  inputCompact: {
    flex: 1,
    fontSize: 13.5,
    color: colors.darkGrey,
    height: '100%',
    padding: 0,
  },
  errorCompact: {
    fontSize: 11,
    color: colors.error,
    marginTop: 3,
  },
});

// // sudo-reply-mobile/src/components/ui/Input.tsx (do not remove this comment)
// import React, { useState } from 'react';
// import {
//   View,
//   TextInput,
//   Text,
//   StyleSheet,
//   TouchableOpacity,
//   TextInputProps,
//   ViewStyle,
// } from 'react-native';
// import { Ionicons } from '@expo/vector-icons';
// import { colors } from '../../theme/colors';
// import { typography } from '../../theme/typography';
// import { borderRadius, spacing } from '../../theme/spacing';

// interface InputProps extends Omit<TextInputProps, 'style'> {
//   label?: string;
//   error?: string;
//   icon?: keyof typeof Ionicons.glyphMap;
//   isPassword?: boolean;
//   containerStyle?: ViewStyle;
// }

// export const Input: React.FC<InputProps> = ({
//   label,
//   error,
//   icon,
//   isPassword = false,
//   containerStyle,
//   ...props
// }) => {
//   const [secure, setSecure] = useState(isPassword);
//   const [focused, setFocused] = useState(false);

//   const borderColor = error
//     ? colors.error
//     : focused
//     ? colors.primary
//     : colors.border;

//   return (
//     <View style={[styles.container, containerStyle]}>
//       {label && <Text style={styles.label}>{label}</Text>}
//       <View
//         style={[
//           styles.inputWrapper,
//           { borderColor },
//         ]}
//       >
//         {icon && (
//           <Ionicons
//             name={icon}
//             size={20}
//             color={focused ? colors.primary : colors.secondaryGrey}
//             style={styles.icon}
//           />
//         )}
//         <TextInput
//           style={styles.input}
//           placeholderTextColor={colors.secondaryGrey}
//           onFocus={() => setFocused(true)}
//           onBlur={() => setFocused(false)}
//           secureTextEntry={secure}
//           {...props}
//         />
//         {isPassword && (
//           <TouchableOpacity
//             onPress={() => setSecure(!secure)}
//             hitSlop={8}
//           >
//             <Ionicons
//               name={secure ? 'eye-off-outline' : 'eye-outline'}
//               size={20}
//               color={colors.secondaryGrey}
//             />
//           </TouchableOpacity>
//         )}
//       </View>
//       {error && <Text style={styles.error}>{error}</Text>}
//     </View>
//   );
// };

// const styles = StyleSheet.create({
//   container: {
//     marginBottom: spacing.base,
//   },
//   label: {
//     ...typography.label,
//     color: colors.darkGrey,
//     marginBottom: spacing.xs,
//   },
//   inputWrapper: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     borderWidth: 1,
//     borderRadius: borderRadius.md,
//     backgroundColor: colors.white,
//     paddingHorizontal: spacing.md,
//     height: 50,
//   },
//   icon: {
//     marginRight: spacing.sm,
//   },
//   input: {
//     flex: 1,
//     ...typography.body,
//     color: colors.darkGrey,
//     height: '100%',
//   },
//   error: {
//     ...typography.bodySmall,
//     color: colors.error,
//     marginTop: spacing.xs,
//   },
// });