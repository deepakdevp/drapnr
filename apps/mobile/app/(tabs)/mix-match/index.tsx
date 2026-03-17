import React, { useCallback, useRef, useState } from 'react';
import {
  Animated,
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

// ── Mock data ──────────────────────────────────────────────────────────────────
interface GarmentItem {
  id: string;
  name: string;
  color: string;
  thumbnail: string; // placeholder color hex
}

type Category = 'tops' | 'bottoms' | 'shoes';

const MOCK_GARMENTS: Record<Category, GarmentItem[]> = {
  tops: [
    { id: 't1', name: 'White T-Shirt', color: '#F9FAFB', thumbnail: '#F9FAFB' },
    { id: 't2', name: 'Black Blazer', color: '#1F2937', thumbnail: '#1F2937' },
    { id: 't3', name: 'Coral Hoodie', color: '#FF6B6B', thumbnail: '#FF6B6B' },
    { id: 't4', name: 'Denim Jacket', color: '#60A5FA', thumbnail: '#60A5FA' },
    { id: 't5', name: 'Grey Sweater', color: '#9CA3AF', thumbnail: '#9CA3AF' },
  ],
  bottoms: [
    { id: 'b1', name: 'Blue Jeans', color: '#3B82F6', thumbnail: '#3B82F6' },
    { id: 'b2', name: 'Black Trousers', color: '#111827', thumbnail: '#111827' },
    { id: 'b3', name: 'Khaki Chinos', color: '#D2B48C', thumbnail: '#D2B48C' },
    { id: 'b4', name: 'White Shorts', color: '#F3F4F6', thumbnail: '#F3F4F6' },
  ],
  shoes: [
    { id: 's1', name: 'White Sneakers', color: '#FAFAFA', thumbnail: '#FAFAFA' },
    { id: 's2', name: 'Black Boots', color: '#1C1917', thumbnail: '#1C1917' },
    { id: 's3', name: 'Brown Loafers', color: '#92400E', thumbnail: '#92400E' },
  ],
};

const TAB_LABELS: { key: Category; label: string }[] = [
  { key: 'tops', label: 'Tops' },
  { key: 'bottoms', label: 'Bottoms' },
  { key: 'shoes', label: 'Shoes' },
];

const IS_FREE_USER = false; // Toggle to true to test paywall overlay

// ── Component ──────────────────────────────────────────────────────────────────
export default function MixMatchScreen(): React.JSX.Element {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Category>('tops');
  const [selected, setSelected] = useState<Record<Category, string | null>>({
    tops: 't1',
    bottoms: 'b1',
    shoes: 's1',
  });

  // Avatar rotation mock
  const rotateAnim = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 12_000,
        useNativeDriver: true,
      }),
    ).start();
  }, [rotateAnim]);

  const avatarRotation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const handleSelectGarment = useCallback(
    (category: Category, id: string) => {
      setSelected((prev) => ({ ...prev, [category]: id }));
    },
    [],
  );

  const handleSaveCombo = useCallback(() => {
    router.push('/(tabs)/mix-match/save-combo');
  }, [router]);

  const handleUpgrade = useCallback(() => {
    router.push('/paywall' as never);
  }, [router]);

  // ── Render garment card ─────────────────────────────────────────────────
  const renderGarmentCard = useCallback(
    ({ item }: { item: GarmentItem }) => {
      const isSelected = selected[activeTab] === item.id;
      return (
        <TouchableOpacity
          style={[styles.garmentCard, isSelected && styles.garmentCardSelected]}
          onPress={() => handleSelectGarment(activeTab, item.id)}
          activeOpacity={0.7}
        >
          <View
            style={[styles.garmentThumb, { backgroundColor: item.color }]}
          />
          <Text
            style={[
              styles.garmentName,
              isSelected && styles.garmentNameSelected,
            ]}
            numberOfLines={1}
          >
            {item.name}
          </Text>
          {isSelected && <View style={styles.selectedIndicator} />}
        </TouchableOpacity>
      );
    },
    [activeTab, selected, handleSelectGarment],
  );

  return (
    <View style={styles.container}>
      {/* 3D Viewer Area */}
      <View style={styles.viewerArea}>
        {/* Gradient placeholder */}
        <View style={styles.gradientBg}>
          <View style={styles.gradientTop} />
          <View style={styles.gradientBottom} />
        </View>

        {/* Rotating avatar silhouette */}
        <Animated.View
          style={[
            styles.avatarSilhouette,
            { transform: [{ rotateY: avatarRotation }] },
          ]}
        >
          <View style={styles.avatarHead} />
          <View style={styles.avatarTorso}>
            <View
              style={[
                styles.avatarTorsoColor,
                {
                  backgroundColor:
                    MOCK_GARMENTS.tops.find(
                      (g) => g.id === selected.tops,
                    )?.color ?? '#CCC',
                },
              ]}
            />
          </View>
          <View style={styles.avatarLegs}>
            <View
              style={[
                styles.avatarLegsColor,
                {
                  backgroundColor:
                    MOCK_GARMENTS.bottoms.find(
                      (g) => g.id === selected.bottoms,
                    )?.color ?? '#CCC',
                },
              ]}
            />
          </View>
          <View style={styles.avatarFeet}>
            <View
              style={[
                styles.avatarFeetColor,
                {
                  backgroundColor:
                    MOCK_GARMENTS.shoes.find(
                      (g) => g.id === selected.shoes,
                    )?.color ?? '#CCC',
                },
              ]}
            />
          </View>
        </Animated.View>

        <Text style={styles.viewerHint}>3D Preview</Text>
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
        <FlatList
          data={MOCK_GARMENTS[activeTab]}
          renderItem={renderGarmentCard}
          keyExtractor={(item) => item.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.garmentList}
        />
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
      {IS_FREE_USER && (
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
  gradientBg: {
    ...StyleSheet.absoluteFillObject,
  },
  gradientTop: {
    flex: 1,
    backgroundColor: '#F0F0F5',
  },
  gradientBottom: {
    flex: 1,
    backgroundColor: '#E8E8EE',
  },
  avatarSilhouette: {
    alignItems: 'center',
  },
  avatarHead: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#D1D5DB',
  },
  avatarTorso: {
    width: 70,
    height: 80,
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: -4,
  },
  avatarTorsoColor: {
    flex: 1,
    borderRadius: 12,
  },
  avatarLegs: {
    width: 60,
    height: 90,
    borderRadius: 8,
    overflow: 'hidden',
    marginTop: 2,
  },
  avatarLegsColor: {
    flex: 1,
    borderRadius: 8,
  },
  avatarFeet: {
    width: 50,
    height: 20,
    borderRadius: 10,
    overflow: 'hidden',
    marginTop: 2,
  },
  avatarFeetColor: {
    flex: 1,
    borderRadius: 10,
  },
  viewerHint: {
    position: 'absolute',
    bottom: 12,
    color: COLORS.secondaryText,
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 1,
    textTransform: 'uppercase',
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
