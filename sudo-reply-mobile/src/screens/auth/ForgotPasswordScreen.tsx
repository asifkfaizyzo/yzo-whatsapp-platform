import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing } from '../../theme/spacing';
import { ScreenHeader } from '../../components/layout/ScreenHeader';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { KeyboardAware } from '../../components/layout/KeyboardAware';
import api from '../../services/api';
import { ENDPOINTS } from '../../config/api';
import type { AuthStackParamList } from '../../navigation/AuthStack';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>;

export const ForgotPasswordScreen: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleReset = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email address.');
      return;
    }

    setLoading(true);
    try {
      await api.post(ENDPOINTS.auth.forgotPassword, { email: email.trim() });
      setSent(true);
    } catch (error: any) {
      const message =
        error?.response?.data?.message || 'Failed to send reset link.';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScreenHeader title="Reset Password" onBack={() => navigation.goBack()} />
      <KeyboardAware>
        <View style={styles.content}>
          {sent ? (
            <View style={styles.successContainer}>
              <Text style={styles.successTitle}>Check your email</Text>
              <Text style={styles.successText}>
                We've sent a password reset link to {email}. Please check your
                inbox and follow the instructions.
              </Text>
              <Button
                title="Back to Login"
                onPress={() => navigation.goBack()}
                fullWidth
                style={styles.backButton}
              />
            </View>
          ) : (
            <>
              <Text style={styles.title}>Forgot your password?</Text>
              <Text style={styles.subtitle}>
                Enter the email address associated with your account and we'll
                send you a link to reset your password.
              </Text>

              <Input
                label="Email Address"
                placeholder="you@company.com"
                icon="mail-outline"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <Button
                title="Send Reset Link"
                onPress={handleReset}
                loading={loading}
                fullWidth
                size="lg"
                style={styles.submitButton}
              />
            </>
          )}
        </View>
      </KeyboardAware>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
  },
  title: {
    ...typography.h2,
    color: colors.darkGrey,
  },
  subtitle: {
    ...typography.body,
    color: colors.secondaryGrey,
    marginTop: spacing.sm,
    marginBottom: spacing.xxl,
    lineHeight: 22,
  },
  submitButton: {
    marginTop: spacing.base,
  },
  successContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  successTitle: {
    ...typography.h2,
    color: colors.darkGrey,
    textAlign: 'center',
  },
  successText: {
    ...typography.body,
    color: colors.secondaryGrey,
    textAlign: 'center',
    marginTop: spacing.md,
    lineHeight: 22,
  },
  backButton: {
    marginTop: spacing.xxl,
  },
});