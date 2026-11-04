import ActivityKit
import ExpoModulesCore

struct NextCallPayload: Record {
    @Field var uid: String = ""
    @Field var title: String = ""
    @Field var startTime: String = ""
    @Field var endTime: String = ""
    @Field var attendeeName: String? = nil
    @Field var attendeeCount: Int = 0
    @Field var locationLabel: String? = nil
    @Field var isVideo: Bool = false
    @Field var deepLinkUrl: String = ""
}

private enum NextCallLiveActivityError: Error, LocalizedError {
    case invalidDate(String)
    case notEnabled

    var errorDescription: String? {
        switch self {
        case .invalidDate(let value): return "Invalid ISO 8601 date: \(value)"
        case .notEnabled: return "Live Activities are disabled for this app"
        }
    }
}

private func parseISODate(_ value: String) throws -> Date {
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    if let date = formatter.date(from: value) { return date }
    formatter.formatOptions = [.withInternetDateTime]
    if let date = formatter.date(from: value) { return date }
    throw NextCallLiveActivityError.invalidDate(value)
}

public class NextCallLiveActivityModule: Module {
    public func definition() -> ModuleDefinition {
        Name("NextCallLiveActivity")

        Function("isSupported") { () -> Bool in
            ActivityAuthorizationInfo().areActivitiesEnabled
        }

        Function("getActiveUids") { () -> [String] in
            Activity<NextCallAttributes>.activities.map { $0.attributes.uid }
        }

        // Starts a Live Activity for the booking, or updates the one already running for it.
        // Any activity for a different booking is ended first so only the next call is shown.
        // iOS only allows Activity.request while the app is in the foreground; the JS side
        // schedules the call for that window and treats a failure here as non-fatal.
        AsyncFunction("startOrUpdate") { (payload: NextCallPayload) async throws -> String in
            guard ActivityAuthorizationInfo().areActivitiesEnabled else {
                throw NextCallLiveActivityError.notEnabled
            }
            let state = NextCallAttributes.ContentState(
                title: payload.title,
                startDate: try parseISODate(payload.startTime),
                endDate: try parseISODate(payload.endTime),
                attendeeName: payload.attendeeName,
                attendeeCount: payload.attendeeCount,
                locationLabel: payload.locationLabel,
                isVideo: payload.isVideo
            )
            // Stale at start time re-renders the activity as "happening now" without an app update.
            let content = ActivityContent(state: state, staleDate: state.startDate, relevanceScore: 100)

            var existing: Activity<NextCallAttributes>? = nil
            for activity in Activity<NextCallAttributes>.activities {
                if activity.attributes.uid == payload.uid, existing == nil {
                    existing = activity
                } else {
                    await activity.end(nil, dismissalPolicy: .immediate)
                }
            }

            if let existing {
                await existing.update(content)
                return existing.id
            }

            let attributes = NextCallAttributes(uid: payload.uid, deepLinkUrl: payload.deepLinkUrl)
            let activity = try Activity.request(attributes: attributes, content: content, pushType: nil)
            return activity.id
        }

        // Ends the activity for one booking, or every next-call activity when uid is nil.
        AsyncFunction("end") { (uid: String?) async in
            for activity in Activity<NextCallAttributes>.activities {
                if let uid, activity.attributes.uid != uid { continue }
                await activity.end(nil, dismissalPolicy: .immediate)
            }
        }
    }
}
