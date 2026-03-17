// =============================================================================
// Combination Store (Zustand) — Mix & Match
// =============================================================================
// Real Supabase queries for saving, fetching, and deleting garment
// combinations. Manages the current mix & match session state.
// =============================================================================

import { create } from 'zustand';

import {
  fetchCombinations as fetchCombinationsApi,
  insertCombination,
  deleteCombination as deleteCombinationApi,
} from '../services/supabase';
import { useAuthStore } from './authStore';
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
  error: string | null;
}

interface CombinationActions {
  fetchCombinations: () => Promise<void>;
  saveCombination: (name: string, thumbnailUrl?: string | null) => Promise<Combination>;
  deleteCombination: (id: string) => Promise<void>;
  setCurrentTop: (id: string) => void;
  setCurrentBottom: (id: string) => void;
  setCurrentShoes: (id: string) => void;
  resetCurrentCombo: () => void;
  clearError: () => void;
}

type CombinationStore = CombinationState & CombinationActions;

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const EMPTY_COMBO: CurrentCombo = {
  topId: null,
  bottomId: null,
  shoesId: null,
};

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function getUserId(): string | null {
  return useAuthStore.getState().user?.id ?? null;
}

// -----------------------------------------------------------------------------
// Store
// -----------------------------------------------------------------------------

export const useCombinationStore = create<CombinationStore>((set, get) => ({
  // -- State ------------------------------------------------------------------
  combinations: [],
  currentCombo: { ...EMPTY_COMBO },
  isLoading: false,
  error: null,

  // -- Actions ----------------------------------------------------------------

  clearError: () => set({ error: null }),

  fetchCombinations: async () => {
    const userId = getUserId();
    if (!userId) {
      set({ error: 'Not authenticated' });
      return;
    }

    set({ isLoading: true, error: null });

    try {
      const result = await fetchCombinationsApi(userId);

      if (result.error) {
        set({ isLoading: false, error: result.error.message });
        return;
      }

      set({ combinations: result.data ?? [], isLoading: false });
    } catch (err: any) {
      set({
        isLoading: false,
        error: err.message ?? 'Failed to load combinations.',
      });
    }
  },

  saveCombination: async (name, thumbnailUrl = null) => {
    const userId = getUserId();
    if (!userId) {
      throw new Error('Not authenticated');
    }

    const { currentCombo } = get();

    if (!currentCombo.topId || !currentCombo.bottomId || !currentCombo.shoesId) {
      const msg = 'Please select a top, bottom, and shoes before saving.';
      set({ error: msg });
      throw new Error(msg);
    }

    set({ isLoading: true, error: null });

    try {
      const result = await insertCombination({
        userId,
        name,
        topId: currentCombo.topId,
        bottomId: currentCombo.bottomId,
        shoesId: currentCombo.shoesId,
        thumbnailUrl: thumbnailUrl ?? null,
      });

      if (result.error || !result.data) {
        const msg = result.error?.message ?? 'Failed to save combination.';
        set({ isLoading: false, error: msg });
        throw new Error(msg);
      }

      // Prepend the new combination to the list
      set((state) => ({
        combinations: [result.data!, ...state.combinations],
        isLoading: false,
      }));

      return result.data;
    } catch (err: any) {
      if (get().isLoading) {
        set({ isLoading: false });
      }
      // Re-throw if not already set as error
      if (!get().error) {
        set({ error: err.message ?? 'Failed to save combination.' });
      }
      throw err;
    }
  },

  deleteCombination: async (id) => {
    // Optimistically remove from state
    const previousCombinations = get().combinations;
    set((state) => ({
      combinations: state.combinations.filter((c) => c.id !== id),
    }));

    try {
      const result = await deleteCombinationApi(id);

      if (result.error) {
        // Revert on failure
        set({
          combinations: previousCombinations,
          error: result.error.message,
        });
      }
    } catch (err: any) {
      // Revert on failure
      set({
        combinations: previousCombinations,
        error: err.message ?? 'Failed to delete combination.',
      });
    }
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
