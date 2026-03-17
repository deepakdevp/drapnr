// =============================================================================
// Jest Setup — Mock native modules that are unavailable in the test environment
// =============================================================================

// --- react-native-reanimated ------------------------------------------------
jest.mock("react-native-reanimated", () => {
  const Reanimated = require("react-native-reanimated/mock");
  Reanimated.default.call = () => {};
  return Reanimated;
});

// Silence the warning: Animated: `useNativeDriver` is not supported
jest.mock("react-native/Libraries/Animated/NativeAnimatedHelper");

// --- expo-haptics -----------------------------------------------------------
jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  selectionAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: "light", Medium: "medium", Heavy: "heavy" },
  NotificationFeedbackType: {
    Success: "success",
    Warning: "warning",
    Error: "error",
  },
}));

// --- expo-sensors -----------------------------------------------------------
jest.mock("expo-sensors", () => ({
  Accelerometer: {
    addListener: jest.fn(() => ({ remove: jest.fn() })),
    setUpdateInterval: jest.fn(),
    isAvailableAsync: jest.fn().mockResolvedValue(true),
  },
  Gyroscope: {
    addListener: jest.fn(() => ({ remove: jest.fn() })),
    setUpdateInterval: jest.fn(),
    isAvailableAsync: jest.fn().mockResolvedValue(true),
  },
  DeviceMotion: {
    addListener: jest.fn(() => ({ remove: jest.fn() })),
    setUpdateInterval: jest.fn(),
    isAvailableAsync: jest.fn().mockResolvedValue(true),
  },
}));

// --- @react-three/fiber -----------------------------------------------------
jest.mock("@react-three/fiber", () => ({
  Canvas: "Canvas",
  useFrame: jest.fn(),
  useThree: jest.fn(() => ({
    gl: {},
    scene: {},
    camera: {},
    size: { width: 375, height: 812 },
  })),
  extend: jest.fn(),
}));

// --- @supabase/supabase-js --------------------------------------------------
jest.mock("@supabase/supabase-js", () => ({
  createClient: jest.fn(() => ({
    auth: {
      signInWithPassword: jest.fn().mockResolvedValue({ data: {}, error: null }),
      signUp: jest.fn().mockResolvedValue({ data: {}, error: null }),
      signOut: jest.fn().mockResolvedValue({ error: null }),
      getSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: jest.fn(() => ({
        data: { subscription: { unsubscribe: jest.fn() } },
      })),
    },
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
    })),
    storage: {
      from: jest.fn(() => ({
        upload: jest.fn().mockResolvedValue({ data: { path: "test" }, error: null }),
        getPublicUrl: jest.fn(() => ({ data: { publicUrl: "https://example.com/test" } })),
      })),
    },
  })),
}));

// --- react-native-purchases -------------------------------------------------
jest.mock("react-native-purchases", () => ({
  Purchases: {
    configure: jest.fn(),
    getOfferings: jest.fn().mockResolvedValue({ current: null }),
    purchasePackage: jest.fn().mockResolvedValue({ customerInfo: {} }),
    getCustomerInfo: jest.fn().mockResolvedValue({}),
    restorePurchases: jest.fn().mockResolvedValue({}),
    addCustomerInfoUpdateListener: jest.fn(() => ({ remove: jest.fn() })),
  },
  LOG_LEVEL: { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 },
  PURCHASES_ERROR_CODE: {},
}));

// --- expo-notifications -----------------------------------------------------
jest.mock("expo-notifications", () => ({
  getPermissionsAsync: jest.fn().mockResolvedValue({ status: "granted" }),
  requestPermissionsAsync: jest.fn().mockResolvedValue({ status: "granted" }),
  getExpoPushTokenAsync: jest.fn().mockResolvedValue({ data: "ExponentPushToken[mock]" }),
  setNotificationHandler: jest.fn(),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  scheduleNotificationAsync: jest.fn(),
  AndroidImportance: { MAX: 5, HIGH: 4, DEFAULT: 3, LOW: 2, MIN: 1 },
}));
