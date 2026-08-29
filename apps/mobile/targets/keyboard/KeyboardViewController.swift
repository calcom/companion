import SwiftUI
import UIKit

struct KeyboardData: Codable {
    let links: [KeyboardLink]
    let timeZone: String
    let lastUpdated: String
}

struct KeyboardLink: Codable, Identifiable {
    let id: String
    let title: String
    let url: String
    let durationLabel: String?
    let days: [KeyboardDay]
}

struct KeyboardDay: Codable, Identifiable {
    let date: String
    let label: String
    let slots: [KeyboardSlot]

    var id: String { date }
}

struct KeyboardSlot: Codable, Identifiable {
    let start: String
    let label: String
    let url: String

    var id: String { start }
}

final class KeyboardViewController: UIInputViewController {
    private var hostingController: UIHostingController<AnyView>?

    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        let data = loadKeyboardData()
        let rootView = AnyView(KeyboardRootView(
            data: data,
            showsInputModeSwitchKey: needsInputModeSwitchKey,
            onSwitchInputMode: { [weak self] in self?.advanceToNextInputMode() },
            onBackspace: { [weak self] in self?.textDocumentProxy.deleteBackward() },
            onInsert: { [weak self] text in self?.textDocumentProxy.insertText(text) }
        ).id(data?.lastUpdated ?? ""))

        if let hostingController {
            hostingController.rootView = rootView
        } else {
            let controller = UIHostingController(rootView: rootView)
            hostingController = controller
            addChild(controller)
            view.addSubview(controller.view)
            controller.view.translatesAutoresizingMaskIntoConstraints = false
            let heightConstraint = view.heightAnchor.constraint(equalToConstant: 300)
            heightConstraint.priority = UILayoutPriority(999)
            NSLayoutConstraint.activate([
                controller.view.leadingAnchor.constraint(equalTo: view.leadingAnchor),
                controller.view.trailingAnchor.constraint(equalTo: view.trailingAnchor),
                controller.view.topAnchor.constraint(equalTo: view.topAnchor),
                controller.view.bottomAnchor.constraint(equalTo: view.bottomAnchor),
                heightConstraint,
            ])
            controller.didMove(toParent: self)
        }
    }

    private func loadKeyboardData() -> KeyboardData? {
        guard let defaults = UserDefaults(suiteName: "group.com.cal.companion") else {
            return nil
        }

        if let jsonString = defaults.string(forKey: "keyboardLinks"),
           let data = jsonString.data(using: .utf8) {
            return try? JSONDecoder().decode(KeyboardData.self, from: data)
        }
        if let data = defaults.data(forKey: "keyboardLinks") {
            return try? JSONDecoder().decode(KeyboardData.self, from: data)
        }
        return nil
    }
}

struct KeyboardRootView: View {
    let data: KeyboardData?
    let showsInputModeSwitchKey: Bool
    let onSwitchInputMode: () -> Void
    let onBackspace: () -> Void
    let onInsert: (String) -> Void
    @State private var selectedLink: KeyboardLink?
    @State private var selectedSlots: Set<String> = []

    var body: some View {
        VStack(spacing: 8) {
            if let data {
                if let selectedLink {
                    slotPicker(link: selectedLink, timeZone: data.timeZone)
                } else {
                    linkPicker(data.links)
                }
            } else {
                Text("Open the Cal.com app to sync your links")
                    .font(.system(size: 15, weight: .medium))
                    .multilineTextAlignment(.center)
                    .padding()
            }
            Spacer(minLength: 0)
            HStack(spacing: 8) {
                if showsInputModeSwitchKey {
                    Button(action: onSwitchInputMode) {
                        Image(systemName: "globe")
                    }
                }
                Spacer()
                Button(action: onBackspace) {
                    Image(systemName: "delete.left")
                }
            }
            .buttonStyle(.bordered)
            .padding(.horizontal, 8)
        }
        .padding(8)
        .background(Color(uiColor: .systemGray6))
    }

    private func linkPicker(_ links: [KeyboardLink]) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Cal.com links")
                .font(.headline)
            if links.isEmpty {
                Text("Open the Cal.com app to sync your links")
                    .foregroundStyle(.secondary)
            } else {
                ScrollView {
                    ForEach(links) { link in
                        Button {
                            selectedLink = link
                            selectedSlots = []
                        } label: {
                            HStack {
                                VStack(alignment: .leading) {
                                    Text(link.title).fontWeight(.semibold)
                                    if let duration = link.durationLabel {
                                        Text(duration).font(.caption).foregroundStyle(.secondary)
                                    }
                                }
                                Spacer()
                                Image(systemName: "chevron.right")
                            }
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        Divider()
                    }
                }
            }
        }
    }

    private func slotPicker(link: KeyboardLink, timeZone: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Button {
                    selectedLink = nil
                    selectedSlots = []
                } label: {
                    Image(systemName: "chevron.left")
                }
                Text(link.title).font(.headline).lineLimit(1)
                Spacer()
                Button("Insert") {
                    let selections = link.days.flatMap { day in
                        day.slots.filter { selectedSlots.contains($0.id) }.map { (day, $0) }
                    }
                    onInsert(composeInsertion(link: link, selections: selections, timeZone: timeZone))
                    selectedSlots = []
                }
                .disabled(selectedSlots.isEmpty)
            }
            ScrollView {
                ForEach(link.days) { day in
                    VStack(alignment: .leading, spacing: 4) {
                        Text(day.label)
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(.secondary)
                            .padding(.top, 8)
                        ForEach(day.slots) { slot in
                            Button {
                                if selectedSlots.contains(slot.id) {
                                    selectedSlots.remove(slot.id)
                                } else {
                                    selectedSlots.insert(slot.id)
                                }
                            } label: {
                                HStack {
                                    Text(slot.label)
                                    Spacer()
                                    if selectedSlots.contains(slot.id) {
                                        Image(systemName: "checkmark")
                                    }
                                }
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
            }
        }
    }

    private func composeInsertion(
        link: KeyboardLink,
        selections: [(KeyboardDay, KeyboardSlot)],
        timeZone: String
    ) -> String {
        let lines = selections.map { "\($0.0.label) at \($0.1.label) — \($0.1.url)" }
        if lines.count == 1 {
            return lines[0]
        }
        return ([ "\(link.title) — pick a time:" ] + lines + ["", "(times in \(timeZone))"]).joined(separator: "\n")
    }
}
