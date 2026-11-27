/**
 * Adopts the UIScene life cycle on iOS.
 *
 * Apps linked against the iOS 27 SDK stop at launch unless they use scenes: UIKit traps in
 * `_UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption`. Expo 57 ships the scene
 * delegate (`ExpoAppSceneDelegate`, exported to Objective-C as `EXExpoAppSceneDelegate`), but the
 * prebuild template doesn't wire it up yet. This plugin does:
 *
 * - Info.plist declares one window scene whose delegate is `EXExpoAppSceneDelegate`.
 * - AppDelegate conforms to `ExpoReactNativeFactoryProvider`, so the scene delegate can reach the
 *   React Native factory, and stops creating its own window: the scene delegate creates it from
 *   the connecting `UIWindowScene` and starts React Native in it.
 *
 * Remove this once the Expo template adopts scenes itself.
 */
const { withAppDelegate, withInfoPlist } = require("expo/config-plugins");

const SCENE_DELEGATE_CLASS = "EXExpoAppSceneDelegate";

function withSceneManifest(config) {
  return withInfoPlist(config, (cfg) => {
    cfg.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: "Default Configuration",
            UISceneDelegateClassName: SCENE_DELEGATE_CLASS,
          },
        ],
      },
    };
    return cfg;
  });
}

// The template's window setup inside application(_:didFinishLaunchingWithOptions:).
const WINDOW_SETUP =
  /\n#if os\(iOS\) \|\| os\(tvOS\)\n\s*window = UIWindow\(frame: UIScreen\.main\.bounds\)\n\s*factory\.startReactNative\([\s\S]*?\)\n#endif\n/;

function withSceneAppDelegate(config) {
  return withAppDelegate(config, (cfg) => {
    if (cfg.modResults.language !== "swift") {
      throw new Error("with-ios-scene-lifecycle: expected a Swift AppDelegate.");
    }
    let contents = cfg.modResults.contents;

    if (!contents.includes("ExpoReactNativeFactoryProvider")) {
      const declaration = /(class AppDelegate: ExpoAppDelegate)\s*\{/;
      if (!declaration.test(contents)) {
        throw new Error("with-ios-scene-lifecycle: couldn't find the AppDelegate declaration.");
      }
      contents = contents.replace(declaration, "$1, ExpoReactNativeFactoryProvider {");
    }

    if (WINDOW_SETUP.test(contents)) {
      contents = contents.replace(
        WINDOW_SETUP,
        "\n    // EXExpoAppSceneDelegate creates the window and starts React Native in it.\n"
      );
    } else if (contents.includes("UIWindow(frame: UIScreen.main.bounds)")) {
      throw new Error("with-ios-scene-lifecycle: couldn't remove the AppDelegate's window setup.");
    }

    cfg.modResults.contents = contents;
    return cfg;
  });
}

module.exports = function withIosSceneLifecycle(config) {
  return withSceneAppDelegate(withSceneManifest(config));
};
