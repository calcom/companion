import ActivityKit
import SwiftUI
import WidgetKit

// Live Activity for the next call. The app starts it five minutes before the booking
// (see apps/mobile/utils/next-call-live-activity.ts) with staleDate set to the start time,
// so the system re-renders once the call begins and the copy flips to "happening now".

private extension NextCallAttributes.ContentState {
    var hasStarted: Bool { startDate <= Date() }

    var whoLabel: String? {
        guard let name = attendeeName, !name.isEmpty else { return nil }
        let others = attendeeCount - 1
        return others > 0 ? "\(name) + \(others)" : name
    }

    var timeRangeLabel: String {
        let formatter = DateIntervalFormatter()
        formatter.dateStyle = .none
        formatter.timeStyle = .short
        return formatter.string(from: startDate, to: endDate)
    }
}

private struct CountdownText: View {
    let state: NextCallAttributes.ContentState
    let isStale: Bool

    var body: some View {
        if isStale || state.hasStarted {
            // Time left in the call.
            Text(timerInterval: state.startDate...state.endDate, countsDown: true, showsHours: false)
        } else {
            Text(timerInterval: Date()...state.startDate, countsDown: true, showsHours: false)
        }
    }
}

private struct CallIcon: View {
    let isVideo: Bool
    let inProgress: Bool

    var body: some View {
        Image(systemName: isVideo ? "video.fill" : "calendar")
            .foregroundStyle(inProgress ? Color.green : Color.primary)
    }
}

private struct ActionPill: View {
    let label: String

    var body: some View {
        Text(label)
            .font(.caption.weight(.semibold))
            .padding(.horizontal, 10)
            .padding(.vertical, 5)
            .background(Color.accentColor, in: Capsule())
            .foregroundStyle(.white)
    }
}

private struct LockScreenView: View {
    let context: ActivityViewContext<NextCallAttributes>

    private var state: NextCallAttributes.ContentState { context.state }
    private var inProgress: Bool { context.isStale || state.hasStarted }

    var body: some View {
        HStack(alignment: .center, spacing: 12) {
            CallIcon(isVideo: state.isVideo, inProgress: inProgress)
                .font(.system(size: 20, weight: .semibold))
                .frame(width: 40, height: 40)
                .background(Color.primary.opacity(0.08), in: RoundedRectangle(cornerRadius: 10))

            VStack(alignment: .leading, spacing: 2) {
                Text(inProgress ? "Happening now" : "Starting soon")
                    .font(.caption)
                    .foregroundStyle(inProgress ? Color.green : Color.secondary)
                Text(state.title)
                    .font(.headline)
                    .lineLimit(1)
                HStack(spacing: 4) {
                    if let who = state.whoLabel {
                        Text(who).lineLimit(1)
                        Text("·")
                    }
                    Text(state.timeRangeLabel)
                }
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .lineLimit(1)
            }

            Spacer(minLength: 4)

            VStack(alignment: .trailing, spacing: 6) {
                CountdownText(state: state, isStale: context.isStale)
                    .font(.title3.weight(.semibold))
                    .monospacedDigit()
                    .multilineTextAlignment(.trailing)
                    .frame(maxWidth: 64, alignment: .trailing)
                ActionPill(label: state.isVideo ? "Join" : "Open")
            }
        }
        .padding(14)
        .activitySystemActionForegroundColor(.primary)
    }
}

struct NextCallLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: NextCallAttributes.self) { context in
            LockScreenView(context: context)
                .widgetURL(URL(string: context.attributes.deepLinkUrl))
        } dynamicIsland: { context in
            let state = context.state
            let inProgress = context.isStale || state.hasStarted
            let deepLink = URL(string: context.attributes.deepLinkUrl)
            return DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    CallIcon(isVideo: state.isVideo, inProgress: inProgress)
                        .font(.title3)
                        .padding(.leading, 4)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    CountdownText(state: state, isStale: context.isStale)
                        .font(.title3.weight(.semibold))
                        .monospacedDigit()
                        .frame(maxWidth: 64, alignment: .trailing)
                        .padding(.trailing, 4)
                }
                DynamicIslandExpandedRegion(.center) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(state.title)
                            .font(.headline)
                            .lineLimit(1)
                        if let who = state.whoLabel {
                            Text(who)
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                                .lineLimit(1)
                        }
                    }
                }
                DynamicIslandExpandedRegion(.bottom) {
                    HStack {
                        Text(state.timeRangeLabel)
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                        Spacer()
                        ActionPill(label: state.isVideo ? "Join call" : "Open booking")
                    }
                    .padding(.horizontal, 4)
                    .widgetURL(deepLink)
                }
            } compactLeading: {
                CallIcon(isVideo: state.isVideo, inProgress: inProgress)
                    .widgetURL(deepLink)
            } compactTrailing: {
                CountdownText(state: state, isStale: context.isStale)
                    .font(.caption.weight(.semibold))
                    .monospacedDigit()
                    .frame(maxWidth: 44)
                    .widgetURL(deepLink)
            } minimal: {
                CallIcon(isVideo: state.isVideo, inProgress: inProgress)
                    .widgetURL(deepLink)
            }
            .keylineTint(inProgress ? Color.green : Color.accentColor)
        }
    }
}

#Preview("Lock screen", as: .content, using: NextCallAttributes(uid: "preview", deepLinkUrl: "calcom://(tabs)/(bookings)")) {
    NextCallLiveActivity()
} contentStates: {
    NextCallAttributes.ContentState(
        title: "Product Review",
        startDate: Date().addingTimeInterval(240),
        endDate: Date().addingTimeInterval(240 + 1800),
        attendeeName: "Jane Smith",
        attendeeCount: 3,
        locationLabel: "Cal Video",
        isVideo: true
    )
    NextCallAttributes.ContentState(
        title: "Coffee chat",
        startDate: Date().addingTimeInterval(-120),
        endDate: Date().addingTimeInterval(1680),
        attendeeName: "John Doe",
        attendeeCount: 1,
        locationLabel: "In person",
        isVideo: false
    )
}
