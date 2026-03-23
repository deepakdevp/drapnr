// =============================================================================
// Auth Store (Zustand)
// =============================================================================
// Real Supabase Auth integration with email/password, Apple, and Google
// sign-in. Manages user profile, body template, and push token.
// =============================================================================

import { create } from 'zustand';

import {
  supabase,
  signInWithEmail,
  signUpWithEmail,
  signInWithAppleToken,
  signInWithGoogleToken,
  signOut as supabaseSignOut,
  getSession,
  onAuthStateChange,
  fetchUserProfile,
  updateUserProfile,
} from '../services/supabase';
import { clearCache } from '../services/offline';
import { createLogger } from '../utils/logger';
import type { User, BodyTemplate, Subscription } from '../types';

const log = createLogger('authStore');

// -----------------------------------------------------------------------------
// State & Actions
// -----------------------------------------------------------------------------

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  bodyTemplate: BodyTemplate | null;
  error: string | null;
}

interface AuthActions {
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signInWithApple: (identityToken: string, nonce: string) => Promise<void>;
  signInWithGoogle: (idToken: string, accessToken: string) => Promise<void>;
  signOut: () => Promise<void>;
  loadUser: () => Promise<void>;
  setBodyTemplate: (template: BodyTemplate) => Promise<void>;
  updateProfile: (data: Partial<Pick<User, 'displayName' | 'avatarUrl'>>) => Promise<void>;
  registerPushToken: (token: string) => Promise<void>;
  initialize: () => Promise<void>;
  clearError: () => void;
}

type AuthStore = AuthState & AuthActions;

// -----------------------------------------------------------------------------
// Store
// -----------------------------------------------------------------------------

export const useAuthStore = create<AuthStore>((set, get) => ({
  // -- State ------------------------------------------------------------------
  user: null,
  isAuthenticated: false,
  isLoading: false,
  bodyTemplate: null,
  error: null,

  // -- Actions ----------------------------------------------------------------

  clearError: () => set({ error: null }),

  /**
   * Initialize auth state: check for existing session and listen for changes.
   */
  initialize: async () => {
    set({ isLoading: true });

    try {
      const { data } = await getSession();

      if (data.session?.user) {
        const userId = data.session.user.id;
        const profileResult = await fetchUserProfile(userId);

        if (profileResult.data) {
          set({
            user: profileResult.data,
            isAuthenticated: true,
            bodyTemplate: profileResult.data.bodyTemplate,
          });
        } else {
          // Session exists but no profile row yet — construct minimal user
          const authUser = data.session.user;
          set({
            user: {
              id: authUser.id,
              email: authUser.email ?? '',
              displayName: authUser.user_metadata?.display_name ?? authUser.email?.split('@')[0] ?? '',
              bodyTemplate: null,
              subscription: { tier: 'free', isActive: true, expiresAt: null, productId: null },
              expoPushToken: null,
              avatarUrl: authUser.user_metadata?.avatar_url ?? null,
              createdAt: authUser.created_at,
            },
            isAuthenticated: true,
          });
        }
      }
    } catch (err: any) {
      log.error('initialize error:', err.message);
    } finally {
      set({ isLoading: false });
    }

    // Listen for auth state changes (token refresh, sign out from another tab, etc.)
    onAuthStateChange(async (event: string, session: any) => {
      if (event === 'SIGNED_OUT' || !session) {
        set({ user: null, isAuthenticated: false, bodyTemplate: null });
        return;
      }

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        const userId = session.user?.id;
        if (userId && !get().user) {
          const profileResult = await fetchUserProfile(userId);
          if (profileResult.data) {
            set({
              user: profileResult.data,
              isAuthenticated: true,
              bodyTemplate: profileResult.data.bodyTemplate,
            });
          }
        }
      }
    });
  },

  signIn: async (email, password) => {
    set({ isLoading: true, error: null });

    try {
      const result = await signInWithEmail(email, password);

      if (result.error) {
        set({ isLoading: false, error: result.error.message });
        return;
      }

      if (result.data) {
        set({
          user: result.data,
          isAuthenticated: true,
          bodyTemplate: result.data.bodyTemplate,
          isLoading: false,
        });
      }
    } catch (err: any) {
      set({ isLoading: false, error: err.message ?? 'Sign in failed. Please try again.' });
    }
  },

  signUp: async (name, email, password) => {
    set({ isLoading: true, error: null });

    try {
      const result = await signUpWithEmail(email, password, name);

      if (result.error) {
        set({ isLoading: false, error: result.error.message });
        return;
      }

      if (result.data) {
        set({
          user: result.data,
          isAuthenticated: true,
          bodyTemplate: result.data.bodyTemplate,
          isLoading: false,
        });
      }
    } catch (err: any) {
      set({ isLoading: false, error: err.message ?? 'Sign up failed. Please try again.' });
    }
  },

  signInWithApple: async (identityToken, nonce) => {
    set({ isLoading: true, error: null });

    try {
      const result = await signInWithAppleToken(identityToken, nonce);

      if (result.error) {
        set({ isLoading: false, error: result.error.message });
        return;
      }

      if (result.data) {
        set({
          user: result.data,
          isAuthenticated: true,
          bodyTemplate: result.data.bodyTemplate,
          isLoading: false,
        });
      }
    } catch (err: any) {
      set({ isLoading: false, error: err.message ?? 'Apple sign in failed.' });
    }
  },

  signInWithGoogle: async (idToken, accessToken) => {
    set({ isLoading: true, error: null });

    try {
      const result = await signInWithGoogleToken(idToken, accessToken);

      if (result.error) {
        set({ isLoading: false, error: result.error.message });
        return;
      }

      if (result.data) {
        set({
          user: result.data,
          isAuthenticated: true,
          bodyTemplate: result.data.bodyTemplate,
          isLoading: false,
        });
      }
    } catch (err: any) {
      set({ isLoading: false, error: err.message ?? 'Google sign in failed.' });
    }
  },

  signOut: async () => {
    set({ isLoading: true });

    try {
      await supabaseSignOut();
      await clearCache();
    } catch (err: any) {
      log.error('signOut error:', err.message);
    } finally {
      set({
        user: null,
        isAuthenticated: false,
        bodyTemplate: null,
        isLoading: false,
        error: null,
      });
    }
  },

  loadUser: async () => {
    const { user } = get();
    if (!user) return;

    set({ isLoading: true });

    try {
      const result = await fetchUserProfile(user.id);

      if (result.data) {
        set({
          user: result.data,
          bodyTemplate: result.data.bodyTemplate,
          isLoading: false,
        });
      } else {
        set({ isLoading: false });
      }
    } catch (err: any) {
      log.error('loadUser error:', err.message);
      set({ isLoading: false });
    }
  },

  setBodyTemplate: async (template) => {
    const { user } = get();
    if (!user) return;

    set({ bodyTemplate: template });

    try {
      const result = await updateUserProfile(user.id, { body_template: template });

      if (result.data) {
        set({ user: result.data });
      } else if (result.error) {
        log.error('setBodyTemplate error:', result.error.message);
      }
    } catch (err: any) {
      log.error('setBodyTemplate error:', err.message);
    }
  },

  updateProfile: async (data) => {
    const { user } = get();
    if (!user) return;

    set({ isLoading: true, error: null });

    try {
      const updates: Record<string, unknown> = {};
      if (data.displayName !== undefined) updates.display_name = data.displayName;
      if (data.avatarUrl !== undefined) updates.avatar_url = data.avatarUrl;

      const result = await updateUserProfile(user.id, updates);

      if (result.error) {
        set({ isLoading: false, error: result.error.message });
        return;
      }

      if (result.data) {
        set({ user: result.data, isLoading: false });
      }
    } catch (err: any) {
      set({ isLoading: false, error: err.message ?? 'Failed to update profile.' });
    }
  },

  registerPushToken: async (token) => {
    const { user } = get();
    if (!user) return;

    try {
      const result = await updateUserProfile(user.id, { expo_push_token: token });

      if (result.data) {
        set({ user: result.data });
      } else if (result.error) {
        log.error('registerPushToken error:', result.error.message);
      }
    } catch (err: any) {
      log.error('registerPushToken error:', err.message);
    }
  },
}));
