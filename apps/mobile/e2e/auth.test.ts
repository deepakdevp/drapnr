// =============================================================================
// E2E Test Stubs — Authentication Flows
//
// These are Detox E2E test stubs. They define the test structure and
// expectations for the core auth flows. Fill in element matchers once
// the UI screens are finalized.
// =============================================================================

import { by, device, element, expect as detoxExpect } from "detox";

describe("Authentication E2E", () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
  });

  beforeEach(async () => {
    await device.reloadReactNative();
  });

  // -------------------------------------------------------------------------
  // Login flow
  // -------------------------------------------------------------------------

  describe("Login flow", () => {
    it("should display the sign-in screen", async () => {
      await detoxExpect(element(by.id("sign-in-screen"))).toBeVisible();
    });

    it("should show email and password inputs", async () => {
      await detoxExpect(element(by.id("email-input"))).toBeVisible();
      await detoxExpect(element(by.id("password-input"))).toBeVisible();
    });

    it("should show validation error for empty fields", async () => {
      await element(by.id("sign-in-button")).tap();
      await detoxExpect(element(by.id("validation-error"))).toBeVisible();
    });

    it("should navigate to wardrobe after successful login", async () => {
      await element(by.id("email-input")).typeText("test@drapnr.com");
      await element(by.id("password-input")).typeText("password123");
      await element(by.id("sign-in-button")).tap();

      // Wait for navigation to complete
      await waitFor(element(by.id("wardrobe-screen")))
        .toBeVisible()
        .withTimeout(5000);
    });

    it("should show error message for invalid credentials", async () => {
      await element(by.id("email-input")).typeText("wrong@example.com");
      await element(by.id("password-input")).typeText("wrongpass");
      await element(by.id("sign-in-button")).tap();

      await waitFor(element(by.id("auth-error")))
        .toBeVisible()
        .withTimeout(3000);
    });
  });

  // -------------------------------------------------------------------------
  // Signup flow
  // -------------------------------------------------------------------------

  describe("Signup flow", () => {
    it("should navigate to sign-up screen from sign-in", async () => {
      await element(by.id("go-to-signup-link")).tap();
      await detoxExpect(element(by.id("sign-up-screen"))).toBeVisible();
    });

    it("should display name, email, and password inputs", async () => {
      await element(by.id("go-to-signup-link")).tap();

      await detoxExpect(element(by.id("name-input"))).toBeVisible();
      await detoxExpect(element(by.id("email-input"))).toBeVisible();
      await detoxExpect(element(by.id("password-input"))).toBeVisible();
    });

    it("should create account and navigate to onboarding", async () => {
      await element(by.id("go-to-signup-link")).tap();

      await element(by.id("name-input")).typeText("Test User");
      await element(by.id("email-input")).typeText("newuser@drapnr.com");
      await element(by.id("password-input")).typeText("securePass123!");
      await element(by.id("sign-up-button")).tap();

      await waitFor(element(by.id("onboarding-screen")))
        .toBeVisible()
        .withTimeout(5000);
    });

    it("should show error for existing email", async () => {
      await element(by.id("go-to-signup-link")).tap();

      await element(by.id("name-input")).typeText("Duplicate");
      await element(by.id("email-input")).typeText("existing@drapnr.com");
      await element(by.id("password-input")).typeText("password123");
      await element(by.id("sign-up-button")).tap();

      await waitFor(element(by.id("auth-error")))
        .toBeVisible()
        .withTimeout(3000);
    });
  });

  // -------------------------------------------------------------------------
  // Onboarding completion
  // -------------------------------------------------------------------------

  describe("Onboarding completion", () => {
    beforeEach(async () => {
      // Sign up a fresh user to reach onboarding
      await element(by.id("go-to-signup-link")).tap();
      await element(by.id("name-input")).typeText("Onboard User");
      await element(by.id("email-input")).typeText(`onboard_${Date.now()}@drapnr.com`);
      await element(by.id("password-input")).typeText("password123");
      await element(by.id("sign-up-button")).tap();

      await waitFor(element(by.id("onboarding-screen")))
        .toBeVisible()
        .withTimeout(5000);
    });

    it("should display gender selection step", async () => {
      await detoxExpect(element(by.id("gender-selection"))).toBeVisible();
    });

    it("should display body type selection after gender", async () => {
      await element(by.id("gender-male")).tap();
      await element(by.id("onboarding-next")).tap();

      await detoxExpect(element(by.id("body-type-selection"))).toBeVisible();
    });

    it("should complete onboarding and navigate to wardrobe", async () => {
      // Select gender
      await element(by.id("gender-male")).tap();
      await element(by.id("onboarding-next")).tap();

      // Select body type
      await element(by.id("body-type-athletic")).tap();
      await element(by.id("onboarding-complete")).tap();

      await waitFor(element(by.id("wardrobe-screen")))
        .toBeVisible()
        .withTimeout(5000);
    });
  });
});
