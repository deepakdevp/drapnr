import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Image,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';

import { useAuthStore } from '../../../stores/authStore';
import { useWardrobeStore } from '../../../stores/wardrobeStore';
import { useCombinationStore } from '../../../stores/combinationStore';
import { useSubscriptionStore } from '../../../stores/subscriptionStore';
import { AvatarScene } from '../../../components/three/AvatarScene';
import type { Garment, GarmentCategory } from '../../../types';

// ── Design tokens ──────────────────────────────────────────────────────────────
const COLORS = {
  primary: '#FF6B6B',
  background: '#FFFFFF',
  text: '#1A1A2E',
  secondaryText: '#6B7280',
  surface: '#F8F9FA',
} as const;

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const VIEWER_HEIGHT = SCREEN_HEIGHT * 0.55;

type Category = 'top' | 'bottom' | 'shoes';

const TAB_LABELS: { key: Category; label: string }[] = [
  { key: 'top', label: 'Tops' },
  { key: 'bottom', label: 'Bottoms' },
  { key: 'shoes', label: 'Shoes' },
];

// ── Component ──────────────────────────────────────────────────────────────────
export default function MixMatchScreen(): React.JSX.Element {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Category>('top');

  // Stores
  const bodyTemplate = useAuthStore((s) => s.bodyTemplate);
  const garments = useWardrobeStore((s) => s.garments);
  const fetchGarments = useWardrobeStore((s) => s.fetchGarments);
  const tier = useSubscriptionStore((s) => s.tier);
  const setCurrentTop = useCombinationStore((s) => s.setCurrentTop);
  const setCurrentBottom = useCombinationStore((s) => s.setCurrentBottom);
  const setCurrentShoes = useCombinationStore((s) => s.setCurrentShoes);
  const currentCombo = useCombinationStore((s) => s.currentCombo);

  const isFreeUser = tier === 'free';

  // Load garments on mount
  useEffect(() => {
    fetchGarments();
  }, [fetchGarments]);

  // Group garments by category
  const groupedGarments = useMemo(() => {
    const groups: Record<Category, Garment[]> = { top: [], bottom: [], shoes: [] };
    for (const g of garments) {
      if (groups[g.category]) groups[g.category].push(g);
    }
    return groups;
  }, [garments]);

  // Find selected garment texture URLs for 3D viewer
  const selectedTop = garments.find((g) => g.id === currentCombo.topId);
  const selectedBottom = garments.find((g) => g.id === currentCombo.bottomId);
  const selectedShoes = garments.find((g) => g.id === currentCombo.shoesId);

  // Resolve body template to model key
  const bodyTemplateKey = bodyTemplate
    ? `${bodyTemplate.gender}_${bodyTemplate.bodyType}`
    : 'female_avg';

  const handleSelectGarment = useCallback(
    (category: Category, id: string) => {
      switch (category) {
        case 'top': setCurrentTop(id); break;
        case 'bottom': setCurrentBottom(id); break;
        case 'shoes': setCurrentShoes(id); break;
      }
    },
    [setCurrentTop, setCurrentBottom, setCurrentShoes],
  );

  const handleSaveCombo = useCallback(() => {
    router.push('/(tabs)/mix-match/save-combo');
  }, [router]);

  const handleUpgrade = useCallback(async () => {
    // Try native RevenueCat paywall first, fall back to custom paywall
    try {
      const { useSubscriptionStore } = await import('../../../stores/subscriptionStore');
      const purchased = await useSubscriptionStore.getState().presentPaywall();
      if (!purchased) {
        router.push('/paywall' as never);
      }
    } catch {
      router.push('/paywall' as never);
    }
  }, [router]);

  // Get selected ID for current category
  const getSelectedId = (category: Category): string | null => {
    switch (category) {
      case 'top': return currentCombo.topId;
      case 'bottom': return currentCombo.bottomId;
      case 'shoes': return currentCombo.shoesId;
    }
  };

  const renderGarmentCard = useCallback(
    ({ item }: { item: Garment }) => {
      const isSelected = getSelectedId(activeTab) === item.id;
      return (
        <TouchableOpacity
          style={[styles.garmentCard, isSelected && styles.garmentCardSelected]}
          onPress={() => handleSelectGarment(activeTab, item.id)}
          activeOpacity={0.7}
        >
          {item.thumbnailUrl ? (
            <Image
              source={{ uri: item.thumbnailUrl }}
              style={styles.garmentThumb}
              resizeMode="cover"
            />
          ) : (
            <View
              style={[styles.garmentThumb, { backgroundColor: item.dominantColor || '#E5E7EB' }]}
            />
          )}
          <Text
            style={[
              styles.garmentName,
              isSelected && styles.garmentNameSelected,
            ]}
            numberOfLines={1}
          >
            {item.metadata.brand ?? item.category}
          </Text>
          {isSelected && <View style={styles.selectedIndicator} />}
        </TouchableOpacity>
      );
    },
    [activeTab, currentCombo, handleSelectGarment],
  );

  return (
    <View style={styles.container}>
      {/* 3D Avatar Viewer */}
      <View style={styles.viewerArea}>
        <AvatarScene
          bodyTemplate={bodyTemplateKey}
          topTexture={selectedTop?.textureUrl ?? null}
          bottomTexture={selectedBottom?.textureUrl ?? null}
          shoesTexture={selectedShoes?.textureUrl ?? null}
          garments={garments}
        />
      </View>

      {/* Bottom sheet area */}
      <View style={styles.bottomSheet}>
        {/* Drag handle */}
        <View style={styles.dragHandle} />

        {/* Category tabs */}
        <View style={styles.tabsRow}>
          {TAB_LABELS.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[
                styles.tab,
                activeTab === tab.key && styles.tabActive,
              ]}
              onPress={() => setActiveTab(tab.key)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === tab.key && styles.tabTextActive,
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Horizontal garment list */}
        {groupedGarments[activeTab].length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No {activeTab}s in your wardrobe yet</Text>
            <Text style={styles.emptySubtext}>Capture an outfit to start mixing</Text>
          </View>
        ) : (
          <FlatList
            data={groupedGarments[activeTab]}
            renderItem={renderGarmentCard}
            keyExtractor={(item) => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.garmentList}
          />
        )}
      </View>

      {/* Save Combo FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={handleSaveCombo}
        activeOpacity={0.8}
      >
        <Text style={styles.fabText}>Save Combo</Text>
      </TouchableOpacity>

      {/* Free user blurred overlay */}
      {isFreeUser && (
        <View style={styles.paywallOverlay}>
          <View style={styles.paywallBlur} />
          <View style={styles.paywallContent}>
            <Text style={styles.paywallTitle}>Mix & Match</Text>
            <Text style={styles.paywallSubtitle}>
              Upgrade to Plus to unlock outfit mixing and create unlimited
              combinations.
            </Text>
            <TouchableOpacity
              style={styles.paywallButton}
              onPress={handleUpgrade}
              activeOpacity={0.7}
            >
              <Text style={styles.paywallButtonText}>Upgrade to Plus</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  // Viewer
  viewerArea: {
    height: VIEWER_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  emptyState: {
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  emptySubtext: {
    fontSize: 12,
    color: COLORS.secondaryText,
    marginTop: 4,
  },

  // Bottom sheet
  bottomSheet: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -20,
    paddingTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 8,
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
    alignSelf: 'center',
    marginBottom: 16,
  },
  tabsRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 8,
    marginBottom: 16,
  },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
  },
  tabActive: {
    backgroundColor: COLORS.text,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.secondaryText,
  },
  tabTextActive: {
    color: COLORS.background,
  },
  garmentList: {
    paddingHorizontal: 20,
    gap: 12,
  },
  garmentCard: {
    width: 100,
    alignItems: 'center',
    padding: 10,
    borderRadius: 14,
    backgroundColor: COLORS.surface,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  garmentCardSelected: {
    borderColor: COLORS.primary,
    backgroundColor: '#FFF5F5',
  },
  garmentThumb: {
    width: 64,
    height: 64,
    borderRadius: 12,
    marginBottom: 8,
    overflow: 'hidden',
  },
  garmentName: {
    fontSize: 11,
    fontWeight: '500',
    color: COLORS.secondaryText,
    textAlign: 'center',
  },
  garmentNameSelected: {
    color: COLORS.text,
    fontWeight: '600',
  },
  selectedIndicator: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
  },

  // FAB
  fab: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 40 : 24,
    right: 20,
    height: 48,
    paddingHorizontal: 24,
    borderRadius: 24,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  fabText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.background,
    letterSpacing: 0.3,
  },

  // Paywall overlay
  paywallOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  paywallBlur: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
  },
  paywallContent: {
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  paywallTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 12,
  },
  paywallSubtitle: {
    fontSize: 15,
    color: COLORS.secondaryText,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  paywallButton: {
    height: 52,
    paddingHorizontal: 40,
    borderRadius: 26,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paywallButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.background,
  },
});
