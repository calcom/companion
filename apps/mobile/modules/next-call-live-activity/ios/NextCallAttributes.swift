import ActivityKit
import Foundation

// Shared with the main app: modules/next-call-live-activity/ios/NextCallAttributes.swift.
// ActivityKit matches app and extension by type name and shape, so keep both copies identical.
// apps/mobile/utils/next-call-live-activity.test.js fails when they drift.
@available(iOS 16.2, *)
struct NextCallAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        var title: String
        var startDate: Date
        var endDate: Date
        var attendeeName: String?
        var attendeeCount: Int
        var locationLabel: String?
        var isVideo: Bool
    }

    var uid: String
    var deepLinkUrl: String
}
