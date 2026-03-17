// =============================================================================
// Drapnr — Garment Picker Bottom Sheet
// =============================================================================

import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Image,
  Pressable,
} from 'react-native';
import type { Garment, GarmentCategory } from '@/types';

// -----------------------------------------------------------------------------
// Colors (Drapnr palette)
// -----------------------------------------------------------------------------

const COLORS = {
  primary: '#FF6B6B',
  background: '#FFFFFF',
  text: '#1A1A2E',
  textSecondary: '#6B7280',
  surface: '#F8F9FA',
  border: '#E5E7EB',
  selectedBorder: '#FF6B6B',
} as const;

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface GarmentPickerProps {
  garments: Garment[];
  selectedTopId: string | null;
  selectedBottomId: string | null;
  selectedShoesId: string | null;
  onSelectGarment: (id: string, category: GarmentCategory) => void;
}

interface TabConfig {
  key: GarmentCategory;
  label: string;
}

const TABS: TabConfig[] = [
  { key: 'top', label: 'Tops' },
  { key: 'bottom', label: 'Bottoms' },
  { key: 'shoes', label: 'Shoes' },
];

// Card dimensions
const CARD_WIDTH = 60;
const CARD_HEIGHT = 80;
const CARD_BORDER_RADIUS = 10;

// -----------------------------------------------------------------------------
// Garment Card
// -----------------------------------------------------------------------------

interface GarmentCardProps {
  garment: Garment;
  isSelected: boolean;
  onPress: () => void;
}

function GarmentCard({ garment, isSelected, onPress }: GarmentCardProps) {
  return (
    <TouchableOpacity
      style={[styles.card, isSelected && styles.cardSelected]}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
      accessibilityLabel={`${garment.metadata.brand ?? ''} ${garment.category} garment`}
    >
      <Image
        source={{ uri: garment.thumbnailUrl }}
        style={styles.cardImage}
        resizeMode="cover"
      />
      {isSelected && (
        <View style={styles.checkmarkOverlay}>
          <Text style={styles.checkmark}>✓</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

// -----------------------------------------------------------------------------
// Empty State
// -----------------------------------------------------------------------------

function EmptyCategory({ category }: { category: string }) {
  return (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>
        No {category.toLowerCase()} in your wardrobe yet.
      </Text>
      <Text style={styles.emptySubtext}>
        Capture an outfit to start mixing and matching.
      </Text>
    </View>
  );
}

// -----------------------------------------------------------------------------
// Main Component
// -----------------------------------------------------------------------------

export function GarmentPicker({
  garments,
  selectedTopId,
  selectedBottomId,
  selectedShoesId,
  onSelectGarment,
}: GarmentPickerProps): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<GarmentCategory>('top');

  // Group garments by category
  const groupedGarments = useMemo(() => {
    const groups: Record<GarmentCategory, Garment[]> = {
      top: [],
      bottom: [],
      shoes: [],
    };
    for (const g of garments) {
      if (groups[g.category]) {
        groups[g.category].push(g);
      }
    }
    return groups;
  }, [garments]);

  // Selected ID for current tab
  const getSelectedId = useCallback(
    (category: GarmentCategory): string | null => {
      switch (category) {
        case 'top':
          return selectedTopId;
        case 'bottom':
          return selectedBottomId;
        case 'shoes':
          return selectedShoesId;
      }
    },
    [selectedTopId, selectedBottomId, selectedShoesId],
  );

  const currentGarments = groupedGarments[activeTab];
  const currentSelectedId = getSelectedId(activeTab);

  const handleSelect = useCallback(
    (id: string) => {
      onSelectGarment(id, activeTab);
    },
    [activeTab, onSelectGarment],
  );

  const renderGarmentCard = useCallback(
    ({ item }: { item: Garment }) => (
      <GarmentCard
        garment={item}
        isSelected={item.id === currentSelectedId}
        onPress={() => handleSelect(item.id)}
      />
    ),
    [currentSelectedId, handleSelect],
  );

  const keyExtractor = useCallback((item: Garment) => item.id, []);

  return (
    <View style={styles.container}>
      {/* Tab Bar */}
      <View style={styles.tabBar}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          const count = groupedGarments[tab.key].length;
          return (
            <Pressable
              key={tab.key}
              style={[styles.tab, isActive && styles.tabActive]}
              onPress={() => setActiveTab(tab.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
            >
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                {tab.label}
              </Text>
              <View
                style={[styles.badge, isActive && styles.badgeActive]}
              >
                <Text
                  style={[
                    styles.badgeText,
                    isActive && styles.badgeTextActive,
                  ]}
                >
                  {count}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* Garment List */}
      {currentGarments.length === 0 ? (
        <EmptyCategory category={activeTab} />
      ) : (
        <FlatList
          data={currentGarments}
          renderItem={renderGarmentCard}
          keyExtractor={keyExtractor}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={ListSeparator}
        />
      )}
    </View>
  );
}

function ListSeparator() {
  return <View style={styles.separator} />;
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.background,
    paddingVertical: 12,
  },
  // Tab bar
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 12,
    gap: 8,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    gap: 6,
  },
  tabActive: {
    backgroundColor: COLORS.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  tabTextActive: {
    color: COLORS.background,
  },
  badge: {
    backgroundColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
    minWidth: 20,
    alignItems: 'center',
  },
  badgeActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  badgeTextActive: {
    color: COLORS.background,
  },
  // Garment list
  listContent: {
    paddingHorizontal: 16,
  },
  separator: {
    width: 10,
  },
  // Cards
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: CARD_BORDER_RADIUS,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  cardSelected: {
    borderColor: COLORS.selectedBorder,
    borderWidth: 2.5,
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  checkmarkOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 107, 107, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmark: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.background,
  },
  // Empty state
  emptyContainer: {
    paddingHorizontal: 24,
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 4,
  },
});

export default GarmentPicker;
