const { getNodePreset } = require("jest-expo/config");

// Start the blocking Jest lane with fast Expo-transformed logic tests.
const expoNodePreset = getNodePreset();

/** @type {import("jest").Config} */
module.exports = {
  ...expoNodePreset,
  rootDir: ".",
  cacheDirectory: "<rootDir>/../../node_modules/.cache/jest-mobile",
  setupFilesAfterEnv: [...(expoNodePreset.setupFilesAfterEnv ?? []), "<rootDir>/jest.setup.js"],
  testPathIgnorePatterns: [...expoNodePreset.testPathIgnorePatterns, "/dist/", "/.expo/"],
  // CI's isolated bun install nests packages under node_modules/.bun/, like pnpm's .pnpm/.
  transformIgnorePatterns: expoNodePreset.transformIgnorePatterns.map((pattern) =>
    pattern.replace("(?!(.pnpm|", "(?!(.pnpm|\\.bun|")
  ),
  moduleNameMapper: {
    ...expoNodePreset.moduleNameMapper,
    "^@/(.*)$": "<rootDir>/$1",
  },
};
