import { useAuthStore } from "../../stores/authStore";
import type { BodyTemplate } from "../../types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Reset the store to its initial state between tests. */
function resetStore() {
  useAuthStore.setState({
    user: null,
    isAuthenticated: false,
    isLoading: false,
    bodyTemplate: null,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("authStore", () => {
  beforeEach(() => {
    resetStore();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // -- Initial state -------------------------------------------------------

  it("has correct initial state", () => {
    const state = useAuthStore.getState();

    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(state.isLoading).toBe(false);
    expect(state.bodyTemplate).toBeNull();
  });

  // -- signIn --------------------------------------------------------------

  describe("signIn", () => {
    it("sets isLoading while signing in and clears it after", async () => {
      const promise = useAuthStore.getState().signIn("alice@example.com", "password123");

      // Loading should be true immediately
      expect(useAuthStore.getState().isLoading).toBe(true);

      jest.runAllTimers();
      await promise;

      expect(useAuthStore.getState().isLoading).toBe(false);
    });

    it("sets user and isAuthenticated after successful sign in", async () => {
      const promise = useAuthStore.getState().signIn("alice@example.com", "password123");
      jest.runAllTimers();
      await promise;

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(true);
      expect(state.user).not.toBeNull();
      expect(state.user!.email).toBe("alice@example.com");
      expect(state.user!.displayName).toBe("alice");
    });

    it("assigns a free-tier subscription to new sign-ins", async () => {
      const promise = useAuthStore.getState().signIn("bob@example.com", "pass");
      jest.runAllTimers();
      await promise;

      const sub = useAuthStore.getState().user!.subscription;
      expect(sub.tier).toBe("free");
      expect(sub.isActive).toBe(true);
    });
  });

  // -- signUp --------------------------------------------------------------

  describe("signUp", () => {
    it("creates a user with the provided display name", async () => {
      const promise = useAuthStore.getState().signUp("Alice W", "alice@example.com", "pass");
      jest.runAllTimers();
      await promise;

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(true);
      expect(state.user!.displayName).toBe("Alice W");
      expect(state.user!.email).toBe("alice@example.com");
    });

    it("generates a unique user ID", async () => {
      const p1 = useAuthStore.getState().signUp("User1", "u1@test.com", "pass");
      jest.runAllTimers();
      await p1;
      const id1 = useAuthStore.getState().user!.id;

      resetStore();

      const p2 = useAuthStore.getState().signUp("User2", "u2@test.com", "pass");
      jest.runAllTimers();
      await p2;
      const id2 = useAuthStore.getState().user!.id;

      expect(id1).not.toBe(id2);
    });
  });

  // -- signOut -------------------------------------------------------------

  describe("signOut", () => {
    it("clears user, auth state, and body template", async () => {
      // First sign in
      const promise = useAuthStore.getState().signIn("alice@example.com", "pass");
      jest.runAllTimers();
      await promise;

      expect(useAuthStore.getState().isAuthenticated).toBe(true);

      // Now sign out
      useAuthStore.getState().signOut();

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.bodyTemplate).toBeNull();
    });
  });

  // -- setBodyTemplate -----------------------------------------------------

  describe("setBodyTemplate", () => {
    it("sets body template on store and user object", async () => {
      const promise = useAuthStore.getState().signIn("alice@example.com", "pass");
      jest.runAllTimers();
      await promise;

      const template: BodyTemplate = { gender: "female", bodyType: "athletic" };
      useAuthStore.getState().setBodyTemplate(template);

      const state = useAuthStore.getState();
      expect(state.bodyTemplate).toEqual(template);
      expect(state.user!.bodyTemplate).toEqual(template);
    });

    it("updates body template without losing other user data", async () => {
      const promise = useAuthStore.getState().signIn("alice@example.com", "pass");
      jest.runAllTimers();
      await promise;

      const originalEmail = useAuthStore.getState().user!.email;

      const template: BodyTemplate = { gender: "male", bodyType: "slim" };
      useAuthStore.getState().setBodyTemplate(template);

      expect(useAuthStore.getState().user!.email).toBe(originalEmail);
    });

    it("does not set user when no user is signed in", () => {
      const template: BodyTemplate = { gender: "non-binary", bodyType: "average" };
      useAuthStore.getState().setBodyTemplate(template);

      const state = useAuthStore.getState();
      expect(state.bodyTemplate).toEqual(template);
      expect(state.user).toBeNull();
    });
  });

  // -- isAuthenticated derived state ---------------------------------------

  describe("isAuthenticated derived state", () => {
    it("is false when user is null", () => {
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });

    it("becomes true after sign in and false after sign out", async () => {
      const p = useAuthStore.getState().signIn("test@test.com", "pass");
      jest.runAllTimers();
      await p;

      expect(useAuthStore.getState().isAuthenticated).toBe(true);

      useAuthStore.getState().signOut();
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });
  });
});
