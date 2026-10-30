import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing, borderRadius } from '../../theme/spacing';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { useLogin, useGoogleLogin } from '../../hooks/useAuth';
import {
  signInWithGoogle,
  isGoogleConfigured,
  signOutFromGoogle, 
} from '../../services/socialAuth';
import type { AuthStackParamList } from '../../navigation/AuthStack';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';


type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export const LoginScreen: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [userType, setUserType] = useState<'USER' | 'TENANT'>('USER');

  const loginMutation = useLogin();
  const googleLoginMutation = useGoogleLogin();


  // ── Email/Password Login ──
  const handleLogin = () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please enter your email and password.');
      return;
    }

    loginMutation.mutate(
      { email: email.trim(), password, userType },
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

const handleGoogleLogin = async () => {
  if (!isGoogleConfigured()) {
    Alert.alert('Not Configured', 'Google login has not been configured yet.');
    return;
  }
  try {
    // Sign out first to force account picker
    await signOutFromGoogle();
    const idToken = await signInWithGoogle();
    googleLoginMutation.mutate(
      { credential: idToken, userType },
      {
        onError: (error: any) => {
          const msg =
            error?.response?.data?.message ||
            error?.message ||
            'Google login failed.';
          Alert.alert('Google Login Failed', msg);
        },
      },
    );
  } catch (error: any) {
    if (error?.code === 'SIGN_IN_CANCELLED') return;
    Alert.alert('Error', error?.message || 'Failed to open Google login.');
  }
};
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + spacing.xxl },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Logo / Brand ── */}
        <View style={styles.brandContainer}>
          <View style={styles.logoCircle}>
            <Ionicons name="chatbubbles" size={40} color={colors.white} />
          </View>
          <Text style={styles.brandName}>Sudo Reply</Text>
          <Text style={styles.brandTagline}>
            Manage your conversations on the go
          </Text>
        </View>

        {/* ── Login Form ── */}
        <View style={styles.form}>
          <Text style={styles.formTitle}>Welcome back</Text>
          <Text style={styles.formSubtitle}>
            Sign in to continue to your workspace
          </Text>

          {/* ── Role Toggle ── */}
          <View style={styles.roleToggle}>
            <TouchableOpacity
              style={[
                styles.roleButton,
                userType === 'USER' && styles.roleButtonActive,
              ]}
              onPress={() => setUserType('USER')}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.roleText,
                  userType === 'USER' && styles.roleTextActive,
                ]}
              >
                Agent
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.roleButton,
                userType === 'TENANT' && styles.roleButtonActive,
              ]}
              onPress={() => setUserType('TENANT')}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.roleText,
                  userType === 'TENANT' && styles.roleTextActive,
                ]}
              >
                Admin
              </Text>
            </TouchableOpacity>
          </View>

          <Input
            label="Email Address"
            placeholder="you@company.com"
            icon="mail-outline"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Input
            label="Password"
            placeholder="Enter your password"
            icon="lock-closed-outline"
            isPassword
            value={password}
            onChangeText={setPassword}
            onSubmitEditing={handleLogin}
          />

          <TouchableOpacity
            onPress={() => navigation.navigate('ForgotPassword')}
            style={styles.forgotLink}
          >
            <Text style={styles.forgotText}>Forgot password?</Text>
          </TouchableOpacity>

          <Button
            title="Sign In"
            onPress={handleLogin}
            loading={loginMutation.isPending}
            fullWidth
            size="lg"
            style={styles.loginButton}
          />

          {/* ── Divider ── */}
          <View style={styles.dividerContainer}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>Or continue with</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* ── Google Button ── */}
          <TouchableOpacity
            style={[
              styles.socialButton,
              googleLoginMutation.isPending && styles.socialButtonDisabled,
            ]}
            onPress={handleGoogleLogin}
            activeOpacity={0.7}
            disabled={googleLoginMutation.isPending}
          >
            <Image
              source={{
                uri: 'https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg',
              }}
              style={styles.googleIcon}
            />
            <Text style={styles.socialButtonText}>Continue with Google</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.huge,
  },
  brandContainer: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.base,
  },
  brandName: {
    ...typography.h1,
    color: colors.darkGrey,
  },
  brandTagline: {
    ...typography.body,
    color: colors.secondaryGrey,
    marginTop: spacing.xs,
  },
  form: {
    marginTop: spacing.base,
  },
  formTitle: {
    ...typography.h2,
    color: colors.darkGrey,
  },
  formSubtitle: {
    ...typography.body,
    color: colors.secondaryGrey,
    marginTop: spacing.xs,
    marginBottom: spacing.xl,
  },
  roleToggle: {
    flexDirection: 'row',
    backgroundColor: colors.lightGrey,
    borderRadius: borderRadius.md,
    padding: 3,
    marginBottom: spacing.xl,
  },
  roleButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: borderRadius.sm,
  },
  roleButtonActive: {
    backgroundColor: colors.white,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  roleText: {
    ...typography.label,
    color: colors.secondaryGrey,
  },
  roleTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  forgotLink: {
    alignSelf: 'flex-end',
    marginBottom: spacing.xl,
    marginTop: -spacing.sm,
  },
  forgotText: {
    ...typography.labelSmall,
    color: colors.primary,
  },
  loginButton: {
    marginTop: spacing.sm,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.xl,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    ...typography.bodySmall,
    color: colors.secondaryGrey,
    marginHorizontal: spacing.md,
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    height: 50,
  },
  socialButtonDisabled: {
    opacity: 0.5,
  },
  googleIcon: {
    width: 22,
    height: 22,
    marginRight: spacing.sm,
  },
  socialButtonText: {
    ...typography.label,
    color: colors.darkGrey,
  },
});