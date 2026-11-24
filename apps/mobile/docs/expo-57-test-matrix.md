# Expo 57 test matrix

Manual test plan for the Expo SDK 57 upgrade ([#208](https://github.com/calcom/companion/pull/208), PRO-4865). It covers every component the upgrade edited, the pages each one appears on, and how each should behave.

Each test can be judged on its own, with no production build to compare against. A test passes when the page meets its **Expected** column and the [basic checks](#basic-checks) for the components on it.

## Results

Tested on the iOS 26 simulator with a debug build against the local test backend: first run on 6 November 2026, fixes retested on 10 November 2026. Android is covered by a separate plan.

| Pass | Fail | Partly checked | Not run | Not started |
|---|---|---|---|---|
| 60 | 0 | 3 | 9 | 10 |

The first run found five bugs, all fixed on this branch:

| Commit | Fix | Tests |
|---|---|---|
| `382c420` | Host React Native content in `RNHostView` inside SwiftUI menus, so booking and availability rows and the Locations + render | B1, B3, B4, C13, D1, D4, D5 |
| `833afca` | Upload event photos as `expo-file-system` Files, which Expo 57's `expo/fetch` can send | I6 |
| `d4134c5` | Give full-height sheets a transparent background, so they keep their content when dragged up or lifted by the keyboard | B13 |
| `e1b1d43` | Stop counting the default booking layout as a link edit | C8 |
| `d973428` | Pass non-video deep links through to the router | I4 |

Smaller issues found along the way, none caused by the upgrade, are tracked in PRO-5114.

## How to use this

Mark the **Result** column with ✅ pass, ❌ fail or ➖ not applicable. Test in order, because later sections assume you're signed in. Some rows only apply to bookings in a certain state, so you may need a past, upcoming, recurring and cancelled booking.

Run these once in light mode and once in dark mode: A2, B1, C1, D1 and F2.

## Basic checks

These apply to every component of each type, on every page, even where a row doesn't repeat them.

| Component | It works when |
|---|---|
| Any page | It loads with no red screen or error badge, and nothing overlaps or is cut off. Text is readable in light and dark mode |
| Header title | It shows the right text for the page, and the large title collapses on scroll where the page has one |
| Header button | It's visible, sits on the side the row says, shows an icon or label, and does its action on one tap |
| Close (✕) | It closes the page without saving anything |
| Save (✓ or Save) | It's disabled when there's nothing to save or a save is running. It saves, and the change is still there after reopening the page |
| Search bar | It shows its placeholder, filters as you type, and shows the full list again when cleared |
| Tap menu ("⋯" or chevron) | It opens on one tap and doesn't trigger the row behind it. Every item has a readable label and does its action. Tapping outside closes it and changes nothing |
| Long-press menu | It opens on a long press and not on a tap. A tap on the row does the row's normal action |
| Picker | It shows the current value with a check. Picking a value closes the menu and updates the row |
| Destructive action | It's shown in red, and it asks for confirmation before anything is deleted or cancelled, where the flow has a confirmation |
| Back navigation | The back button and the swipe gesture both return to the previous page |

## What changed

Three changes account for almost all the edits, so these are the bugs to look for:

| Change | Where | What a bug looks like |
|---|---|---|
| `Stack.Header` children became `Stack.Toolbar`, `Stack.Title` and `Stack.SearchBar` | Page headers | A missing, misplaced or dead button, a wrong title, or a missing search bar |
| Tap menus moved from `ContextMenu` to `Menu` | "⋯" buttons and pickers | A menu that needs a long press, doesn't open, looks different, or opens the row behind it |
| `react-navigation` imports moved to `expo-router` | App theme and unsaved-changes guard | Wrong colours, or leaving the event editor without a warning |

## A. App startup

| ID | Page | Edited | Do this | Expected | Result |
|---|---|---|---|---|---|
| A1 | App launch | `app/_layout.tsx` | Open the app | The app opens with no red screen or error badge | ✅ Cold launch opens with no red screen or crash |
| A2 | Whole app | `app/_layout.tsx` | Switch between light and dark mode | Headers, tab bar and backgrounds follow the mode | ✅ Headers, tab bar and backgrounds follow dark and light on Links, Availability, More, Bookings and profile sheet |
| A3 | Login | `app/_layout.tsx` | Sign in with **United States** selected | Sign-in completes and lands on the Bookings tab | ✅ Sign-in completes. Lands on Links, the default First Page, not Bookings as Expected says. Saw a stale Cal Video pre-join first |
| A4 | Login | `app/_layout.tsx` | Close the app and reopen it | You're still signed in | ✅ Still signed in after a full restart |

## B. Bookings

| ID | Page | Edited | Do this | Expected | Result |
|---|---|---|---|---|---|
| B1 | Bookings list | `(bookings)/index.ios.tsx` | Search, then use both header filter menus | Search filters the list. The event type and status menus open, show the current selection and filter the list | ✅ Fixed in 382c420, retested 10 Nov: rows render. Search and both menus work |
| B2 | Bookings list | `BookingListItem.ios.tsx` | Tap "⋯" on a booking once | The menu opens on one tap and the booking doesn't open. Items depend on state: Reschedule Booking, Edit Location, Add Guests, View Recordings, Meeting Session Details, Mark as No-Show, Report Booking, Cancel Event | ✅ Opens on one tap, booking stays closed. Showed Reschedule, Edit Location, Add Guests, Report, Cancel; last two red |
| B3 | Bookings list | `BookingListItem.ios.tsx` | Long-press a booking | The menu opens with the same items | ✅ Fixed in 382c420: a long press opens the menu with the same items |
| B4 | Bookings list | `BookingListItem.ios.tsx` | Tap a booking row | The booking detail opens and no menu appears | ✅ Fixed in 382c420: a tap opens the booking detail, with no menu |
| B5 | Bookings list | `RecurringBookingListItem.ios.tsx` | Tap "⋯" on a recurring booking | The menu opens on one tap, and each action applies to the right booking | ✅ 10 Nov, recurring QA booking: opens on one tap, and Reschedule opens for that booking |
| B6 | Booking detail | `booking-detail.ios.tsx` | Check the header, then tap back | The back button shows the month, or "Bookings" if opened from a notification, and returns to the list | ✅ 10 Nov: back shows the month and returns to the list. Opening from a notification not tested |
| B7 | Booking detail | `booking-detail.ios.tsx` | Open the header "⋯" menu | It shows Copy Meeting Link, then the Edit Event, After Event and Danger Zone groups. Danger Zone items are red | ✅ 10 Nov: Edit Event and Danger Zone groups, Danger Zone red. Copy Meeting Link and After Event not checked (upcoming booking with no link) |
| B8 | Booking detail | `booking-detail.ios.tsx` | Try each menu action | Each one opens the right screen or runs the right action | ✅ 10 Nov: Reschedule, Edit Location, Add Guests and Report open the right screen. Cancel Event not tapped |
| B9 | Booking detail | `booking-detail.ios.tsx` | Tap **Join** on a booking with a meeting link | The meeting opens. A booking with no link has no Join button | ✅ 10 Nov: Join opens the meeting link in Safari. A booking with no link has no Join |
| B10 | Reschedule | `reschedule.ios.tsx` | Tap ✕, then reopen, change the time and tap ✓ | ✕ closes without saving. ✓ saves and closes, and is disabled while saving | ✅ 10 Nov, QA booking: ✓ saved the new date and closed, and the booking shows Rescheduled to. ✕ closes. Disabled-while-saving not seen (too fast) |
| B11 | Edit Location | `edit-location.ios.tsx`, `EditLocationScreen.ios.tsx` | Tap the location type "⋯" and pick a type | The menu opens on one tap, and the form switches to that type. Check both places the menu appears | ✅ Opens on one tap and the form switches. Only the liquid glass menu checked; the non-glass one does not render on iOS 26 |
| B12 | Edit Location | `edit-location.ios.tsx` | Tap ✕, then repeat and tap ✓ | ✕ closes without saving. ✓ saves and closes | ✅ 10 Nov, QA booking: ✓ saved the new address and closed. The first try got an API 500 from an expired Google Calendar connection on the test backend, since removed. ✕ closes without saving |
| B13 | Add Guests | `add-guests.ios.tsx` | Add a guest and tap ✓, then repeat with ✕ | ✓ saves and closes. ✕ closes without saving | ✅ Fixed in d4134c5, retested 10 Nov: the form stays with the keyboard open, and ✓ saved a guest on a non-seated booking and closed. ✕ closes |
| B14 | Mark No-Show | `mark-no-show.ios.tsx` | Open it from a past booking, then tap ✕ | The title is right, the page works and ✕ closes it | ✅ Title Mark No-Show, attendee listed, ✕ closes. Did not tap Mark (seeded booking) |
| B15 | Recordings | `view-recordings.ios.tsx` | Open it from a booking with recordings, then tap ✕ | Recordings are listed and ✕ closes it | Not run: no such booking. No View Recordings item on the 6 past bookings scanned; rest unreachable once Bookings stopped loading |
| B16 | Session Details | `meeting-session-details.ios.tsx` | Open it from a past booking, then tap ✕ | Session details show and ✕ closes it | Not run: no such booking. No Meeting Session Details item on the 6 past bookings scanned; rest unreachable once Bookings stopped loading |

## C. Links (event types)

| ID | Page | Edited | Do this | Expected | Result |
|---|---|---|---|---|---|
| C1 | Links list | `(event-types)/index.ios.tsx` | Check the header and search | There's a large "Links" title, a "Search links" bar, a menu and a profile button. Search filters the list | ✅ Large Links title, Search links bar, menu and profile button; search filters and clears; light and dark |
| C2 | Links list | `(event-types)/index.ios.tsx` | Open the header menu, then Sort by | Alphabetical, Newest First and By Duration are shown. The selected one has a check and the list reorders | ✅ Three options shown, check on selected, list reorders |
| C3 | Links list | `(event-types)/index.ios.tsx` | Use Filter, then Clear All Filters | Hidden Only, Paid Events, Seated Events, Requires Confirmation and Recurring toggle. The Filter label shows the count, and clearing resets it | ✅ All five items shown; Paid Events toggled, label showed Filter (1), Clear All Filters reset it. Other four not toggled |
| C4 | Links list | `(event-types)/index.ios.tsx` | Tap the profile button | The profile sheet opens | ✅ Profile sheet opens |
| C5 | Links list | `EventTypeListItem.ios.tsx` | Tap "⋯" on a link once | The menu opens on one tap with Copy link, Edit, Duplicate and Delete, and the link doesn't open | ✅ Opens on one tap with Copy link, Edit, Duplicate, Delete; link stays closed; Delete red |
| C6 | Links list | `EventTypeListItem.ios.tsx` | Tap the row, then try each "⋯" action | The row opens the link detail. Each action works, and Delete is red | ✅ Row opens detail. Copy link, Edit, Duplicate and Delete all work (Delete tested on a copy, red, with confirmation). First Duplicate try hit a temporary backend 403 |
| C7 | Link detail | `event-type-detail.tsx` | Open the tab menu and switch tabs | The menu shows the current tab with a check, and the page switches tab | ✅ Tab menu shows the current tab with a check; page switches tab |
| C8 | Link detail | `event-type-detail.tsx` | Check Save before and after an edit | Save is disabled until you change something, then saves | ✅ Fixed in e1b1d43, retested 10 Nov: Save is grey on an untouched link and turns on after an edit. When the load 403s, Save stays grey with no message (backend) |
| C9 | Link detail, all tabs | `IOSPickerTrigger.ios.tsx` | Tap the up/down chevron on a setting, on each of Basics, Limits, Recurring and Advanced | The menu opens on one tap, the current value has a check, and picking one updates the row and enables Save | ✅ Limits and Recurring: one tap, check on current value, row updates, Save enables. Basics and Advanced have no such chevrons |
| C10 | Link detail, Availability | `AvailabilityTabIOSPicker.ios.tsx` | Change the schedule | The menu opens on one tap and the value updates | ✅ Opens on one tap, current value checked, value updates with a disposable schedule. Seeded schedules share a name so both show a check. Not saved |
| C11 | Link detail, Limits | `LimitsTabIOSPicker.ios.tsx` | Use each of the three pickers on this tab | The menu opens on one tap and the value updates | ✅ Before, After, Minimum Notice and Time-slot menus open on one tap; Before and After rows updated. Time-slot value not picked |
| C12 | Link detail, Recurring | `RecurringTabIOSPicker.ios.tsx` | Change the frequency | The menu opens on one tap and the value updates | ✅ Opens on one tap, current value checked, row updates (not saved) |
| C13 | Link detail, Basics | `LocationsListIOSPicker.ios.tsx` | Add a location from both the section header and the list | The menu opens on one tap and hides locations already added. The trigger is visible and tappable in both places, and the new location appears in the list | ✅ Fixed in 382c420, retested 10 Nov: the header + shows its icon, opens on one tap and hides locations already added, and the new location appears. In-list trigger not rendered here (hideAddButton) |

## D. Availability

| ID | Page | Edited | Do this | Expected | Result |
|---|---|---|---|---|---|
| D1 | Availability list | `(availability)/index.tsx` | Check the header and search | There's a large "Availability" title, a + button, your avatar or a profile button, and a "Search schedules" bar that filters the list | ✅ Fixed in 382c420, retested 10 Nov: schedules render. Title, +, avatar and Search schedules work |
| D2 | Availability list | `(availability)/index.tsx` | Tap + | The create dialog opens | ✅ + opens the Add a new schedule dialog |
| D3 | Availability list | `(availability)/index.tsx` | Tap your avatar | The profile sheet opens | ✅ Avatar opens the profile sheet |
| D4 | Availability list | `AvailabilityListItem.ios.tsx` | Tap "⋯" on a schedule once | The tap menu opens with Duplicate, Delete, and Set as Default on non-default schedules. This menu sits inside the long-press area, so check that it opens on a tap | ✅ Fixed in 382c420: opens on one tap with Duplicate and Delete, plus Set as Default on a non-default schedule |
| D5 | Availability list | `AvailabilityListItem.ios.tsx` | Long-press a schedule, then tap a row | The long press opens the menu. A tap opens the schedule | ✅ Fixed in 382c420: a long press opens the menu and a tap opens the schedule |
| D6 | Schedule detail | `availability-detail.ios.tsx` | Open the **Edit** menu | It shows Name and Timezone, Working Hours, Date Override, Set as Default and Delete Schedule. Delete is red and each item works | ✅ All five items shown, Delete is red and asks to confirm. Name, Hours, Override and Delete work. Set as Default not tapped (would change seeded default) |
| D7 | Edit Name & Timezone | `edit-availability-name.ios.tsx`, `EditAvailabilityNameScreen.ios.tsx` | Tap the timezone chevron and pick one, in both layouts of the screen | The menu opens on one tap, the current timezone has a check, and the row updates. The list is long, so check that it scrolls | ✅ Opens on one tap in both sheet layouts, scrolls, current value has a check, row updates |
| D8 | Edit Name & Timezone | `edit-availability-name.ios.tsx` | Tap ✓, then repeat with ✕ | ✓ saves and closes. ✕ closes without saving | ✅ ✓ saved Africa/Cairo and closed. ✕ closed and discarded a name change |
| D9 | Working Hours | `edit-availability-hours.ios.tsx` | Open it, then tap ✕ | "Working Hours" shows and ✕ closes it | ✅ Working Hours shows and ✕ closes it |
| D10 | Day editor | `edit-availability-day.ios.tsx` | Open a day, change it and tap ✓ | The title is the day's name, and ✓ saves and closes | ✅ Title Monday; ✓ saved 10:00 AM and closed |
| D11 | Date override | `edit-availability-override.ios.tsx` | Add an override, then edit it | The title is "Add Override", then "Edit Override". ✓ saves and ✕ cancels | ✅ Add Override then Edit Override titles; ✓ saved, ✕ cancelled |

## E. Events (Cal Events)

| ID | Page | Edited | Do this | Expected | Result |
|---|---|---|---|---|---|
| E1 | Events list | `(events)/index.ios.tsx` | Check the header | There's a large "Events" title and the list loads | ✅ Large Events title, list loads |
| E2 | Events list | `CalEventMenu.ios.tsx` | Tap "⋯" on an event once | The menu opens on one tap, with dividers between groups. Items depend on state: View event page, Preview, Copy link, Share, Publish, Cancel event, Delete. Destructive items are red | ✅ Opens on one tap with dividers; draft items shown (Preview, Copy link, Edit, Publish, Delete); Delete red |
| E3 | Edit event | `EditCalEventScreen.tsx` | Open the section menu and switch sections | The current section has a check and the page switches | ✅ Section menu shows a check on the current section and the page switches |
| E4 | Edit event | `EditCalEventScreen.tsx` | Open the "⋯" menu | Each action works, and destructive items are red | ✅ Preview, Copy link, Cancel event work and Cancel is red with a confirmation. View event page and Share in the editor menu: Share tested from the detail menu, View not tapped |
| E5 | Edit event | `EditCalEventScreen.tsx` | Check Save before and after an edit | Save is disabled until you change something, then saves | ✅ Disabled until an edit, then saves; value still there after reopening. Disposable event |
| E6 | Edit event | `EditCalEventScreen.tsx` | Make an edit, then swipe back or tap back. Try both buttons, then save and leave | An **Unsaved changes** alert appears. **Stay** keeps you on the page, and **Leave without saving** closes it. Trying to leave during a save does nothing. After a successful save, the page closes with no alert | ✅ Alert on back button and swipe. Stay keeps the edit, Leave discards it, a saved edit closes with no alert. Leaving during a save not tested (too fast for Maestro) |
| E7 | Edit event | `SelectField.ios.tsx` | Use the select fields: Category, Check-in, Color palette, Currency, Effect, Location | The menu opens on one tap across the whole field, the current value has a check and the field updates. VoiceOver reads the field's name and value | ✅ Category, Check-in, Color palette, Currency, Effect: one tap across the field, check on current value, field updates. Location select not present. Accessibility label read from hierarchy; VoiceOver not run |
| E8 | Edit event | `SelectField.ios.tsx` | Open a select that has hints under its options | Each option shows its hint as a subtitle, and only the selected one has a check | ✅ Hints show as subtitles, only the selected option has a check (Category) |
| E9 | Invite guests | `CalEventSheet.ios.tsx` | Open it, then use ✓ and ✕ | The title is right. ✓ is disabled until the form is ready, then sends. ✕ closes | ✅ Title right, ✓ disabled until a guest is added, then sends (Invited 1 guest) and closes; ✕ closes. Disposable event |
| E10 | Message guests | `CalEventSheet.ios.tsx`, `SelectField.ios.tsx` | Open it, use its select field, then use ✓ and ✕ | As E9, and the select works as in E7 | Not run: send needs an RSVP'd guest (none). Check-in select works, ✓ stays disabled with no recipients, ✕ closes |
| E11 | Sent messages | `CalEventSheet.ios.tsx` | Open it, then tap ✕ | Messages are listed and ✕ closes it | Not run: no sent messages to list. Empty state shows and ✕ closes |

## F. More and profile

| ID | Page | Edited | Do this | Expected | Result |
|---|---|---|---|---|---|
| F1 | More | `(more)/index.ios.tsx` | Check the header and tap your avatar | There's a large "More" title, and the profile sheet opens | ✅ Large More title; avatar opens the profile sheet |
| F2 | Profile sheet | `profile-sheet.ios.tsx` | Check the sheet and tap ✕ | The title is "You" and ✕ closes it | ✅ Title You, ✕ closes it; light and dark |

## G. Cal Video

Rooms only exist on production, and the app can only join as a guest. A person hosts on `cal.video` from a browser and hands the tester the room URL. The room ends when the host leaves, so the host's tab has to stay open, and the host may need to let the tester in.

Open the room on the simulator with this command, using the room's slug:

```bash
xcrun simctl openurl <udid> "calcom://video?url=https%3A%2F%2Fcal.video%2F<slug>"
```

The dev build's floating gear button can sit on top of the chat ✕ and block it, so drag the gear out of the way first. The simulator has no real camera, so check outgoing video from the host's browser. Skip raise hand and reactions, which aren't enabled. With live video, tap by label ("Leave", "Mute", "Chat", "Close chat") rather than by screen position, and use screenshots to check results.

| ID | Page | Edited | Do this | Expected | Result |
|---|---|---|---|---|---|
| G1 | Pre-join | `PreJoinScreen.tsx` | Open a call link | The screen fills the display, with the camera preview in the right place | ✅ iOS 26 simulator, 6 Nov |
| G2 | Call grid | `ParticipantGrid.tsx` | Join the call | The call fills the screen, and video and audio work both ways | Joined on iOS 26 simulator, and the host saw the guest appear. Audio and video not tested |
| G3 | Participant tile | `ParticipantTile.tsx` | Turn a camera off and on | The avatar fills and centres in the tile, and video comes back | Avatars fill and centre correctly. Camera on and off not tested |
| G4 | Call | `ParticipantGrid.tsx` | Open chat and the host controls, then leave | Both work, and the call ends cleanly | Chat send and close, mute and leave ✅. Host controls not tested |
| G5 | Call, real phone | Not edited | Share your screen | The other side sees the screen | |
| G6 | Call, real phone | Not edited | Take an incoming call during the call | CallKeep handles it and the call recovers | |

## H. Web

Android is out of scope for now, so this section only covers web and the browser extension.

The main bug to look for is **a second header or duplicate buttons.** Each page should have one header, with one set of buttons.

| ID | Page | Edited | Do this | Expected | Result |
|---|---|---|---|---|---|
| H1 | Availability list | `(availability)/index.tsx` | Open it | There's no native header or toolbar. The page's own search filters the list | |
| H2 | Links list | `(event-types)/index.tsx` | Open it, then search and create | There's no native header. In-page search and New work | |
| H3 | Booking detail | `booking-detail.tsx` | Check the header buttons | The custom left and right buttons work, with no duplicates | |
| H4 | Link detail | `event-type-detail.tsx` | Check the header and save | The custom buttons work, with no duplicates | |
| H5 | Edit event | `EditCalEventScreen.tsx` | Edit, then leave without saving | There's one header with working buttons, and the Unsaved changes alert appears as in E6 | |
| H6 | Modals | `add-guests.tsx`, `edit-location.tsx`, `mark-no-show.tsx`, `meeting-session-details.tsx`, `reschedule.tsx`, `view-recordings.tsx` | Open each one | The custom header works, with no duplicate buttons | |
| H7 | Theme | `app/_layout.tsx` | Switch light and dark mode | Colours follow the mode | |
| H8 | Extension | `apps/extension/package.json` | Load the extension and sign in | It opens, signs in and loads bookings on React 19.2.3 | |

## I. Not edited, but changed by the SDK

No code changed for these, but their dependencies did. Expo 57 also brings Hermes v1 and a new default `fetch`, which affect the whole app.

| ID | Area | Do this | Expected | Result |
|---|---|---|---|---|
| I1 | API calls | Use the app normally, then go offline and back | Data loads, errors show properly and the app recovers | Not run: going offline would cut the Mac's shared network. API errors did show in the UI; Bookings had not recovered at end of run (cause unknown) |
| I2 | Cached data | Install over a production build, or sign in on a device with old data | No crash on any list | ✅ No crash on any list with this simulator's existing data. Install over a production build not tested |
| I3 | Push notifications | Receive one, then tap it | It opens the right screen | Not run: needs real device |
| I4 | Deep links | Open a booking link and an OAuth callback | Both open the right screen | ✅ Fixed in d973428, retested 10 Nov: a booking link and a tab link open the right screen in the running app. Video link and OAuth callback OK. Opening a link while the app is closed not tested |
| I5 | Date and time pickers | Use them in Reschedule and Availability | They look right and save the right value | ✅ Availability time picker saved 10:00 AM. Reschedule date picker saved a new date (B10) |
| I6 | Photo upload | Upload an event cover photo, including HEIC | The upload succeeds | ✅ Fixed in 833afca, retested 10 Nov: cover upload saves, including the HEIC photo, and the image loads from the R2 bucket |
| I7 | QR check-in | Scan a ticket | The camera opens and the scan works | Not run: needs real device |
| I8 | Live Activity | Have a call coming up | The Live Activity shows the next call | Not run: needs real device |
| I9 | Widget | Add the Upcoming Bookings widget | It shows bookings | Not run: needs real device |
| I10 | Share and copy | Share and copy a link | Both work | ✅ Share opens the system sheet with the event link; Copy link put the right URL on the clipboard (links and events) |
| I11 | Performance | Scroll long lists and use the app for a while | No new jank or slowdown | ✅ Rough check only: fast scrolling on Events and about 3 hours of use with no freeze or crash. Dev build, frames not measured, Bookings and Availability lists not scrollable (blank) |

## Coverage

Every file changed under `apps/mobile`, and the tests that cover it.

| File | Tests |
|---|---|
| `app/_layout.tsx` | A1 to A4, H7 |
| `app/(tabs)/(availability)/availability-detail.ios.tsx` | D6 |
| `app/(tabs)/(availability)/index.tsx` | D1 to D3, H1 |
| `app/(tabs)/(bookings)/booking-detail.ios.tsx` | B6 to B9 |
| `app/(tabs)/(bookings)/booking-detail.tsx` | H3 |
| `app/(tabs)/(bookings)/index.ios.tsx` | B1 |
| `app/(tabs)/(event-types)/event-type-detail.tsx` | C7, C8, H4 |
| `app/(tabs)/(event-types)/index.ios.tsx` | C1 to C4 |
| `app/(tabs)/(event-types)/index.tsx` | H2 |
| `app/(tabs)/(events)/index.ios.tsx` | E1 |
| `app/(tabs)/(more)/index.ios.tsx` | F1 |
| `app/add-guests.ios.tsx` | B13 |
| `app/add-guests.tsx` | H6 |
| `app/edit-availability-day.ios.tsx` | D10 |
| `app/edit-availability-hours.ios.tsx` | D9 |
| `app/edit-availability-name.ios.tsx` | D7, D8 |
| `app/edit-availability-override.ios.tsx` | D11 |
| `app/edit-location.ios.tsx` | B11, B12 |
| `app/edit-location.tsx` | H6 |
| `app/mark-no-show.ios.tsx` | B14 |
| `app/mark-no-show.tsx` | H6 |
| `app/meeting-session-details.ios.tsx` | B16 |
| `app/meeting-session-details.tsx` | H6 |
| `app/profile-sheet.ios.tsx` | F2 |
| `app/reschedule.ios.tsx` | B10 |
| `app/reschedule.tsx` | H6 |
| `app/view-recordings.ios.tsx` | B15 |
| `app/view-recordings.tsx` | H6 |
| `components/LocationsListIOSPicker.ios.tsx` | C13 |
| `components/availability-list-item/AvailabilityListItem.ios.tsx` | D4, D5 |
| `components/booking-list-item/BookingListItem.ios.tsx` | B2 to B4 |
| `components/booking-list-item/RecurringBookingListItem.ios.tsx` | B5 |
| `components/cal-event-list-item/CalEventMenu.ios.tsx` | E2 |
| `components/cal-events/EditCalEventScreen.tsx` | E3 to E6, H5 |
| `components/cal-events/edit/SelectField.ios.tsx` | E7, E8, E10 |
| `components/event-type-detail/tabs/AvailabilityTabIOSPicker.ios.tsx` | C10 |
| `components/event-type-detail/tabs/IOSPickerTrigger.ios.tsx` | C9 |
| `components/event-type-detail/tabs/LimitsTabIOSPicker.ios.tsx` | C11 |
| `components/event-type-detail/tabs/RecurringTabIOSPicker.ios.tsx` | C12 |
| `components/event-type-list-item/EventTypeListItem.ios.tsx` | C5, C6 |
| `components/screens/CalEventSheet.ios.tsx` | E9 to E11 |
| `components/screens/EditAvailabilityNameScreen.ios.tsx` | D7 |
| `components/screens/EditLocationScreen.ios.tsx` | B11 |
| `components/video-call/ParticipantGrid.tsx` | G2, G4 |
| `components/video-call/ParticipantTile.tsx` | G3 |
| `components/video-call/PreJoinScreen.tsx` | G1 |

These changed but need no manual test:

| File | Why |
|---|---|
| `components/event-type-detail/tabs/BasicsTabIOSPicker.ios.tsx` | Nothing renders it. It was converted so it still compiles |
| `components/screens/MeetingSessionDetailsScreen.tsx` | Formatting only |
| `components/screens/ViewRecordingsScreen.tsx` | Formatting only |
| `components/RichText.test.js` | Test file, covered by Jest |
