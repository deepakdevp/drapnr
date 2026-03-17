/** @type {import('jest').Config} */
module.exports = {
  preset: "jest-expo",
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg|react-native-reanimated|react-native-gesture-handler|react-native-purchases|@react-three/.*|three|expo-three|@nozbe/watermelondb)",
  ],
  transform: {
    "^.+\\.[jt]sx?$": [
      "babel-jest",
      { presets: ["babel-preset-expo"] },
    ],
  },
  moduleNameMapper: {
    "\\.(jpg|jpeg|png|gif|webp|svg|ttf|otf|woff|woff2)$":
      "<rootDir>/__mocks__/fileMock.js",
    "^@drapnr/shared(.*)$": "<rootDir>/../../packages/shared/src$1",
  },
  setupFiles: ["./jest.setup.js"],
  testMatch: [
    "<rootDir>/__tests__/**/*.test.{ts,tsx}",
    "<rootDir>/e2e/**/*.test.{ts,tsx}",
  ],
  testPathIgnorePatterns: ["/node_modules/", "/e2e/"],
  collectCoverageFrom: [
    "stores/**/*.{ts,tsx}",
    "components/**/*.{ts,tsx}",
    "lib/**/*.{ts,tsx}",
    "services/**/*.{ts,tsx}",
    "!**/*.d.ts",
    "!**/node_modules/**",
  ],
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 60,
      lines: 60,
      statements: 60,
    },
  },
};
