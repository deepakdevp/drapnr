// =============================================================================
// Login Screen
// =============================================================================
// Clean, Zara-minimal login with email/password + social auth.
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link, useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useAuthStore } from '@/stores/authStore';
import { useTheme } from '@/lib/theme';

export default function LoginScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { signIn, isLoading } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  const isValid = email.includes('@') && password.length >= 6;

  const handleSignIn = async () => {
    if (!isValid) {
      Alert.alert('Invalid Input', 'Please enter a valid email and password (6+ characters).');
      return;
    }
    try {
      await signIn(email, password);
      router.replace('/(auth)/onboarding');
    } catch {
      Alert.alert('Sign In Failed', 'Please check your credentials and try again.');
    }
  };

  const handleSocialAuth = (provider: string) => {
    Alert.alert('Coming Soon', `${provider} sign-in will be available soon.`);
  };

  const c = theme.colors;
  const t = theme.typography;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.surface.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.content}>
          {/* Logo */}
          <Animated.View entering={FadeInDown.delay(100).duration(500)} style={styles.logoContainer}>
            <View style={[styles.logoMark, { backgroundColor: c.brand.primary }]}>
              <Text style={styles.logoLetter}>D</Text>
            </View>
            <Text style={[styles.logoText, { color: c.text.primary, fontFamily: t.h1.fontFamily }]}>
              DRAPNR
            </Text>
          </Animated.View>

          {/* Tagline */}
          <Animated.View entering={FadeInDown.delay(200).duration(500)}>
            <Text style={[styles.tagline, { color: c.text.secondary }]}>
              Your virtual wardrobe, reimagined.
            </Text>
          </Animated.View>

          {/* Form */}
          <Animated.View entering={FadeInDown.delay(300).duration(500)} style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: c.text.secondary }]}>Email</Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    color: c.text.primary,
                    borderColor: emailFocused ? c.brand.primary : c.surface.border,
                    backgroundColor: c.surface.surface,
                  },
                ]}
                placeholder="you@example.com"
                placeholderTextColor={c.text.tertiary}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                value={email}
                onChangeText={setEmail}
                onFocus={() => setEmailFocused(true)}
                onBlur={() => setEmailFocused(false)}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: c.text.secondary }]}>Password</Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    color: c.text.primary,
                    borderColor: passwordFocused ? c.brand.primary : c.surface.border,
                    backgroundColor: c.surface.surface,
                  },
                ]}
                placeholder="At least 6 characters"
                placeholderTextColor={c.text.tertiary}
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                onFocus={() => setPasswordFocused(true)}
                onBlur={() => setPasswordFocused(false)}
              />
            </View>

            <TouchableOpacity
              style={[
                styles.primaryButton,
                { backgroundColor: isValid ? c.brand.primary : c.neutral.gray300 },
              ]}
              onPress={handleSignIn}
              disabled={isLoading || !isValid}
              activeOpacity={0.8}
            >
              {isLoading ? (
                <ActivityIndicator color={c.text.onPrimary} />
              ) : (
                <Text style={[styles.primaryButtonText, { color: c.text.onPrimary }]}>
                  Sign In
                </Text>
              )}
            </TouchableOpacity>
          </Animated.View>

          {/* Divider */}
          <Animated.View entering={FadeInDown.delay(400).duration(500)} style={styles.dividerRow}>
            <View style={[styles.dividerLine, { backgroundColor: c.surface.border }]} />
            <Text style={[styles.dividerText, { color: c.text.tertiary }]}>or</Text>
            <View style={[styles.dividerLine, { backgroundColor: c.surface.border }]} />
          </Animated.View>

          {/* Social Auth */}
          <Animated.View entering={FadeInDown.delay(500).duration(500)} style={styles.socialGroup}>
            <TouchableOpacity
              style={[styles.socialButton, { borderColor: c.surface.border }]}
              onPress={() => handleSocialAuth('Apple')}
              activeOpacity={0.7}
            >
              <Text style={[styles.socialIcon, { color: c.text.primary }]}>&#xF8FF;</Text>
              <Text style={[styles.socialButtonText, { color: c.text.primary }]}>
                Sign in with Apple
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.socialButton, { borderColor: c.surface.border }]}
              onPress={() => handleSocialAuth('Google')}
              activeOpacity={0.7}
            >
              <Text style={[styles.socialIcon, { color: '#4285F4' }]}>G</Text>
              <Text style={[styles.socialButtonText, { color: c.text.primary }]}>
                Sign in with Google
              </Text>
            </TouchableOpacity>
          </Animated.View>

          {/* Sign Up Link */}
          <Animated.View entering={FadeInDown.delay(600).duration(500)} style={styles.footer}>
            <Text style={[styles.footerText, { color: c.text.secondary }]}>
              Don't have an account?{' '}
            </Text>
            <Link href="/(auth)/signup" asChild>
              <TouchableOpacity>
                <Text style={[styles.footerLink, { color: c.brand.primary }]}>Sign Up</Text>
              </TouchableOpacity>
            </Link>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 8,
  },
  logoMark: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  logoLetter: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -1,
  },
  logoText: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 6,
  },
  tagline: {
    textAlign: 'center',
    fontSize: 15,
    marginBottom: 40,
    letterSpacing: 0.2,
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
