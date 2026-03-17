// =============================================================================
// Body Template Picker
// =============================================================================
// 2x2 grid of silhouette cards with gender toggle. Stores selection in authStore.
// =============================================================================

import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useAuthStore } from '@/stores/authStore';
import { useTheme } from '@/lib/theme';
import type { Gender, BodyType } from '@/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_GAP = 16;
const CARD_WIDTH = (SCREEN_WIDTH - 48 - CARD_GAP) / 2;

interface BodyOption {
  bodyType: BodyType;
  label: string;
  silhouette: string; // Emoji placeholder for silhouette illustration
  description: string;
}

const BODY_OPTIONS: Record<Gender, BodyOption[]> = {
  male: [
    { bodyType: 'slim', label: 'Slim', silhouette: '🧍‍♂️', description: 'Lean build' },
    { bodyType: 'average', label: 'Average', silhouette: '🧑‍💼', description: 'Standard build' },
  ],
  female: [
    { bodyType: 'slim', label: 'Slim', silhouette: '🧍‍♀️', description: 'Lean build' },
    { bodyType: 'average', label: 'Average', silhouette: '👩‍💼', description: 'Standard build' },
  ],
  'non-binary': [
    { bodyType: 'slim', label: 'Slim', silhouette: '🧍', description: 'Lean build' },
    { bodyType: 'average', label: 'Average', silhouette: '🧑', description: 'Standard build' },
  ],
};

const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
];

export default function BodyTemplateScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { setBodyTemplate, isLoading } = useAuthStore();

  const [selectedGender, setSelectedGender] = useState<Gender>('female');
  const [selectedBodyType, setSelectedBodyType] = useState<BodyType | null>(null);

  const c = theme.colors;

  const handleContinue = () => {
    if (!selectedBodyType) return;
    setBodyTemplate({ gender: selectedGender, bodyType: selectedBodyType });
    router.replace('/(tabs)/wardrobe');
  };

  const options = BODY_OPTIONS[selectedGender];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.surface.background }]}>
      <View style={styles.content}>
        {/* Header */}
        <Animated.View entering={FadeInDown.delay(100).duration(500)}>
          <Text style={[styles.title, { color: c.text.primary }]}>Choose Your Body Type</Text>
          <Text style={[styles.subtitle, { color: c.text.secondary }]}>
            This helps us render your 3D avatar accurately.
          </Text>
        </Animated.View>

        {/* Gender Toggle */}
        <Animated.View entering={FadeInDown.delay(200).duration(500)}>
          <View style={[styles.genderToggle, { backgroundColor: c.surface.surface }]}>
            {GENDER_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.genderOption,
                  selectedGender === option.value && {
                    backgroundColor: c.brand.primary,
                  },
                ]}
                onPress={() => {
                  setSelectedGender(option.value);
                  setSelectedBodyType(null);
                }}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.genderOptionText,
                    {
                      color:
                        selectedGender === option.value
                          ? c.text.onPrimary
                          : c.text.secondary,
                    },
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Animated.View>

        {/* Body Type Grid */}
        <Animated.View entering={FadeInDown.delay(300).duration(500)} style={styles.grid}>
          {options.map((option, index) => {
            const isSelected = selectedBodyType === option.bodyType;
            return (
              <TouchableOpacity
                key={option.bodyType}
                style={[
                  styles.card,
                  {
                    width: CARD_WIDTH,
                    backgroundColor: c.surface.surface,
                    borderColor: isSelected ? c.brand.primary : c.surface.borderLight,
                    borderWidth: isSelected ? 2.5 : 1.5,
                  },
                ]}
                onPress={() => setSelectedBodyType(option.bodyType)}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.silhouetteContainer,
                    {
                      backgroundColor: isSelected
                        ? c.brand.primary + '12'
                        : c.neutral.gray100,
                    },
                  ]}
                >
                  <Text style={styles.silhouetteEmoji}>{option.silhouette}</Text>
                </View>
                <Text
                  style={[
                    styles.cardLabel,
                    {
                      color: isSelected ? c.brand.primary : c.text.primary,
                      fontWeight: isSelected ? '700' : '600',
                    },
                  ]}
                >
                  {option.label}
                </Text>
                <Text style={[styles.cardDescription, { color: c.text.tertiary }]}>
                  {option.description}
                </Text>
              </TouchableOpacity>
            );
          })}
        </Animated.View>
      </View>

      {/* Continue Button */}
      <Animated.View entering={FadeInUp.delay(400).duration(500)} style={styles.bottomArea}>
        <TouchableOpacity
          style={[
            styles.continueButton,
            {
              backgroundColor: selectedBodyType ? c.brand.primary : c.neutral.gray300,
            },
          ]}
          onPress={handleContinue}
          disabled={!selectedBodyType || isLoading}
          activeOpacity={0.8}
        >
          <Text style={[styles.continueButtonText, { color: c.text.onPrimary }]}>
            Continue
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
    paddingTop: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    letterSpacing: 0.1,
    marginBottom: 32,
  },
  genderToggle: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 4,
    marginBottom: 32,
  },
  genderOption: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  genderOptionText: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: CARD_GAP,
    justifyContent: 'center',
  },
  card: {
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    gap: 8,
  },
  silhouetteContainer: {
    width: 80,
    height: 100,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  silhouetteEmoji: {
    fontSize: 48,
  },
  cardLabel: {
    fontSize: 16,
    letterSpacing: 0.2,
  },
  cardDescription: {
    fontSize: 13,
    letterSpacing: 0.1,
  },
  bottomArea: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  continueButton: {
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueButtonText: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
