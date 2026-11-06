import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  Dimensions,
  type ImageSourcePropType,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing } from '../../theme/spacing';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { useLogin } from '../../hooks/useAuth';
import type { AuthStackParamList } from '../../navigation/AuthStack';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

const LOGO_SOURCE: ImageSourcePropType = require('../../../assets/logo.png');

const { height: SCREEN_H } = Dimensions.get('window');

export const LoginScreen: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const loginMutation = useLogin();

  const handleLogin = () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please enter your email and password.');
      return;
    }
    loginMutation.mutate(
      { email: email.trim(), password, userType: 'USER' },
      {
        onError: (error: any) => {
          const message =
            error?.response?.data?.message ||
            error?.message ||
            'Login failed. Please try again.';
          Alert.alert('Login Failed', message);
        },
      },
    );
  };

  const formSpacer = Math.max(SCREEN_H * 0.05, 36);

  return (
    <View style={styles.screen}>
      {/* ── Soft background shapes ── */}
      <View style={styles.blobTopRight} pointerEvents="none" />
      <View style={styles.blobRight} pointerEvents="none" />
      <View style={styles.blobBottomLeft} pointerEvents="none" />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            {
              paddingTop: insets.top + spacing.xxl,
              paddingBottom: Math.max(insets.bottom, spacing.xxl),
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Logo (directly on background, like the mock) ── */}
          <View style={styles.logoWrap}>
            <Image
              source={LOGO_SOURCE}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>

          {/* ── Heading ── */}
          <Text style={styles.heading}>
            Get Started your Journey{'\n'}with SudoReply
          </Text>
          <Text style={styles.subtitle}>Sign in to your Account</Text>

          {/* ── Gap before the form ── */}
          <View style={{ height: formSpacer }} />

          {/* ── Form ── */}
          <View style={styles.form}>
            <View style={styles.fields}>
              <Input
                label="Email/mobile no"
                placeholder="Enter your mobile or email"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                compact
              />

              <Input
                label="Password"
                placeholder="Enter your password"
                isPassword
                value={password}
                onChangeText={setPassword}
                onSubmitEditing={handleLogin}
                compact
              />
            </View>

            {/* ── Remember me + Forgot password ── */}
            <View style={styles.optionsRow}>
              <TouchableOpacity
                style={styles.rememberWrap}
                activeOpacity={0.7}
                onPress={() => setRememberMe((v) => !v)}
              >
                <View
                  style={[
                    styles.checkbox,
                    rememberMe && styles.checkboxChecked,
                  ]}
                >
                  {rememberMe && (
                    <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                  )}
                </View>
                <Text style={styles.rememberText}>Remember me</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => navigation.navigate('ForgotPassword')}
                activeOpacity={0.7}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Text style={styles.forgotText}>Forgot Password?</Text>
              </TouchableOpacity>
            </View>

            {/* ── Login button ── */}
            <Button
              title="Login"
              onPress={handleLogin}
              loading={loginMutation.isPending}
              fullWidth
              size="lg"
              style={styles.loginButton}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

/* ══════════════════════════════════════════════
   Styles
   ══════════════════════════════════════════════ */
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
  },

  /* ── Background blobs (soft, low-contrast) ── */
  blobTopRight: {
    position: 'absolute',
    top: -150,
    right: -120,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: '#F1F5FF',
  },
  blobRight: {
    position: 'absolute',
    top: '20%',
    right: -320,
    width: 440,
    height: 560,
    borderRadius: 230,
    backgroundColor: '#DCE8FF',
  },
  blobBottomLeft: {
    position: 'absolute',
    bottom: -210,
    left: -260,
    width: 480,
    height: 480,
    borderRadius: 240,
    backgroundColor: '#D9E5FF',
  },

  /* ── Logo ── */
  logoWrap: {
    alignItems: 'center',
    marginTop: spacing.xl,
    marginBottom: spacing.xxl,
  },
  logo: {
    width: 170,
    height: 60,
  },

  /* ── Headings ── */
  heading: {
    ...typography.h2,
    fontSize: 22,
    lineHeight: 30,
    fontWeight: '600',
    letterSpacing: -0.2,
    textAlign: 'center',
    color: colors.darkGrey,
  },
  subtitle: {
    ...typography.body,
    fontSize: 14,
    textAlign: 'center',
    color: colors.secondaryGrey,
    marginTop: spacing.xs,
  },

  /* ── Form ── */
  form: {},

  fields: {
    gap: spacing.base,
  },

  /* ── Remember / Forgot row ── */
  optionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.base,
  },
  rememberWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#CBD2DC',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  rememberText: {
    ...typography.labelSmall,
    color: '#6B7280',
  },
  forgotText: {
    ...typography.labelSmall,
    color: colors.primary,
    fontWeight: '600',
  },

  /* ── Login button ── */
  loginButton: {
    borderRadius: 10,
    marginTop: spacing.xxl,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 5,
  },
});


// // sudo-reply-mobile/src/screens/auth/LoginScreen.tsx (do not remove this comment)
// import React, { useState } from 'react';
// import {
//   View,
//   Text,
//   StyleSheet,
//   TouchableOpacity,
//   KeyboardAvoidingView,
//   Platform,
//   ScrollView,
//   Alert,
//   Image,
// } from 'react-native';
// import { useSafeAreaInsets } from 'react-native-safe-area-context';
// import { Ionicons } from '@expo/vector-icons';
// import { colors } from '../../theme/colors';
// import { typography } from '../../theme/typography';
// import { spacing, borderRadius } from '../../theme/spacing';
// import { Input } from '../../components/ui/Input';
// import { Button } from '../../components/ui/Button';
// import { useLogin, useGoogleLogin } from '../../hooks/useAuth';
// import {
//   signInWithGoogle,
//   isGoogleConfigured,
//   signOutFromGoogle, 
// } from '../../services/socialAuth';
// import type { AuthStackParamList } from '../../navigation/AuthStack';
// import type { NativeStackScreenProps } from '@react-navigation/native-stack';


// type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

// export const LoginScreen: React.FC<Props> = ({ navigation }) => {
//   const insets = useSafeAreaInsets();
//   const [email, setEmail] = useState('');
//   const [password, setPassword] = useState('');
//   const [userType, setUserType] = useState<'USER' | 'TENANT'>('USER');

//   const loginMutation = useLogin();
//   const googleLoginMutation = useGoogleLogin();


//   // ── Email/Password Login ──
//   const handleLogin = () => {
//     if (!email.trim() || !password.trim()) {
//       Alert.alert('Error', 'Please enter your email and password.');
//       return;
//     }

//     loginMutation.mutate(
//       { email: email.trim(), password, userType },
//       {
//         onError: (error: any) => {
//           const message =
//             error?.response?.data?.message ||
//             error?.message ||
//             'Login failed. Please try again.';
//           Alert.alert('Login Failed', message);
//         },
//       },
//     );
//   };

// const handleGoogleLogin = async () => {
//   if (!isGoogleConfigured()) {
//     Alert.alert('Not Configured', 'Google login has not been configured yet.');
//     return;
//   }
//   try {
//     // Sign out first to force account picker
//     await signOutFromGoogle();
//     const idToken = await signInWithGoogle();
//     googleLoginMutation.mutate(
//       { credential: idToken, userType },
//       {
//         onError: (error: any) => {
//           const msg =
//             error?.response?.data?.message ||
//             error?.message ||
//             'Google login failed.';
//           Alert.alert('Google Login Failed', msg);
//         },
//       },
//     );
//   } catch (error: any) {
//     if (error?.code === 'SIGN_IN_CANCELLED') return;
//     Alert.alert('Error', error?.message || 'Failed to open Google login.');
//   }
// };
//   return (
//     <KeyboardAvoidingView
//       style={styles.container}
//       behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
//     >
//       <ScrollView
//         contentContainerStyle={[
//           styles.scroll,
//           { paddingTop: insets.top + spacing.xxl },
//         ]}
//         keyboardShouldPersistTaps="handled"
//         showsVerticalScrollIndicator={false}
//       >
//         {/* ── Logo / Brand ── */}
//         <View style={styles.brandContainer}>
//           <View style={styles.logoCircle}>
//             <Ionicons name="chatbubbles" size={40} color={colors.white} />
//           </View>
//           <Text style={styles.brandName}>Sudo Reply</Text>
//           <Text style={styles.brandTagline}>
//             Manage your conversations on the go
//           </Text>
//         </View>

//         {/* ── Login Form ── */}
//         <View style={styles.form}>
//           <Text style={styles.formTitle}>Welcome back</Text>
//           <Text style={styles.formSubtitle}>
//             Sign in to continue to your workspace
//           </Text>

//           {/* ── Role Toggle ── */}
//           <View style={styles.roleToggle}>
//             <TouchableOpacity
//               style={[
//                 styles.roleButton,
//                 userType === 'USER' && styles.roleButtonActive,
//               ]}
//               onPress={() => setUserType('USER')}
//               activeOpacity={0.7}
//             >
//               <Text
//                 style={[
//                   styles.roleText,
//                   userType === 'USER' && styles.roleTextActive,
//                 ]}
//               >
//                 Agent
//               </Text>
//             </TouchableOpacity>
//             <TouchableOpacity
//               style={[
//                 styles.roleButton,
//                 userType === 'TENANT' && styles.roleButtonActive,
//               ]}
//               onPress={() => setUserType('TENANT')}
//               activeOpacity={0.7}
//             >
//               <Text
//                 style={[
//                   styles.roleText,
//                   userType === 'TENANT' && styles.roleTextActive,
//                 ]}
//               >
//                 Admin
//               </Text>
//             </TouchableOpacity>
//           </View>

//           <Input
//             label="Email Address"
//             placeholder="you@company.com"
//             icon="mail-outline"
//             value={email}
//             onChangeText={setEmail}
//             keyboardType="email-address"
//             autoCapitalize="none"
//             autoCorrect={false}
//           />

//           <Input
//             label="Password"
//             placeholder="Enter your password"
//             icon="lock-closed-outline"
//             isPassword
//             value={password}
//             onChangeText={setPassword}
//             onSubmitEditing={handleLogin}
//           />

//           <TouchableOpacity
//             onPress={() => navigation.navigate('ForgotPassword')}
//             style={styles.forgotLink}
//           >
//             <Text style={styles.forgotText}>Forgot password?</Text>
//           </TouchableOpacity>

//           <Button
//             title="Sign In"
//             onPress={handleLogin}
//             loading={loginMutation.isPending}
//             fullWidth
//             size="lg"
//             style={styles.loginButton}
//           />

//           {/* ── Divider ── */}
//           <View style={styles.dividerContainer}>
//             <View style={styles.dividerLine} />
//             <Text style={styles.dividerText}>Or continue with</Text>
//             <View style={styles.dividerLine} />
//           </View>

//           {/* ── Google Button ── */}
//           <TouchableOpacity
//             style={[
//               styles.socialButton,
//               googleLoginMutation.isPending && styles.socialButtonDisabled,
//             ]}
//             onPress={handleGoogleLogin}
//             activeOpacity={0.7}
//             disabled={googleLoginMutation.isPending}
//           >
//             <Image
//               source={{
//                 uri: 'https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg',
//               }}
//               style={styles.googleIcon}
//             />
//             <Text style={styles.socialButtonText}>Continue with Google</Text>
//           </TouchableOpacity>
//         </View>
//       </ScrollView>
//     </KeyboardAvoidingView>
//   );
// };

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//     backgroundColor: colors.white,
//   },
//   scroll: {
//     flexGrow: 1,
//     paddingHorizontal: spacing.xl,
//     paddingBottom: spacing.huge,
//   },
//   brandContainer: {
//     alignItems: 'center',
//     marginBottom: spacing.xxl,
//   },
//   logoCircle: {
//     width: 80,
//     height: 80,
//     borderRadius: 40,
//     backgroundColor: colors.primary,
//     alignItems: 'center',
//     justifyContent: 'center',
//     marginBottom: spacing.base,
//   },
//   brandName: {
//     ...typography.h1,
//     color: colors.darkGrey,
//   },
//   brandTagline: {
//     ...typography.body,
//     color: colors.secondaryGrey,
//     marginTop: spacing.xs,
//   },
//   form: {
//     marginTop: spacing.base,
//   },
//   formTitle: {
//     ...typography.h2,
//     color: colors.darkGrey,
//   },
//   formSubtitle: {
//     ...typography.body,
//     color: colors.secondaryGrey,
//     marginTop: spacing.xs,
//     marginBottom: spacing.xl,
//   },
//   roleToggle: {
//     flexDirection: 'row',
//     backgroundColor: colors.lightGrey,
//     borderRadius: borderRadius.md,
//     padding: 3,
//     marginBottom: spacing.xl,
//   },
//   roleButton: {
//     flex: 1,
//     paddingVertical: spacing.sm,
//     alignItems: 'center',
//     borderRadius: borderRadius.sm,
//   },
//   roleButtonActive: {
//     backgroundColor: colors.white,
//     shadowColor: colors.black,
//     shadowOffset: { width: 0, height: 1 },
//     shadowOpacity: 0.08,
//     shadowRadius: 3,
//     elevation: 2,
//   },
//   roleText: {
//     ...typography.label,
//     color: colors.secondaryGrey,
//   },
//   roleTextActive: {
//     color: colors.primary,
//     fontWeight: '600',
//   },
//   forgotLink: {
//     alignSelf: 'flex-end',
//     marginBottom: spacing.xl,
//     marginTop: -spacing.sm,
//   },
//   forgotText: {
//     ...typography.labelSmall,
//     color: colors.primary,
//   },
//   loginButton: {
//     marginTop: spacing.sm,
//   },
//   dividerContainer: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     marginVertical: spacing.xl,
//   },
//   dividerLine: {
//     flex: 1,
//     height: 1,
//     backgroundColor: colors.border,
//   },
//   dividerText: {
//     ...typography.bodySmall,
//     color: colors.secondaryGrey,
//     marginHorizontal: spacing.md,
//   },
//   socialButton: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     justifyContent: 'center',
//     backgroundColor: colors.white,
//     borderWidth: 1,
//     borderColor: colors.border,
//     borderRadius: borderRadius.md,
//     height: 50,
//   },
//   socialButtonDisabled: {
//     opacity: 0.5,
//   },
//   googleIcon: {
//     width: 22,
//     height: 22,
//     marginRight: spacing.sm,
//   },
//   socialButtonText: {
//     ...typography.label,
//     color: colors.darkGrey,
//   },
// });