/** @type {import('jest').Config} */
module.exports = {
  preset: "jest-expo",
  testPathIgnorePatterns: [
    "/node_modules/",
    "/.expo/",
    "/dist/",
    "/web-build/",
  ],
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|nativewind|react-native-css-interop|expo-modules-core)/)",
  ],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
  testMatch: ["**/__tests__/**/*.test.(ts|tsx|js|jsx)"],
};
