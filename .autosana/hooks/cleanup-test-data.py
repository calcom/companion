"""Remove one suite's test data from the Cal.com test account, and put back
the account settings the suite may have changed.

Each suite names everything it creates, in hooks or in the app, with its own
prefix, set as the suite variable TEST_PREFIX (for example
"autosana-bookings-"). The suite runs this hook first in its setup hooks, in
case an earlier run stopped before its teardown, and again as its teardown
hook. It only touches items whose title, slug or name starts with that prefix:

- if the default schedule is one of the suite's, makes the account's own
  schedule the default again
- deletes the suite's Cal Events, cancelling a published one first if it
  can't be deleted as it is
- cancels the suite's upcoming and unconfirmed bookings, including ones in
  progress. The API can't delete a booking, so they stay in the Cancelled
  list, and it can't cancel one that has ended, so suites must not leave a
  booking to end. Ended ones are only reported.
- deletes the suite's links (event types)
- deletes the suite's schedules, with their date overrides

A suite whose hooks or flows create a new kind of item, or change another
account setting, must teach this hook to remove or restore it.

Needs CAL_API_KEY, the test account's API key (an Autosana environment
secret). Hooks may only use the standard library.
"""

import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request

API = "https://api.cal.com/v2"
PREFIX = os.environ.get("TEST_PREFIX", "")
# Hooks pass values to the suite's later hooks, the teardown included, through this file.
EXPORTS = "/tmp/autosana.env"
# The whole hook has one minute, so a slow request must not use most of it.
TIMEOUT_SECONDS = 10

if not re.fullmatch(r"autosana-[a-z0-9]+(-[a-z0-9]+)*-", PREFIX):
    sys.exit(
        f'TEST_PREFIX must be the suite\'s own prefix, like "autosana-bookings-", not {PREFIX!r}. '
        "Set it under variables in the suite's _suite.yaml."
    )


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


def is_account_item(name):
    """True for the account's own items, which no suite created."""
    return not (isinstance(name, str) and name.startswith("autosana-"))


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


def list_schedules():
    return call("GET", "/schedules", "2024-06-11").get("data") or []


def list_test_cal_events():
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


def list_test_event_types():
    event_types = call("GET", "/event-types", "2024-06-14").get("data") or []
    return [e for e in event_types if is_test_item(e.get("slug"), e.get("title"))]


def list_bookings(*statuses):
    bookings = []
    for page in range(10):
        query = "&".join(f"status={status}" for status in statuses)
        query += f"&take=100&skip={page * 100}"
        batch = call("GET", f"/bookings?{query}", "2024-08-13").get("data") or []
        bookings.extend(batch)
        if len(batch) < 100:
            break
    return bookings


def is_test_booking(booking, test_event_type_ids):
    # A deleted link leaves its bookings with no eventTypeId, so match titles too.
    event_type = booking.get("eventType") or {}
    return booking.get("eventTypeId") in test_event_type_ids or is_test_item(
        booking.get("title"), event_type.get("slug")
    )


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


schedules = listed("list schedules", list_schedules)

# A flow may make one of the suite's schedules the default. Put the account's
# own default back first, because the default schedule can't be deleted.
restored = None
default = next((s for s in schedules if s.get("isDefault")), None)
if default is not None and is_test_item(default.get("name")):
    own = [s for s in schedules if is_account_item(s.get("name"))]
    saved = os.environ.get("ACCOUNT_DEFAULT_SCHEDULE_ID", "")
    target = next((s for s in own if str(s["id"]) == saved), None)
    if target is None and len(own) == 1:
        target = own[0]
    if target is None:
        names = ", ".join(s.get("name", "?") for s in own) or "none"
        failures.append(f"restore the default schedule: can't tell which of these was it: {names}")
    else:
        path = f"/schedules/{target['id']}"
        if attempt("restore the default schedule", call, "PATCH", path, "2024-06-11", {"isDefault": True}):
            default["isDefault"] = False
            target["isDefault"] = True
            restored = target

# Save the account's default for the suite's later hooks, so the teardown can
# restore it even if the account ever has more than one schedule of its own.
account_default = next(
    (s for s in schedules if s.get("isDefault") and is_account_item(s.get("name"))), None
)
if account_default is not None:
    try:
        with open(EXPORTS, "a") as exports:
            exports.write(f"ACCOUNT_DEFAULT_SCHEDULE_ID={account_default['id']}\n")
    except OSError as error:
        failures.append(f"save the default schedule's id: {error}")

# Cal Events go first: publishing one creates a booking with its title, and
# deleting the event cancels it. The booking sweep below catches any left.
deleted_events = 0
for event in listed("list Cal Events", list_test_cal_events):
    if attempt(f"delete Cal Event {event.get('title')}", remove_cal_event, event):
        deleted_events += 1

# If the links can't be listed, bookings are still matched by title.
test_event_types = listed("list links", list_test_event_types)
test_event_type_ids = {e["id"] for e in test_event_types}

cancelled = 0
# Upcoming includes bookings in progress, which can still be cancelled.
for booking in listed("list bookings", lambda: list_bookings("upcoming", "unconfirmed")):
    if not is_test_booking(booking, test_event_type_ids):
        continue
    cancel = f"/bookings/{booking['uid']}/cancel"
    reason = {"cancellationReason": "Autosana test cleanup"}
    if attempt(f"cancel booking {booking.get('title')}", call, "POST", cancel, "2024-08-13", reason):
        cancelled += 1

# Bookings that ended can't be cancelled or deleted, so only report them.
# Look before the links are deleted, while their ids still match.
ended = [
    booking
    for booking in listed("list past bookings", lambda: list_bookings("past"))
    if is_test_booking(booking, test_event_type_ids)
]

deleted_links = 0
for event_type in test_event_types:
    path = f"/event-types/{event_type['id']}"
    if attempt(f"delete link {event_type.get('slug')}", call, "DELETE", path, "2024-06-14"):
        deleted_links += 1

deleted_schedules = 0
for schedule in schedules:
    if not is_test_item(schedule.get("name")) or schedule.get("isDefault"):
        continue
    path = f"/schedules/{schedule['id']}"
    if attempt(f"delete schedule {schedule.get('name')}", call, "DELETE", path, "2024-06-11"):
        deleted_schedules += 1

summary = (
    f"Cleanup of {PREFIX} items: deleted {deleted_events} Cal Event(s), cancelled "
    f"{cancelled} booking(s), deleted {deleted_links} link(s) and {deleted_schedules} schedule(s)."
)
if restored is not None:
    summary += f' Made "{restored.get("name")}" the default schedule again.'
if ended:
    summary += (
        f" {len(ended)} {PREFIX} booking(s) already ended, and the API can't cancel or delete"
        " those, so they stay in the Past list."
    )
print(summary)
if failures:
    print("Cleanup could not remove or restore everything:\n" + "\n".join(failures))
    sys.exit(1)
