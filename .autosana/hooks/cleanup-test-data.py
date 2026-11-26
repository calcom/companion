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
        with urllib.request.urlopen(request, timeout=20) as response:
            text = response.read().decode()
    except urllib.error.HTTPError as error:
        raise ApiError(f"{method} {path} -> {error.code}: {error.read().decode()[:300]}")
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


failures = []

# Cal Events go first: publishing one creates a booking with its title, and
# the Cal Events API takes care of it. The booking sweep below catches any left.
test_events = test_cal_events()
for event in test_events:
    try:
        remove_cal_event(event)
    except ApiError as error:
        failures.append(str(error))

event_types = call("GET", "/event-types", "2024-06-14").get("data") or []
test_event_types = [e for e in event_types if is_test_item(e.get("slug"), e.get("title"))]
test_event_type_ids = {e["id"] for e in test_event_types}

cancelled = 0
for booking in upcoming_bookings():
    event_type = booking.get("eventType") or {}
    if not (
        booking.get("eventTypeId") in test_event_type_ids
        or is_test_item(booking.get("title"), event_type.get("slug"))
    ):
        continue
    try:
        call(
            "POST",
            f"/bookings/{booking['uid']}/cancel",
            "2024-08-13",
            {"cancellationReason": "Autosana test cleanup"},
        )
        cancelled += 1
    except ApiError as error:
        failures.append(str(error))

for event_type in test_event_types:
    try:
        call("DELETE", f"/event-types/{event_type['id']}", "2024-06-14")
    except ApiError as error:
        failures.append(str(error))

schedules = call("GET", "/schedules", "2024-06-11").get("data") or []
test_schedules = [s for s in schedules if is_test_item(s.get("name")) and not s.get("isDefault")]
for schedule in test_schedules:
    try:
        call("DELETE", f"/schedules/{schedule['id']}", "2024-06-11")
    except ApiError as error:
        failures.append(str(error))

print(
    f"Cleanup: cancelled {cancelled} autosana- booking(s), deleted "
    f"{len(test_event_types)} autosana- link(s), {len(test_schedules)} autosana- schedule(s) "
    f"and {len(test_events)} autosana- Cal Event(s)."
)
if failures:
    print("Cleanup could not remove everything:\n" + "\n".join(failures))
    sys.exit(1)
