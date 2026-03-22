const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// In the Bun monorepo, @babel/core is hoisted into a deeply-nested .bun/ path
// and cannot resolve sibling @babel/* plugins via normal Node resolution.
// Setting NODE_PATH to the Bun hoisted node_modules directory makes all
// @babel/* packages visible to @babel/core's internal require() calls.
const bunNodeModules = path.resolve(__dirname, "../../node_modules/.bun/node_modules");
process.env.NODE_PATH = process.env.NODE_PATH
  ? `${process.env.NODE_PATH}:${bunNodeModules}`
  : bunNodeModules;
// eslint-disable-next-line @typescript-eslint/no-require-imports
require("node:module").Module._initPaths();

// Force resolution of react, react-dom, react/compiler-runtime, and
// react-native-css-interop to the copies inside apps/mobile/node_modules.
// Without this, Metro may resolve these from the monorepo root where a
// different React version is hoisted (e.g. 19.2.3 from apps/chat), causing
// duplicate React instances and breaking the React Compiler on web.
const mobileNodeModules = path.resolve(__dirname, "node_modules");
const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    moduleName === "react" ||
    moduleName === "react-dom" ||
    moduleName.startsWith("react/") ||
    moduleName.startsWith("react-dom/")
  ) {
    const resolved = require.resolve(moduleName, {
      paths: [mobileNodeModules],
    });
    return { filePath: resolved, type: "sourceFile" };
  }
  if (
    moduleName === "react-native-css-interop" ||
    moduleName.startsWith("react-native-css-interop/")
  ) {
    const resolved = require.resolve(moduleName, {
      paths: [mobileNodeModules],
    });
    return { filePath: resolved, type: "sourceFile" };
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: "./global.css", inlineRem: 16 });
