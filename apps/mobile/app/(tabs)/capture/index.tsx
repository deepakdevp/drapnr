// =============================================================================
// Capture Tab — Intro Screen
// =============================================================================
// Shows an illustration and step-by-step instructions before recording.
// =============================================================================

import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useTheme } from '@/lib/theme';
import { useSubscriptionStore } from '@/stores/subscriptionStore';
import { useWardrobeStore } from '@/stores/wardrobeStore';

interface Step {
  number: string;
  title: string;
  description: string;
}

const STEPS: Step[] = [
  {
    number: '1',
    title: 'Stand in a clear space',
    description: 'Make sure there is good lighting and a plain background if possible.',
  },
  {
    number: '2',
    title: 'Hand your phone to someone',
    description: 'They will need to film you slowly walking in a full circle.',
  },
  {
    number: '3',
    title: 'Stay still while filming',
    description: 'Keep your arms slightly away from your body. The recording takes about 15 seconds.',
  },
];

export default function CaptureScreen() {
  const theme = useTheme();
  const c = theme.colors;
  const router = useRouter();
  const canAddOutfit = useSubscriptionStore((s) => s.canAddOutfit);
  const getOutfitLimit = useSubscriptionStore((s) => s.getOutfitLimit);
  const tier = useSubscriptionStore((s) => s.tier);
  const outfitCount = useWardrobeStore((s) => s.outfits.length);

  const handleStartRecording = () => {
    if (!canAddOutfit(outfitCount)) {
      const limit = getOutfitLimit();
      Alert.alert(
        'Outfit Limit Reached',
        `You have ${outfitCount}/${limit} outfits on the ${tier} plan. Upgrade to add more.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Upgrade', onPress: () => router.push('/paywall' as never) },
        ],
      );
      return;
    }
    router.push('/(tabs)/capture/recording');
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: c.surface.background }]}
      edges={['top']}
    >
      <View style={styles.content}>
        {/* Illustration */}
        <Animated.View
          entering={FadeIn.delay(100).duration(600)}
          style={styles.illustrationArea}
        >
          <View
            style={[
              styles.illustrationCircle,
              { backgroundColor: c.brand.primary + '10' },
            ]}
          >
            <View
              style={[
                styles.illustrationInner,
                { backgroundColor: c.brand.primary + '18' },
              ]}
            >
              <Text style={styles.illustrationEmoji}>🎬</Text>
            </View>
          </View>
        </Animated.View>

        {/* Title */}
        <Animated.View entering={FadeInDown.delay(200).duration(500)}>
          <Text style={[styles.title, { color: c.text.primary }]}>Capture Your Outfit</Text>
          <Text style={[styles.subtitle, { color: c.text.secondary }]}>
            Someone else will need to film you while you stand still.
          </Text>
        </Animated.View>

        {/* Steps */}
        <Animated.View entering={FadeInDown.delay(300).duration(500)} style={styles.stepsContainer}>
          {STEPS.map((step, index) => (
            <Animated.View
              key={step.number}
              entering={FadeInDown.delay(400 + index * 100).duration(400)}
              style={styles.stepRow}
            >
              <View style={[styles.stepBadge, { backgroundColor: c.brand.primary }]}>
                <Text style={styles.stepBadgeText}>{step.number}</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={[styles.stepTitle, { color: c.text.primary }]}>
                  {step.title}
                </Text>
                <Text style={[styles.stepDescription, { color: c.text.secondary }]}>
                  {step.description}
                </Text>
              </View>
            </Animated.View>
          ))}
        </Animated.View>
      </View>

      {/* CTA */}
      <Animated.View entering={FadeInUp.delay(700).duration(500)} style={styles.bottomArea}>
        <View
          style={[styles.noteContainer, { backgroundColor: c.semantic.infoLight }]}
        >
          <Text style={[styles.noteText, { color: c.semantic.infoDark }]}>
            Tip: Natural lighting works best. Avoid backlit situations.
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.startButton, { backgroundColor: c.brand.primary }]}
          onPress={handleStartRecording}
          activeOpacity={0.8}
        >
          <Text style={[styles.startButtonText, { color: c.text.onPrimary }]}>
            Start Recording
          </Text>
        </TouchableOpacity>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  illustrationArea: {
    alignItems: 'center',
    marginBottom: 24,
  },
  illustrationCircle: {
    width: 160,
    height: 160,
    borderRadius: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  illustrationInner: {
    width: 110,
    height: 110,
    borderRadius: 55,
    alignItems: 'center',
    justifyContent: 'center',
  },
  illustrationEmoji: {
    fontSize: 52,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.3,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    letterSpacing: 0.1,
    marginBottom: 32,
  },
  stepsContainer: {
    gap: 20,
  },
  stepRow: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'flex-start',
  },
  stepBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  stepBadgeText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  stepContent: {
    flex: 1,
    gap: 2,
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  stepDescription: {
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.1,
  },
  bottomArea: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    gap: 16,
  },
  noteContainer: {
    borderRadius: 12,
    padding: 14,
  },
  noteText: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    textAlign: 'center',
  },
  startButton: {
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF2D55',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  startButtonText: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
