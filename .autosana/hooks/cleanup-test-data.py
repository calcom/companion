"""Remove leftover autosana- test data from the Cal.com test account.

Suites run this first in their setup hooks, in case an earlier run stopped
before its teardown, and again as their teardown hook. Every suite whose hooks
create data must run it as a teardown hook, and a hook that creates a new kind
of item must teach this one to remove it. It only touches items whose title,
slug or name starts with "autosana-":

- deletes autosana- Cal Events, cancelling a published one first if it can't
  be deleted as it is
- cancels upcoming and unconfirmed autosana- bookings
- deletes autosana- links (event types)
- deletes autosana- schedules, never the default one

Needs CAL_API_KEY, the test account's API key (an Autosana environment
secret). Hooks may only use the standard library.
"""

import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request

API = "https://api.cal.com/v2"
PREFIX = "autosana-"
# The whole hook has one minute, so a slow request must not use most of it.
TIMEOUT_SECONDS = 10


class ApiError(Exception):
    pass


def call(method, path, version, body=None):
    headers = {
        "Authorization": "Bearer " + os.environ["CAL_API_KEY"],
        "cal-api-version": version,
        # Cloudflare refuses urllib's default User-Agent (error 1010).
        "User-Agent": "calcom-companion-autosana-hooks/1.0",
    }
    data = None
    if body is not None:
        data = json.dumps(body).encode()
        headers["Content-Type"] = "application/json"
    request = urllib.request.Request(API + path, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=TIMEOUT_SECONDS) as response:
            text = response.read().decode()
    except urllib.error.HTTPError as error:
        raise ApiError(f"{method} {path} -> {error.code}: {error.read().decode()[:300]}")
    except OSError as error:
        # Timeouts, refused or dropped connections, DNS failures.
        raise ApiError(f"{method} {path} -> {error!r}")
    return json.loads(text) if text else {}


def is_test_item(*names):
    return any(isinstance(name, str) and name.startswith(PREFIX) for name in names)


def upcoming_bookings():
    bookings = []
    for page in range(10):
        query = f"status=upcoming&status=unconfirmed&take=100&skip={page * 100}"
        batch = call("GET", f"/bookings?{query}", "2024-08-13").get("data") or []
        bookings.extend(batch)
        if len(batch) < 100:
            break
    return bookings


def test_cal_events():
    events = {}
    for status in ("draft", "upcoming", "past"):
        cursor = None
        for page in range(10):
            query = f"status={status}&limit=50"
            if cursor:
                query += "&cursor=" + urllib.parse.quote(cursor)
            # This API version pages with limit and cursor and filters by status.
            response = call("GET", f"/events?{query}", "2026-05-01")
            for event in response.get("data") or []:
                if is_test_item(event.get("title"), event.get("slug")):
                    events[event["uuid"]] = event
            pagination = response.get("pagination") or {}
            cursor = pagination.get("nextCursor")
            if not (pagination.get("hasMore") and cursor):
                break
    return list(events.values())


def remove_cal_event(event):
    path = f"/events/{event['uuid']}"
    try:
        call("DELETE", path, "2024-06-14")
    except ApiError:
        # A published event with guests has to be cancelled before it can be deleted.
        if not event.get("publishedAt") or event.get("cancelledAt"):
            raise
        call("POST", f"{path}/cancel", "2024-06-14", {"reason": "Autosana test cleanup"})
        call("DELETE", path, "2024-06-14")


def is_test_booking(booking, test_event_type_ids):
    event_type = booking.get("eventType") or {}
    return booking.get("eventTypeId") in test_event_type_ids or is_test_item(
        booking.get("title"), event_type.get("slug")
    )


failures = []


def attempt(label, action, *args):
    """Run one step. If it fails, note why and return False, so the rest still runs."""
    try:
        action(*args)
    except Exception as error:
        failures.append(f"{label}: {error}")
        return False
    return True


def listed(label, list_items):
    """Like attempt, for a listing: an empty list if it fails."""
    try:
        return list_items()
    except Exception as error:
        failures.append(f"{label}: {error}")
        return []


def list_test_event_types():
    event_types = call("GET", "/event-types", "2024-06-14").get("data") or []
    return [e for e in event_types if is_test_item(e.get("slug"), e.get("title"))]


def list_test_schedules():
    schedules = call("GET", "/schedules", "2024-06-11").get("data") or []
    return [s for s in schedules if is_test_item(s.get("name")) and not s.get("isDefault")]


# Cal Events go first: publishing one creates a booking with its title, and
# deleting the event cancels it. The booking sweep below catches any left.
deleted_events = 0
for event in listed("list Cal Events", test_cal_events):
    if attempt(f"delete Cal Event {event.get('title')}", remove_cal_event, event):
        deleted_events += 1

# If the links can't be listed, bookings are still matched by title.
test_event_types = listed("list links", list_test_event_types)
test_event_type_ids = {e["id"] for e in test_event_types}

cancelled = 0
for booking in listed("list bookings", upcoming_bookings):
    if not is_test_booking(booking, test_event_type_ids):
        continue
    cancel = f"/bookings/{booking['uid']}/cancel"
    reason = {"cancellationReason": "Autosana test cleanup"}
    if attempt(f"cancel booking {booking.get('title')}", call, "POST", cancel, "2024-08-13", reason):
        cancelled += 1

deleted_links = 0
for event_type in test_event_types:
    path = f"/event-types/{event_type['id']}"
    if attempt(f"delete link {event_type.get('slug')}", call, "DELETE", path, "2024-06-14"):
        deleted_links += 1

deleted_schedules = 0
for schedule in listed("list schedules", list_test_schedules):
    path = f"/schedules/{schedule['id']}"
    if attempt(f"delete schedule {schedule.get('name')}", call, "DELETE", path, "2024-06-11"):
        deleted_schedules += 1

print(
    f"Cleanup: deleted {deleted_events} autosana- Cal Event(s), cancelled {cancelled} "
    f"autosana- booking(s), deleted {deleted_links} autosana- link(s) and "
    f"{deleted_schedules} autosana- schedule(s)."
)
if failures:
    print("Cleanup could not remove everything:\n" + "\n".join(failures))
    sys.exit(1)
