// =============================================================================
// Wardrobe Store (Zustand)
// =============================================================================

import { create } from 'zustand';

export interface Garment {
  id: string;
  type: 'top' | 'bottom' | 'shoes' | 'accessory';
  name: string;
  thumbnailUrl: string | null;
  color: string;
}

export interface Outfit {
  id: string;
  name: string;
  createdAt: string;
  thumbnailUrl: string | null;
  garments: Garment[];
}

interface WardrobeState {
  outfits: Outfit[];
  isLoading: boolean;
  isRefreshing: boolean;

  // Actions
  loadOutfits: () => Promise<void>;
  refreshOutfits: () => Promise<void>;
  deleteOutfit: (id: string) => void;
  updateOutfitName: (id: string, name: string) => void;
}

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const MOCK_OUTFITS: Outfit[] = [
  {
    id: '1',
    name: 'Casual Friday',
    createdAt: '2026-03-15',
    thumbnailUrl: null,
    garments: [
      { id: 'g1', type: 'top', name: 'White Tee', thumbnailUrl: null, color: '#FFFFFF' },
      { id: 'g2', type: 'bottom', name: 'Dark Jeans', thumbnailUrl: null, color: '#1A1A2E' },
      { id: 'g3', type: 'shoes', name: 'White Sneakers', thumbnailUrl: null, color: '#F5F5F5' },
    ],
  },
  {
    id: '2',
    name: 'Date Night',
    createdAt: '2026-03-14',
    thumbnailUrl: null,
    garments: [
      { id: 'g4', type: 'top', name: 'Black Blazer', thumbnailUrl: null, color: '#212121' },
      { id: 'g5', type: 'bottom', name: 'Slim Chinos', thumbnailUrl: null, color: '#8B7355' },
      { id: 'g6', type: 'shoes', name: 'Chelsea Boots', thumbnailUrl: null, color: '#5C4033' },
    ],
  },
  {
    id: '3',
    name: 'Gym Session',
    createdAt: '2026-03-13',
    thumbnailUrl: null,
    garments: [
      { id: 'g7', type: 'top', name: 'Tank Top', thumbnailUrl: null, color: '#FF2D55' },
      { id: 'g8', type: 'bottom', name: 'Joggers', thumbnailUrl: null, color: '#424242' },
      { id: 'g9', type: 'shoes', name: 'Running Shoes', thumbnailUrl: null, color: '#3B82F6' },
    ],
  },
  {
    id: '4',
    name: 'Summer Vibes',
    createdAt: '2026-03-12',
    thumbnailUrl: null,
    garments: [
      { id: 'g10', type: 'top', name: 'Linen Shirt', thumbnailUrl: null, color: '#E8DCC8' },
      { id: 'g11', type: 'bottom', name: 'Shorts', thumbnailUrl: null, color: '#F5F5DC' },
      { id: 'g12', type: 'shoes', name: 'Sandals', thumbnailUrl: null, color: '#C19A6B' },
    ],
  },
];

export const useWardrobeStore = create<WardrobeState>((set) => ({
  outfits: [],
  isLoading: false,
  isRefreshing: false,

  loadOutfits: async () => {
    set({ isLoading: true });
    await new Promise((resolve) => setTimeout(resolve, 600));
    set({ outfits: MOCK_OUTFITS, isLoading: false });
  },

  refreshOutfits: async () => {
    set({ isRefreshing: true });
    await new Promise((resolve) => setTimeout(resolve, 500));
    set({ outfits: MOCK_OUTFITS, isRefreshing: false });
  },

  deleteOutfit: (id: string) => {
    set((state) => ({
      outfits: state.outfits.filter((o) => o.id !== id),
    }));
  },

  updateOutfitName: (id: string, name: string) => {
    set((state) => ({
      outfits: state.outfits.map((o) => (o.id === id ? { ...o, name } : o)),
    }));
  },
}));
