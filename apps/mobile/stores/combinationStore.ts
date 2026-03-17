// =============================================================================
// Combination Store (Zustand) — Mix & Match
// =============================================================================

import { create } from 'zustand';

import type { Combination } from '../types';

// -----------------------------------------------------------------------------
// State & Actions
// -----------------------------------------------------------------------------

interface CurrentCombo {
  topId: string | null;
  bottomId: string | null;
  shoesId: string | null;
}

interface CombinationState {
  combinations: Combination[];
  currentCombo: CurrentCombo;
  isLoading: boolean;
}

interface CombinationActions {
  fetchCombinations: () => Promise<void>;
  saveCombination: (name: string) => Promise<Combination>;
  deleteCombination: (id: string) => void;
  setCurrentTop: (id: string) => void;
  setCurrentBottom: (id: string) => void;
  setCurrentShoes: (id: string) => void;
  resetCurrentCombo: () => void;
}

type CombinationStore = CombinationState & CombinationActions;

// -----------------------------------------------------------------------------
// Mock Data
// -----------------------------------------------------------------------------

const MOCK_COMBINATIONS: Combination[] = [
  {
    id: 'combo_001',
    userId: 'usr_demo',
    name: 'Smart Casual Mix',
    topId: 'garment_001',
    bottomId: 'garment_005',
    shoesId: 'garment_006',
    thumbnailUrl: null,
    createdAt: '2026-03-14T10:00:00Z',
  },
  {
    id: 'combo_002',
    userId: 'usr_demo',
    name: 'Relaxed Sunday',
    topId: 'garment_007',
    bottomId: 'garment_002',
    shoesId: 'garment_009',
    thumbnailUrl: null,
    createdAt: '2026-03-15T16:30:00Z',
  },
];

const EMPTY_COMBO: CurrentCombo = {
  topId: null,
  bottomId: null,
  shoesId: null,
};

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

const delay = (ms = 600) => new Promise<void>((r) => setTimeout(r, ms));

// -----------------------------------------------------------------------------
// Store
// -----------------------------------------------------------------------------

export const useCombinationStore = create<CombinationStore>((set, get) => ({
  // -- State ------------------------------------------------------------------
  combinations: [],
  currentCombo: { ...EMPTY_COMBO },
  isLoading: false,

  // -- Actions ----------------------------------------------------------------

  fetchCombinations: async () => {
    set({ isLoading: true });
    await delay();
    set({ combinations: [...MOCK_COMBINATIONS], isLoading: false });
  },

  saveCombination: async (name) => {
    set({ isLoading: true });
    await delay(400);

    const { currentCombo } = get();

    if (!currentCombo.topId || !currentCombo.bottomId || !currentCombo.shoesId) {
      set({ isLoading: false });
      throw new Error('Please select a top, bottom, and shoes before saving.');
    }

    const combination: Combination = {
      id: `combo_${Date.now().toString(36)}`,
      userId: 'usr_demo',
      name,
      topId: currentCombo.topId,
      bottomId: currentCombo.bottomId,
      shoesId: currentCombo.shoesId,
      thumbnailUrl: null,
      createdAt: new Date().toISOString(),
    };

    set((state) => ({
      combinations: [combination, ...state.combinations],
      isLoading: false,
    }));

    return combination;
  },

  deleteCombination: (id) => {
    set((state) => ({
      combinations: state.combinations.filter((c) => c.id !== id),
    }));
  },

  setCurrentTop: (id) => {
    set((state) => ({ currentCombo: { ...state.currentCombo, topId: id } }));
  },

  setCurrentBottom: (id) => {
    set((state) => ({ currentCombo: { ...state.currentCombo, bottomId: id } }));
  },

  setCurrentShoes: (id) => {
    set((state) => ({ currentCombo: { ...state.currentCombo, shoesId: id } }));
  },

  resetCurrentCombo: () => {
    set({ currentCombo: { ...EMPTY_COMBO } });
  },
}));
