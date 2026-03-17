import React, { useCallback, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';

// ── Design tokens ──────────────────────────────────────────────────────────────
const COLORS = {
  primary: '#FF6B6B',
  background: '#FFFFFF',
  text: '#1A1A2E',
  secondaryText: '#6B7280',
  surface: '#F8F9FA',
} as const;

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function ReviewScreen(): React.JSX.Element {
  const router = useRouter();
  const [outfitName, setOutfitName] = useState<string>('');
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  // Subtle scale animation on play press
  const playScale = useRef(new Animated.Value(1)).current;

  const handlePlayPress = useCallback(() => {
    Animated.sequence([
      Animated.timing(playScale, {
        toValue: 0.9,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(playScale, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
    setIsPlaying((prev) => !prev);
  }, [playScale]);

  const handleRetake = useCallback(() => {
    router.back();
  }, [router]);

  const handleUseThis = useCallback(() => {
    router.push('/(tabs)/capture/processing');
  }, [router]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Video playback placeholder */}
      <View style={styles.videoContainer}>
        <View style={styles.videoPlaceholder}>
          <TouchableOpacity
            onPress={handlePlayPress}
            activeOpacity={0.8}
            style={styles.playButtonWrapper}
          >
            <Animated.View
              style={[
                styles.playButton,
                { transform: [{ scale: playScale }] },
              ]}
            >
              {isPlaying ? (
                <View style={styles.pauseIcon}>
                  <View style={styles.pauseBar} />
                  <View style={styles.pauseBar} />
                </View>
              ) : (
                <View style={styles.playIcon} />
              )}
            </Animated.View>
          </TouchableOpacity>

          <Text style={styles.videoLabel}>
            {isPlaying ? 'Playing...' : 'Tap to preview'}
          </Text>

          {/* Scrub bar placeholder */}
          <View style={styles.scrubBar}>
            <View style={styles.scrubProgress} />
          </View>
        </View>
      </View>

      {/* Bottom section */}
      <View style={styles.bottomSection}>
        {/* Outfit name input */}
        <Text style={styles.inputLabel}>Outfit Name</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Friday night look"
          placeholderTextColor={COLORS.secondaryText}
          value={outfitName}
          onChangeText={setOutfitName}
          maxLength={60}
          returnKeyType="done"
        />
        <Text style={styles.charCount}>{outfitName.length}/60</Text>

        {/* Action buttons */}
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={styles.retakeButton}
            onPress={handleRetake}
            activeOpacity={0.7}
          >
            <Text style={styles.retakeText}>Retake</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.useButton,
              !outfitName.trim() && styles.useButtonDisabled,
            ]}
            onPress={handleUseThis}
            activeOpacity={0.7}
            disabled={!outfitName.trim()}
          >
            <Text style={styles.useText}>Use This</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  videoContainer: {
    flex: 1,
    padding: 16,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
  },
  videoPlaceholder: {
    flex: 1,
    backgroundColor: '#1A1A2E',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  playButtonWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  playIcon: {
    width: 0,
    height: 0,
    borderLeftWidth: 20,
    borderTopWidth: 13,
    borderBottomWidth: 13,
    borderLeftColor: COLORS.background,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    marginLeft: 5,
  },
  pauseIcon: {
    flexDirection: 'row',
    gap: 6,
  },
  pauseBar: {
    width: 6,
    height: 24,
    backgroundColor: COLORS.background,
    borderRadius: 2,
  },
  videoLabel: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 13,
    fontWeight: '500',
    marginTop: 14,
    letterSpacing: 0.5,
  },
  scrubBar: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 1.5,
  },
  scrubProgress: {
    width: '35%',
    height: 3,
    backgroundColor: COLORS.primary,
    borderRadius: 1.5,
  },
  bottomSection: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: Platform.OS === 'ios' ? 44 : 24,
    backgroundColor: COLORS.background,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.secondaryText,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  input: {
    height: 52,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: COLORS.text,
    fontWeight: '400',
  },
  charCount: {
    fontSize: 12,
    color: COLORS.secondaryText,
    textAlign: 'right',
    marginTop: 4,
    marginBottom: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  retakeButton: {
    flex: 1,
    height: 52,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retakeText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  useButton: {
    flex: 1,
    height: 52,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  useButtonDisabled: {
    opacity: 0.4,
  },
  useText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.background,
  },
});
