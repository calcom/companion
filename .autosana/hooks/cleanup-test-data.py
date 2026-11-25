"""Remove leftover autosana- test data from the Cal.com test account.

Suites run this first in their setup hooks, in case an earlier run stopped
before its teardown, and again as their teardown hook. It only touches items
whose title, slug or name starts with "autosana-":

- cancels upcoming and unconfirmed bookings of autosana- links
- deletes autosana- links (event types)
- deletes autosana- schedules, never the default one

Needs CAL_API_KEY, the test account's API key (an Autosana environment
secret). Hooks may only use the standard library.
"""

import json
import os
import sys
import urllib.error
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


failures = []

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
    f"{len(test_event_types)} autosana- link(s) and {len(test_schedules)} autosana- schedule(s)."
)
if failures:
    print("Cleanup could not remove everything:\n" + "\n".join(failures))
    sys.exit(1)
