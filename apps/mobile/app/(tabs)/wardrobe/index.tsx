// =============================================================================
// Wardrobe Tab — Outfit Grid
// =============================================================================
// 2-column grid of outfit cards with pull-to-refresh and empty state.
// =============================================================================

import { useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useWardrobeStore, type Outfit } from '@/stores/wardrobeStore';
import { useTheme } from '@/lib/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_GAP = 12;
const CARD_WIDTH = (SCREEN_WIDTH - 48 - CARD_GAP) / 2;

export default function WardrobeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { outfits, isLoading, isRefreshing, fetchOutfits, refreshOutfits } =
    useWardrobeStore();

  const c = theme.colors;

  useEffect(() => {
    fetchOutfits();
  }, []);

  const handleOutfitPress = (outfit: Outfit) => {
    router.push(`/(tabs)/wardrobe/${outfit.id}`);
  };

  const handleCapture = () => {
    router.push('/(tabs)/capture');
  };

  const renderOutfitCard = useCallback(
    ({ item, index }: { item: Outfit; index: number }) => {
      return (
        <Animated.View entering={FadeInDown.delay(index * 80).duration(400)}>
          <TouchableOpacity
            style={[
              styles.card,
              {
                width: CARD_WIDTH,
                backgroundColor: c.surface.surface,
                borderColor: c.surface.borderLight,
              },
            ]}
            onPress={() => handleOutfitPress(item)}
            activeOpacity={0.7}
          >
            {/* Thumbnail */}
            <View style={styles.thumbnailContainer}>
              {item.thumbnailUrl ? (
                <Image
                  source={{ uri: item.thumbnailUrl }}
                  style={styles.thumbnail}
                  resizeMode="cover"
                />
              ) : (
                <View style={[styles.thumbnail, { backgroundColor: c.neutral.gray100 }]}>
                  <Ionicons name="shirt-outline" size={32} color={c.text.tertiary} />
                </View>
              )}

              {/* Status badge */}
              {item.status === 'processing' && (
                <View style={[styles.badge, { backgroundColor: '#F59E0B' }]}>
                  <ActivityIndicator size={10} color="#FFF" />
                </View>
              )}
              {item.status === 'failed' && (
                <View style={[styles.badge, { backgroundColor: '#EF4444' }]}>
                  <Ionicons name="alert" size={10} color="#FFF" />
                </View>
              )}
            </View>

            {/* Info */}
            <View style={styles.cardInfo}>
              <Text
                style={[styles.cardName, { color: c.text.primary }]}
                numberOfLines={1}
              >
                {item.name}
              </Text>
              <Text style={[styles.cardDate, { color: c.text.tertiary }]}>
                {formatDate(item.createdAt)}
              </Text>
            </View>
          </TouchableOpacity>
        </Animated.View>
      );
    },
    [c],
  );

  // ---------------------------------------------------------------------------
  // Empty State
  // ---------------------------------------------------------------------------

  const renderEmpty = () => {
    if (isLoading) return null;
    return (
      <Animated.View entering={FadeIn.delay(200).duration(500)} style={styles.emptyContainer}>
        <View
          style={[
            styles.emptyIllustration,
            { backgroundColor: c.brand.primary + '10' },
          ]}
        >
          <Text style={styles.emptyIcon}>📸</Text>
        </View>
        <Text style={[styles.emptyTitle, { color: c.text.primary }]}>
          No outfits yet
        </Text>
        <Text style={[styles.emptySubtitle, { color: c.text.secondary }]}>
          Capture your first outfit to start building your digital wardrobe.
        </Text>
        <TouchableOpacity
          style={[styles.emptyCta, { backgroundColor: c.brand.primary }]}
          onPress={handleCapture}
          activeOpacity={0.8}
        >
          <Text style={[styles.emptyCtaText, { color: c.text.onPrimary }]}>
            Capture Your First Outfit
          </Text>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  // ---------------------------------------------------------------------------
  // Loading State
  // ---------------------------------------------------------------------------

  if (isLoading && outfits.length === 0) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: c.surface.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={c.brand.primary} />
          <Text style={[styles.loadingText, { color: c.text.secondary }]}>
            Loading your wardrobe...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // ---------------------------------------------------------------------------
  // Main Render
  // ---------------------------------------------------------------------------

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: c.surface.background }]}
      edges={['top']}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: c.text.primary }]}>Wardrobe</Text>
        <Text style={[styles.headerCount, { color: c.text.tertiary }]}>
          {outfits.length} {outfits.length === 1 ? 'outfit' : 'outfits'}
        </Text>
      </View>

      {/* Grid */}
      <FlatList
        data={outfits}
        renderItem={renderOutfitCard}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.columnWrapper}
        contentContainerStyle={[
          styles.listContent,
          outfits.length === 0 && styles.listContentEmpty,
        ]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={renderEmpty}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={refreshOutfits}
            tintColor={c.brand.primary}
            colors={[c.brand.primary]}
          />
        }
      />

      {/* FAB */}
      {outfits.length > 0 && (
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: c.brand.primary }]}
          onPress={handleCapture}
          activeOpacity={0.85}
        >
          <Text style={styles.fabIcon}>+</Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  headerCount: {
    fontSize: 14,
    fontWeight: '500',
  },
  columnWrapper: {
    paddingHorizontal: 24,
    gap: CARD_GAP,
  },
  listContent: {
    gap: CARD_GAP,
    paddingBottom: 100,
  },
  listContentEmpty: {
    flex: 1,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  thumbnailContainer: {
    position: 'relative',
  },
  thumbnail: {
    height: CARD_WIDTH * 1.15,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  colorRow: {
    flexDirection: 'row',
    gap: 6,
  },
  colorDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  thumbnailIcon: {
    fontSize: 32,
    marginTop: 4,
  },
  badge: {
    position: 'absolute',
    top: 8,
    right: 8,
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  cardInfo: {
    padding: 12,
    gap: 2,
  },
  cardName: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  cardDate: {
    fontSize: 12,
    fontWeight: '500',
  },
  // Empty state
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 16,
  },
  emptyIllustration: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyIcon: {
    fontSize: 48,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  emptySubtitle: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    letterSpacing: 0.1,
  },
  emptyCta: {
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    marginTop: 8,
  },
  emptyCtaText: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  // Loading
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 15,
    fontWeight: '500',
  },
  // FAB
  fab: {
    position: 'absolute',
    bottom: 100,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF2D55',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  fabIcon: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '300',
    marginTop: -2,
  },
});
