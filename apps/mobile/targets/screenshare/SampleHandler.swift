import ReplayKit

/// Entry point of the Broadcast Upload Extension (`NSExtensionPrincipalClass`).
///
/// All the work lives in `RTKScreenshareHandler`, vendored from
/// `@cloudflare/realtimekit-react-native/ios/screenshare` (an extension cannot link the React
/// Native pod). It connects to the Unix socket the app's WebRTC module opens in the shared App
/// Group container and streams ReplayKit frames into it.
class SampleHandler: RTKScreenshareHandler {
  override init() {
    // The extension is "<app bundle id>.screenshare" and the App Group is "group.<app bundle id>",
    // both derived from app.json, so neither has to be repeated here.
    let extensionBundleId = Bundle.main.bundleIdentifier ?? ""
    let appBundleId = extensionBundleId.replacingOccurrences(
      of: ".screenshare", with: "", options: [.anchored, .backwards])
    super.init(appGroupIdentifier: "group.\(appBundleId)", bundleIdentifier: extensionBundleId)
  }
}
