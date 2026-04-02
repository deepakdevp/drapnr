// =============================================================================
// Outfit Detail Screen
// =============================================================================
// Shows outfit name (editable), 3D avatar placeholder, garment cards, delete.
// =============================================================================

import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useWardrobeStore, type Garment } from '@/stores/wardrobeStore';
import { useTheme } from '@/lib/theme';

export default function OutfitDetailScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const outfit = useWardrobeStore((s) => s.outfits.find((o) => o.id === id));
  const garments = useWardrobeStore((s) => s.garments.filter((g) => g.outfitId === id));
  const fetchGarments = useWardrobeStore((s) => s.fetchGarments);
  const deleteOutfit = useWardrobeStore((s) => s.deleteOutfit);
  const updateOutfitName = useWardrobeStore((s) => s.updateOutfitName);

  useEffect(() => {
    if (id) fetchGarments(id);
  }, [id]);

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(outfit?.name ?? '');

  const c = theme.colors;

  // ---------------------------------------------------------------------------
  // Not found
  // ---------------------------------------------------------------------------

  if (!outfit) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: c.surface.background }]}>
        <View style={styles.notFound}>
          <Text style={[styles.notFoundText, { color: c.text.secondary }]}>
            Outfit not found.
          </Text>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={[styles.notFoundLink, { color: c.brand.primary }]}>Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleSaveName = () => {
    const trimmed = editName.trim();
    if (trimmed.length > 0 && trimmed !== outfit.name) {
      updateOutfitName(outfit.id, trimmed);
    } else {
      setEditName(outfit.name);
    }
    setIsEditing(false);
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Outfit',
      `Are you sure you want to delete "${outfit.name}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteOutfit(outfit.id);
            router.back();
          },
        },
      ],
    );
  };

  // ---------------------------------------------------------------------------
  // Garment helpers
  // ---------------------------------------------------------------------------

  const getGarmentByCategory = (category: string): Garment | undefined =>
    garments.find((g) => g.category === category);

  const top = getGarmentByCategory('top');
  const bottom = getGarmentByCategory('bottom');
  const shoes = getGarmentByCategory('shoes');
  const garmentCards = [
    { label: 'Top', garment: top },
    { label: 'Bottom', garment: bottom },
    { label: 'Shoes', garment: shoes },
  ];

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.surface.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: c.surface.surface }]}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Text style={[styles.backArrow, { color: c.text.primary }]}>&#8592;</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.deleteButton, { backgroundColor: c.semantic.errorLight }]}
          onPress={handleDelete}
          activeOpacity={0.7}
        >
          <Text style={[styles.deleteIcon, { color: c.semantic.error }]}>&#128465;</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* 3D Avatar Placeholder */}
        <Animated.View entering={FadeIn.delay(100).duration(500)}>
          <View style={styles.avatarContainer}>
            <View style={[styles.avatarPlaceholder, { overflow: 'hidden' }]}>
              <View
                style={[
                  StyleSheet.absoluteFill,
                  {
                    backgroundColor: c.brand.primary,
                    opacity: 0.08,
                  },
                ]}
              />
              <View
                style={[
                  styles.avatarGradientOverlay,
                  { backgroundColor: c.brand.secondary + '08' },
                ]}
              />
              <Text style={styles.avatarIcon}>🧍</Text>
              <Text style={[styles.avatarLabel, { color: c.text.tertiary }]}>
                3D Preview
              </Text>
            </View>
          </View>
        </Animated.View>

        {/* Outfit Name */}
        <Animated.View entering={FadeInDown.delay(200).duration(400)} style={styles.nameSection}>
          {isEditing ? (
            <View style={styles.editRow}>
              <TextInput
                style={[
                  styles.nameInput,
                  {
                    color: c.text.primary,
                    borderColor: c.brand.primary,
                    backgroundColor: c.surface.surface,
                  },
                ]}
                value={editName}
                onChangeText={setEditName}
                autoFocus
                onBlur={handleSaveName}
                onSubmitEditing={handleSaveName}
                returnKeyType="done"
                maxLength={40}
              />
            </View>
          ) : (
            <TouchableOpacity
              onPress={() => {
                setEditName(outfit.name);
                setIsEditing(true);
              }}
              style={styles.nameRow}
              activeOpacity={0.6}
            >
              <Text style={[styles.outfitName, { color: c.text.primary }]}>
                {outfit.name}
              </Text>
              <Text style={[styles.editHint, { color: c.text.tertiary }]}>
                tap to edit
              </Text>
            </TouchableOpacity>
          )}
          <Text style={[styles.outfitDate, { color: c.text.tertiary }]}>
            Captured {formatDate(outfit.capturedAt)}
          </Text>
        </Animated.View>

        {/* Garment Cards */}
        <Animated.View entering={FadeInDown.delay(300).duration(400)}>
          <Text style={[styles.sectionTitle, { color: c.text.primary }]}>Garments</Text>
          <View style={styles.garmentRow}>
            {garmentCards.map(({ label, garment }, index) => (
              <Animated.View
                key={label}
                entering={FadeInUp.delay(400 + index * 100).duration(400)}
                style={[
                  styles.garmentCard,
                  {
                    backgroundColor: c.surface.surface,
                    borderColor: c.surface.borderLight,
                  },
                ]}
              >
                <View
                  style={[
                    styles.garmentThumbnail,
                    {
                      backgroundColor: garment?.dominantColor ?? c.neutral.gray200,
                      borderColor: c.surface.border,
                    },
                  ]}
                />
                <Text
                  style={[styles.garmentName, { color: c.text.primary }]}
                  numberOfLines={1}
                >
                  {garment?.metadata?.brand ?? garment?.metadata?.color ?? (garment ? label : 'None')}
                </Text>
                <Text style={[styles.garmentType, { color: c.text.tertiary }]}>{label}</Text>
              </Animated.View>
            ))}
          </View>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backArrow: {
    fontSize: 22,
    fontWeight: '500',
  },
  deleteButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteIcon: {
    fontSize: 18,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  avatarContainer: {
    marginBottom: 24,
    alignItems: 'center',
  },
  avatarPlaceholder: {
    width: '100%',
    height: 280,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  avatarGradientOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '40%',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  avatarIcon: {
    fontSize: 72,
  },
  avatarLabel: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  nameSection: {
    marginBottom: 32,
    gap: 4,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  outfitName: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  editHint: {
    fontSize: 12,
    fontWeight: '500',
    fontStyle: 'italic',
  },
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  nameInput: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 2,
    paddingHorizontal: 16,
    fontSize: 20,
    fontWeight: '700',
  },
  outfitDate: {
    fontSize: 14,
    fontWeight: '500',
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.1,
    marginBottom: 16,
  },
  garmentRow: {
    flexDirection: 'row',
    gap: 12,
  },
  garmentCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    alignItems: 'center',
    gap: 8,
  },
  garmentThumbnail: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 12,
    borderWidth: 1,
  },
  garmentName: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  garmentType: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  notFound: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  notFoundText: {
    fontSize: 16,
    fontWeight: '500',
  },
  notFoundLink: {
    fontSize: 16,
    fontWeight: '700',
  },
});
