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

// Resolve react/compiler-runtime and react-native-css-interop to the correct paths.
// NODE_PATH above includes the root .bun/node_modules which contains a stale
// react-native-css-interop@0.1.22. We must force resolution to the 0.2.1 copy
// inside apps/mobile/node_modules to avoid two conflicting CssInterop runtimes.
const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "react/compiler-runtime") {
    return {
      filePath: require.resolve("react/compiler-runtime"),
      type: "sourceFile",
    };
  }
  if (
    moduleName === "react-native-css-interop" ||
    moduleName.startsWith("react-native-css-interop/")
  ) {
    const resolved = require.resolve(moduleName, {
      paths: [path.resolve(__dirname, "node_modules")],
    });
    return { filePath: resolved, type: "sourceFile" };
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: "./global.css", inlineRem: 16 });
