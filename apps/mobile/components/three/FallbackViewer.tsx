// =============================================================================
// Drapnr -- 2D Fallback Viewer (when 3D is unavailable)
// =============================================================================

import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';

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
} as const;

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface FallbackViewerProps {
  topTexture: string | null;
  bottomTexture: string | null;
  shoesTexture: string | null;
}

interface GarmentCardData {
  label: string;
  zone: 'top' | 'bottom' | 'shoes';
  url: string | null;
}

// -----------------------------------------------------------------------------
// Garment Card
// -----------------------------------------------------------------------------

function GarmentCard({ label, url }: { label: string; url: string | null }) {
  return (
    <View style={styles.card}>
      {url ? (
        <Image
          source={{ uri: url }}
          style={styles.cardImage}
          resizeMode="cover"
          accessibilityLabel={`${label} garment texture`}
        />
      ) : (
        <View style={styles.cardPlaceholder}>
          <Text style={styles.cardPlaceholderText}>No {label.toLowerCase()}</Text>
        </View>
      )}
      <View style={styles.cardLabelContainer}>
        <Text style={styles.cardLabel}>{label}</Text>
      </View>
    </View>
  );
}

// -----------------------------------------------------------------------------
// Main Component
// -----------------------------------------------------------------------------

export function FallbackViewer({
  topTexture,
  bottomTexture,
  shoesTexture,
}: FallbackViewerProps): React.JSX.Element {
  const cards: GarmentCardData[] = [
    { label: 'Top', zone: 'top', url: topTexture },
    { label: 'Bottom', zone: 'bottom', url: bottomTexture },
    { label: 'Shoes', zone: 'shoes', url: shoesTexture },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.banner}>
        <Text style={styles.bannerText}>
          3D view unavailable on this device
        </Text>
      </View>

      <View style={styles.cardsContainer}>
        {cards.map((card) => (
          <GarmentCard key={card.zone} label={card.label} url={card.url} />
        ))}
      </View>
    </View>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  banner: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  bannerText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  cardsContainer: {
    width: '100%',
    alignItems: 'center',
    gap: 16,
  },
  card: {
    width: '100%',
    maxWidth: 300,
    height: 140,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  cardPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardPlaceholderText: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  cardLabelContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(26, 26, 46, 0.7)',
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  cardLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.background,
  },
});

export default FallbackViewer;
