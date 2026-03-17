// =============================================================================
// Review Screen — Display captured frames and confirm outfit
// =============================================================================

import React, { useCallback, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';

import { useCaptureStore } from '../../../stores/captureStore';

// ── Design tokens ────────────────────────────────────────────────────────────
const COLORS = {
  primary: '#FF6B6B',
  background: '#FFFFFF',
  text: '#1A1A2E',
  secondaryText: '#6B7280',
  surface: '#F8F9FA',
} as const;

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const THUMBNAIL_SIZE = 80;

// ── Component ────────────────────────────────────────────────────────────────
export default function ReviewScreen(): React.JSX.Element {
  const router = useRouter();
  const [outfitName, setOutfitName] = useState<string>('');
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [selectedFrameIndex, setSelectedFrameIndex] = useState<number>(0);

  // Store
  const frames = useCaptureStore((s) => s.frames);
  const uploadFrames = useCaptureStore((s) => s.uploadFrames);
  const triggerProcessing = useCaptureStore((s) => s.triggerProcessing);
  const reset = useCaptureStore((s) => s.reset);

  const handleRetake = useCallback(() => {
    reset();
    router.back();
  }, [router, reset]);

  const handleUseThis = useCallback(async () => {
    if (!outfitName.trim() || frames.length === 0) return;

    setIsUploading(true);

    try {
      // Upload frames to Supabase Storage
      const uploadResult = await uploadFrames(outfitName.trim());

      if (!uploadResult.success) {
        Alert.alert(
          'Upload Failed',
          uploadResult.error ?? 'Failed to upload frames. Please try again.',
          [{ text: 'OK' }],
        );
        setIsUploading(false);
        return;
      }

      // Trigger server-side processing
      const processResult = await triggerProcessing();

      if (!processResult.success) {
        Alert.alert(
          'Processing Failed',
          processResult.error ?? 'Failed to start processing. Please try again.',
          [{ text: 'OK' }],
        );
        setIsUploading(false);
        return;
      }

      // Navigate to processing screen
      router.push('/(tabs)/capture/processing');
    } catch (error) {
      Alert.alert(
        'Error',
        'An unexpected error occurred. Please try again.',
        [{ text: 'OK' }],
      );
      setIsUploading(false);
    }
  }, [outfitName, frames, uploadFrames, triggerProcessing, router]);

  const renderThumbnail = useCallback(
    ({ item, index }: { item: string; index: number }) => (
      <TouchableOpacity
        onPress={() => setSelectedFrameIndex(index)}
        activeOpacity={0.7}
        style={[
          styles.thumbnailWrapper,
          index === selectedFrameIndex && styles.thumbnailSelected,
        ]}
      >
        <Image source={{ uri: item }} style={styles.thumbnail} />
        <Text style={styles.thumbnailIndex}>{index + 1}</Text>
      </TouchableOpacity>
    ),
    [selectedFrameIndex],
  );

  const keyExtractor = useCallback(
    (_item: string, index: number) => `frame-${index}`,
    [],
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Large preview of selected frame */}
      <View style={styles.previewContainer}>
        {frames.length > 0 ? (
          <Image
            source={{ uri: frames[selectedFrameIndex] ?? frames[0] }}
            style={styles.previewImage}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.noFramesPlaceholder}>
            <Text style={styles.noFramesText}>No frames captured</Text>
          </View>
        )}

        {/* Frame counter badge */}
        <View style={styles.frameCountBadge}>
          <Text style={styles.frameCountText}>
            {frames.length} frame{frames.length !== 1 ? 's' : ''} captured
          </Text>
        </View>
      </View>

      {/* Horizontal thumbnail scroll */}
      {frames.length > 0 && (
        <View style={styles.thumbnailStrip}>
          <FlatList
            data={frames}
            renderItem={renderThumbnail}
            keyExtractor={keyExtractor}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.thumbnailList}
          />
        </View>
      )}

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
          editable={!isUploading}
        />
        <Text style={styles.charCount}>{outfitName.length}/60</Text>

        {/* Action buttons */}
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={styles.retakeButton}
            onPress={handleRetake}
            activeOpacity={0.7}
            disabled={isUploading}
          >
            <Text style={styles.retakeText}>Retake</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.useButton,
              (!outfitName.trim() || frames.length === 0 || isUploading) &&
                styles.useButtonDisabled,
            ]}
            onPress={handleUseThis}
            activeOpacity={0.7}
            disabled={!outfitName.trim() || frames.length === 0 || isUploading}
          >
            {isUploading ? (
              <ActivityIndicator color={COLORS.background} size="small" />
            ) : (
              <Text style={styles.useText}>Use This</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  previewContainer: {
    flex: 1,
    margin: 16,
    marginTop: Platform.OS === 'ios' ? 60 : 40,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#1A1A2E',
  },
  previewImage: {
    flex: 1,
    width: '100%',
  },
  noFramesPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noFramesText: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 15,
    fontWeight: '500',
  },
  frameCountBadge: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  frameCountText: {
    color: COLORS.background,
    fontSize: 13,
    fontWeight: '600',
  },

  // -- Thumbnail strip --
  thumbnailStrip: {
    height: THUMBNAIL_SIZE + 16,
    paddingVertical: 8,
  },
  thumbnailList: {
    paddingHorizontal: 16,
    gap: 8,
  },
  thumbnailWrapper: {
    width: THUMBNAIL_SIZE,
    height: THUMBNAIL_SIZE,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  thumbnailSelected: {
    borderColor: COLORS.primary,
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  thumbnailIndex: {
    position: 'absolute',
    bottom: 2,
    right: 4,
    color: COLORS.background,
    fontSize: 10,
    fontWeight: '700',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },

  // -- Bottom section --
  bottomSection: {
    paddingHorizontal: 20,
    paddingTop: 16,
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
