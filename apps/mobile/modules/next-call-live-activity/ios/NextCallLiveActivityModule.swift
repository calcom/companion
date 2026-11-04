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
    case unavailable

    var errorDescription: String? {
        switch self {
        case .invalidDate(let value): return "Invalid ISO 8601 date: \(value)"
        case .notEnabled: return "Live Activities are disabled for this app"
        case .unavailable: return "Live Activities need iOS 16.2 or later"
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

// The pod's deployment target follows the app's (15.1), so ActivityKit use is gated here.
@available(iOS 16.2, *)
@MainActor
private enum NextCallActivities {
    static var all: [Activity<NextCallAttributes>] {
        Activity<NextCallAttributes>.activities
    }

    // Native end timers keyed by booking uid. They outlive JS reloads, but like any timer
    // they do not run while iOS has the app suspended; see services/nextCallLiveActivity.ts.
    private static var endTasks: [String: Task<Void, Never>] = [:]

    private static func scheduleEnd(uid: String, at endDate: Date) {
        endTasks[uid]?.cancel()
        let delay = endDate.timeIntervalSinceNow
        endTasks[uid] = Task {
            if delay > 0 {
                try? await Task.sleep(nanoseconds: UInt64(delay * 1_000_000_000))
            }
            guard !Task.isCancelled else { return }
            await end(uid: uid)
        }
    }

    private static func cancelEnd(uid: String) {
        endTasks[uid]?.cancel()
        endTasks[uid] = nil
    }

    // Starts a Live Activity for the booking, or updates the one already running for it.
    // Any activity for a different booking is ended first so only the next call is shown.
    // iOS only allows Activity.request while the app is in the foreground; the JS side
    // schedules the call for that window and treats a failure here as non-fatal.
    static func startOrUpdate(_ payload: NextCallPayload) async throws -> String {
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
        for activity in all {
            if activity.attributes.uid == payload.uid, existing == nil {
                existing = activity
            } else {
                cancelEnd(uid: activity.attributes.uid)
                await activity.end(nil, dismissalPolicy: .immediate)
            }
        }

        if let existing {
            await existing.update(content)
            scheduleEnd(uid: payload.uid, at: state.endDate)
            return existing.id
        }

        let attributes = NextCallAttributes(uid: payload.uid, deepLinkUrl: payload.deepLinkUrl)
        let activity = try Activity.request(attributes: attributes, content: content, pushType: nil)
        scheduleEnd(uid: payload.uid, at: state.endDate)
        return activity.id
    }

    // Ends the activity for one booking, or every next-call activity when uid is nil.
    static func end(uid: String?) async {
        for activity in all {
            if let uid, activity.attributes.uid != uid { continue }
            cancelEnd(uid: activity.attributes.uid)
            await activity.end(nil, dismissalPolicy: .immediate)
        }
    }
}

public class NextCallLiveActivityModule: Module {
    public func definition() -> ModuleDefinition {
        Name("NextCallLiveActivity")

        Function("isSupported") { () -> Bool in
            guard #available(iOS 16.2, *) else { return false }
            return ActivityAuthorizationInfo().areActivitiesEnabled
        }

        Function("getActiveUids") { () -> [String] in
            guard #available(iOS 16.2, *) else { return [] }
            return Activity<NextCallAttributes>.activities.map { $0.attributes.uid }
        }

        AsyncFunction("startOrUpdate") { (payload: NextCallPayload) async throws -> String in
            guard #available(iOS 16.2, *) else { throw NextCallLiveActivityError.unavailable }
            return try await NextCallActivities.startOrUpdate(payload)
        }

        AsyncFunction("end") { (uid: String?) async in
            guard #available(iOS 16.2, *) else { return }
            await NextCallActivities.end(uid: uid)
        }
    }
}
