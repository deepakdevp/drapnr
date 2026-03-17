// =============================================================================
// Sign Up Screen
// =============================================================================
// Name, email, password, social auth, terms checkbox.
// =============================================================================

import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link, useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useAuthStore } from '@/stores/authStore';
import { useTheme } from '@/lib/theme';

export default function SignUpScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { signUp, isLoading } = useAuthStore();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const isValid =
    name.trim().length >= 2 &&
    email.includes('@') &&
    password.length >= 6 &&
    termsAccepted;

  const handleSignUp = async () => {
    if (!isValid) {
      Alert.alert('Invalid Input', 'Please fill all fields and accept the terms.');
      return;
    }
    try {
      await signUp(name.trim(), email.trim(), password);
      router.replace('/(auth)/onboarding');
    } catch {
      Alert.alert('Sign Up Failed', 'Please try again.');
    }
  };

  const handleSocialAuth = (provider: string) => {
    Alert.alert('Coming Soon', `${provider} sign-up will be available soon.`);
  };

  const c = theme.colors;

  const inputStyle = (field: string) => [
    styles.input,
    {
      color: c.text.primary,
      borderColor: focusedField === field ? c.brand.primary : c.surface.border,
      backgroundColor: c.surface.surface,
    },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.surface.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <Animated.View entering={FadeInDown.delay(100).duration(500)}>
            <Text style={[styles.title, { color: c.text.primary }]}>Create Account</Text>
            <Text style={[styles.subtitle, { color: c.text.secondary }]}>
              Start building your digital wardrobe.
            </Text>
          </Animated.View>

          {/* Form */}
          <Animated.View entering={FadeInDown.delay(200).duration(500)} style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: c.text.secondary }]}>Full Name</Text>
              <TextInput
                style={inputStyle('name')}
                placeholder="Jane Doe"
                placeholderTextColor={c.text.tertiary}
                autoCapitalize="words"
                autoCorrect={false}
                value={name}
                onChangeText={setName}
                onFocus={() => setFocusedField('name')}
                onBlur={() => setFocusedField(null)}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: c.text.secondary }]}>Email</Text>
              <TextInput
                style={inputStyle('email')}
                placeholder="you@example.com"
                placeholderTextColor={c.text.tertiary}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                value={email}
                onChangeText={setEmail}
                onFocus={() => setFocusedField('email')}
                onBlur={() => setFocusedField(null)}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: c.text.secondary }]}>Password</Text>
              <TextInput
                style={inputStyle('password')}
                placeholder="At least 6 characters"
                placeholderTextColor={c.text.tertiary}
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                onFocus={() => setFocusedField('password')}
                onBlur={() => setFocusedField(null)}
              />
            </View>

            {/* Terms */}
            <TouchableOpacity
              style={styles.termsRow}
              onPress={() => setTermsAccepted(!termsAccepted)}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.checkbox,
                  {
                    borderColor: termsAccepted ? c.brand.primary : c.surface.border,
                    backgroundColor: termsAccepted ? c.brand.primary : 'transparent',
                  },
                ]}
              >
                {termsAccepted && <Text style={styles.checkmark}>&#10003;</Text>}
              </View>
              <Text style={[styles.termsText, { color: c.text.secondary }]}>
                I agree to the{' '}
                <Text style={{ color: c.brand.primary, fontWeight: '600' }}>Terms of Service</Text>
                {' '}and{' '}
                <Text style={{ color: c.brand.primary, fontWeight: '600' }}>Privacy Policy</Text>
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.primaryButton,
                { backgroundColor: isValid ? c.brand.primary : c.neutral.gray300 },
              ]}
              onPress={handleSignUp}
              disabled={isLoading || !isValid}
              activeOpacity={0.8}
            >
              {isLoading ? (
                <ActivityIndicator color={c.text.onPrimary} />
              ) : (
                <Text style={[styles.primaryButtonText, { color: c.text.onPrimary }]}>
                  Create Account
                </Text>
              )}
            </TouchableOpacity>
          </Animated.View>

          {/* Divider */}
          <Animated.View entering={FadeInDown.delay(300).duration(500)} style={styles.dividerRow}>
            <View style={[styles.dividerLine, { backgroundColor: c.surface.border }]} />
            <Text style={[styles.dividerText, { color: c.text.tertiary }]}>or</Text>
            <View style={[styles.dividerLine, { backgroundColor: c.surface.border }]} />
          </Animated.View>

          {/* Social */}
          <Animated.View entering={FadeInDown.delay(400).duration(500)} style={styles.socialGroup}>
            <TouchableOpacity
              style={[styles.socialButton, { borderColor: c.surface.border }]}
              onPress={() => handleSocialAuth('Apple')}
              activeOpacity={0.7}
            >
              <Text style={[styles.socialIcon, { color: c.text.primary }]}>&#xF8FF;</Text>
              <Text style={[styles.socialButtonText, { color: c.text.primary }]}>
                Sign up with Apple
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.socialButton, { borderColor: c.surface.border }]}
              onPress={() => handleSocialAuth('Google')}
              activeOpacity={0.7}
            >
              <Text style={[styles.socialIcon, { color: '#4285F4' }]}>G</Text>
              <Text style={[styles.socialButtonText, { color: c.text.primary }]}>
                Sign up with Google
              </Text>
            </TouchableOpacity>
          </Animated.View>

          {/* Login Link */}
          <Animated.View entering={FadeInDown.delay(500).duration(500)} style={styles.footer}>
            <Text style={[styles.footerText, { color: c.text.secondary }]}>
              Already have an account?{' '}
            </Text>
            <Link href="/(auth)/login" asChild>
              <TouchableOpacity>
                <Text style={[styles.footerLink, { color: c.brand.primary }]}>Sign In</Text>
              </TouchableOpacity>
            </Link>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
    paddingVertical: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    letterSpacing: 0.2,
    marginBottom: 32,
  },
  form: {
    gap: 16,
  },
  inputGroup: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  input: {
    height: 52,
    borderRadius: 12,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginTop: 4,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  termsText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  primaryButton: {
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontSize: 13,
    fontWeight: '500',
  },
  socialGroup: {
    gap: 12,
  },
  socialButton: {
    height: 52,
    borderRadius: 12,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  socialIcon: {
    fontSize: 20,
    fontWeight: '700',
  },
  socialButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 32,
  },
  footerText: {
    fontSize: 15,
  },
  footerLink: {
    fontSize: 15,
    fontWeight: '700',
  },
});
