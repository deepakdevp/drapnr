import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';

import { useCombinationStore } from '../../../stores/combinationStore';
import { useWardrobeStore } from '../../../stores/wardrobeStore';

// ── Design tokens ──────────────────────────────────────────────────────────────
const COLORS = {
  primary: '#FF6B6B',
  background: '#FFFFFF',
  text: '#1A1A2E',
  secondaryText: '#6B7280',
  surface: '#F8F9FA',
} as const;

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function SaveComboModal(): React.JSX.Element {
  const router = useRouter();
  const [comboName, setComboName] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  const currentCombo = useCombinationStore((s) => s.currentCombo);
  const saveCombination = useCombinationStore((s) => s.saveCombination);
  const garments = useWardrobeStore((s) => s.garments);

  const selectedGarments = useMemo(() => {
    const items: { id: string; name: string; color: string; category: string; thumbnailUrl: string }[] = [];
    for (const [category, id] of [
      ['Top', currentCombo.topId],
      ['Bottom', currentCombo.bottomId],
      ['Shoes', currentCombo.shoesId],
    ] as const) {
      const garment = garments.find((g) => g.id === id);
      if (garment) {
        items.push({
          id: garment.id,
          name: garment.metadata.brand ?? garment.category,
          color: garment.dominantColor || '#E5E7EB',
          category,
          thumbnailUrl: garment.thumbnailUrl,
        });
      }
    }
    return items;
  }, [currentCombo, garments]);

  const slideAnim = useRef(new Animated.Value(300)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  // ── Entrance animation ────────────────────────────────────────────────────
  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        damping: 20,
        stiffness: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, [slideAnim, backdropOpacity]);

  const dismiss = useCallback(() => {
    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 300,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      router.back();
    });
  }, [router, slideAnim, backdropOpacity]);

  const handleSave = useCallback(async () => {
    if (!comboName.trim()) return;
    setIsSaving(true);
    try {
      await saveCombination(comboName.trim());
      dismiss();
    } catch (err: any) {
      Alert.alert('Save Failed', err.message ?? 'Could not save combination.');
    } finally {
      setIsSaving(false);
    }
  }, [comboName, saveCombination, dismiss]);

  return (
    <View style={styles.container}>
      {/* Backdrop */}
      <Animated.View
        style={[styles.backdrop, { opacity: backdropOpacity }]}
      >
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          onPress={dismiss}
          activeOpacity={1}
        />
      </Animated.View>

      {/* Modal card */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalWrapper}
      >
        <Animated.View
          style={[
            styles.modal,
            { transform: [{ translateY: slideAnim }] },
          ]}
        >
          {/* Handle */}
          <View style={styles.handle} />

          <Text style={styles.title}>Save Combination</Text>

          {/* Selected garment previews */}
          <View style={styles.previewRow}>
            {selectedGarments.map((garment) => (
              <View key={garment.id} style={styles.previewItem}>
                {garment.thumbnailUrl ? (
                  <Image
                    source={{ uri: garment.thumbnailUrl }}
                    style={styles.previewThumb}
                    resizeMode="cover"
                  />
                ) : (
                  <View
                    style={[
                      styles.previewThumb,
                      { backgroundColor: garment.color },
                    ]}
                  />
                )}
                <Text style={styles.previewCategory}>{garment.category}</Text>
                <Text style={styles.previewName} numberOfLines={1}>
                  {garment.name}
                </Text>
              </View>
            ))}
          </View>

          {/* Name input */}
          <Text style={styles.inputLabel}>Combination Name</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Casual Friday"
            placeholderTextColor={COLORS.secondaryText}
            value={comboName}
            onChangeText={setComboName}
            maxLength={40}
            returnKeyType="done"
            autoFocus
          />

          {/* Buttons */}
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={dismiss}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.saveButton,
                (!comboName.trim() || isSaving) && styles.saveButtonDisabled,
              ]}
              onPress={handleSave}
              activeOpacity={0.7}
              disabled={!comboName.trim() || isSaving}
            >
              {isSaving ? (
                <ActivityIndicator color={COLORS.background} size="small" />
              ) : (
                <Text style={styles.saveText}>Save</Text>
              )}
            </TouchableOpacity>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  modalWrapper: {
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 44 : 24,
    paddingTop: 12,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
    alignSelf: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 24,
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 28,
    gap: 12,
  },
  previewItem: {
    flex: 1,
    alignItems: 'center',
  },
  previewThumb: {
    width: 72,
    height: 72,
    borderRadius: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  previewCategory: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.secondaryText,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  previewName: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.text,
    textAlign: 'center',
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
    marginBottom: 24,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    height: 52,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  saveButton: {
    flex: 1,
    height: 52,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.4,
  },
  saveText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.background,
  },
});
