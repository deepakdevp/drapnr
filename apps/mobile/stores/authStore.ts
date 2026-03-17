// =============================================================================
// Auth Store (Zustand)
// =============================================================================

import { create } from 'zustand';

import type { User, BodyTemplate, Subscription } from '../types';

// -----------------------------------------------------------------------------
// State & Actions
// -----------------------------------------------------------------------------

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  bodyTemplate: BodyTemplate | null;
}

interface AuthActions {
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signOut: () => void;
  setBodyTemplate: (template: BodyTemplate) => void;
  updateProfile: (data: Partial<Pick<User, 'displayName' | 'avatarUrl'>>) => Promise<void>;
  registerPushToken: (token: string) => Promise<void>;
}

type AuthStore = AuthState & AuthActions;

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

const DEFAULT_SUBSCRIPTION: Subscription = {
  tier: 'free',
  isActive: true,
  expiresAt: null,
  productId: null,
};

function createMockUser(email: string, displayName: string): User {
  return {
    id: `usr_${Date.now().toString(36)}`,
    email,
    displayName,
    bodyTemplate: null,
    subscription: { ...DEFAULT_SUBSCRIPTION },
    expoPushToken: null,
    avatarUrl: null,
    createdAt: new Date().toISOString(),
  };
}

/** Simulate a network request. */
const delay = (ms = 800) => new Promise<void>((r) => setTimeout(r, ms));

// -----------------------------------------------------------------------------
// Store
// -----------------------------------------------------------------------------

export const useAuthStore = create<AuthStore>((set, get) => ({
  // -- State ------------------------------------------------------------------
  user: null,
  isAuthenticated: false,
  isLoading: false,
  bodyTemplate: null,

  // -- Actions ----------------------------------------------------------------

  signIn: async (email, _password) => {
    set({ isLoading: true });
    await delay();
    const user = createMockUser(email, email.split('@')[0]);
    set({ user, isAuthenticated: true, isLoading: false, bodyTemplate: user.bodyTemplate });
  },

  signUp: async (name, email, _password) => {
    set({ isLoading: true });
    await delay();
    const user = createMockUser(email, name);
    set({ user, isAuthenticated: true, isLoading: false, bodyTemplate: user.bodyTemplate });
  },

  signOut: () => {
    set({
      user: null,
      isAuthenticated: false,
      bodyTemplate: null,
    });
  },

  setBodyTemplate: (template) => {
    const { user } = get();
    set({
      bodyTemplate: template,
      user: user ? { ...user, bodyTemplate: template } : null,
    });
  },

  updateProfile: async (data) => {
    set({ isLoading: true });
    await delay(500);
    const { user } = get();
    if (user) {
      set({ user: { ...user, ...data }, isLoading: false });
    } else {
      set({ isLoading: false });
    }
  },

  registerPushToken: async (token) => {
    await delay(300);
    const { user } = get();
    if (user) {
      set({ user: { ...user, expoPushToken: token } });
    }
  },
}));
