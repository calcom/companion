"""Create the bookings the Bookings suite uses on the Cal.com test account.

Runs after cleanup-test-data. Everything is named with the suite's prefix
"autosana-bookings-", so the cleanup-test-data teardown removes it: it
deletes the links and schedule and cancels the bookings, including the new
booking a reschedule makes. Creates a schedule that is free all day and these
links on it:

- "autosana-bookings-meeting": 15 minutes, with a meeting link
  (https://example.com), so its bookings have a Join button
- "autosana-bookings-address": 15 minutes, at an address, so no Join button
- "autosana-bookings-recurring": 15 minutes at the address, weekly, 3 times
- "autosana-bookings-started": 4 hours at the address

and one booking per job, each with its own attendee, so a flow can find its
booking by the attendee's name. Booking titles read
"<link> between … and <attendee>".

- "Autosana Join" (meeting): the detail header, Copy Meeting Link and Join
- "Autosana Location" (address): Edit Location and Add Guests
- "Autosana Reschedule" (meeting): Reschedule
- "Autosana Cancel" (address): Cancel Event
- "Autosana Recurring" (recurring): a series of 3 weekly bookings
- "Autosana Started" (started): starts 75 seconds after this hook runs, so
  it's in progress for the suite's flows, which is when Mark as No-Show and
  the After Event menu group appear. The API doesn't accept bookings in the
  past, and it can't cancel or delete one that has ended, so a booking left
  to end would stay in the account's Past list for good. This one lasts 4
  hours, and the teardown cancels it while it's still in progress.

Needs CAL_API_KEY, the test account's API key (an Autosana environment
secret). Hooks may only use the standard library.
"""

import json
import os
import time
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone

API = "https://api.cal.com/v2"
PREFIX = "autosana-bookings-"
ALL_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
ADDRESS = "1 Autosana Street, Vienna"


class ApiError(SystemExit):
    """Stops the hook with the API's answer, unless the caller handles it.

    SystemExit uses .code as the exit status and prints it only when it is a
    string, so the HTTP status goes in .status and .code stays the message.
    """

    def __init__(self, status, message):
        super().__init__(message)
        self.status = status


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
        with urllib.request.urlopen(request, timeout=15) as response:
            text = response.read().decode()
    except urllib.error.HTTPError as error:
        raise ApiError(error.code, f"{method} {path} -> {error.code}: {error.read().decode()[:300]}")
    return json.loads(text) if text else {}


def iso(moment):
    return moment.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")


time_zone = call("GET", "/me", "2024-06-11")["data"]["timeZone"]
now = datetime.now(timezone.utc)

# Free all day, every day, so bookings can go at any time without slot lookups.
schedule = call(
    "POST",
    "/schedules",
    "2024-06-11",
    {
        "name": PREFIX + "schedule",
        "timeZone": "UTC",
        "isDefault": False,
        "availability": [{"days": ALL_WEEK, "startTime": "00:00", "endTime": "23:59"}],
    },
)["data"]


def create_link(name, minutes, location, **settings):
    body = {
        "title": PREFIX + name,
        "slug": PREFIX + name,
        "lengthInMinutes": minutes,
        "scheduleId": schedule["id"],
        "minimumBookingNotice": 0,
        "locations": [location],
        **settings,
    }
    return call("POST", "/event-types", "2024-06-14", body)["data"]["id"]


address = {"type": "address", "address": ADDRESS, "public": True}
meeting = create_link("meeting", 15, {"type": "link", "link": "https://example.com", "public": True})
at_address = create_link("address", 15, address)
recurring = create_link(
    "recurring", 15, address, recurrence={"frequency": "weekly", "interval": 1, "occurrences": 3}
)
started = create_link("started", 240, address)


class Conflict(Exception):
    pass


def book(event_type_id, attendee, start, conflict_ok=False, **extra):
    slug = attendee.lower().replace(" ", "-")
    body = {
        "start": iso(start),
        "eventTypeId": event_type_id,
        "attendee": {
            "name": attendee,
            # The shared QA Gmail; the plus part keeps each address unique.
            "email": f"calcom.qa+{PREFIX}{slug}-{int(time.time())}@gmail.com",
            "timeZone": time_zone,
            "language": "en",
        },
        **extra,
    }
    try:
        call("POST", "/bookings", "2024-08-13", body)
    except ApiError as error:
        # 409: the host already has a booking then.
        if conflict_ok and error.status == 409:
            raise Conflict() from error
        raise


# Two days ahead at 17:00 UTC is morning in US Pacific time, the simulators'
# zone, so every booking is upcoming and on the same day there.
day = (now + timedelta(days=2)).replace(hour=17, minute=0, second=0, microsecond=0)
book(meeting, "Autosana Join", day)
book(at_address, "Autosana Location", day + timedelta(minutes=30))
book(meeting, "Autosana Reschedule", day + timedelta(minutes=60))
book(at_address, "Autosana Cancel", day + timedelta(minutes=90))
book(recurring, "Autosana Recurring", day + timedelta(days=1, minutes=120), recurrenceCount=3)

# If something else is booked when this one should start, try a little later.
soon = now.replace(microsecond=0)
for delay in (75, 435, 795):
    try:
        book(started, "Autosana Started", soon + timedelta(seconds=delay), conflict_ok=True)
        break
    except Conflict:
        continue
else:
    raise SystemExit("The host is busy in the next 15 minutes, so Autosana Started wasn't booked")

print(
    f"Created the links {PREFIX}meeting (meeting link https://example.com), {PREFIX}address "
    f"({ADDRESS}), {PREFIX}recurring (weekly, 3 times) and {PREFIX}started, and bookings with "
    "the attendees Autosana Join, Autosana Location, Autosana Reschedule and Autosana Cancel "
    f"on {day:%A %d %B}, a weekly series of 3 with Autosana Recurring from the day after, "
    "and a 4-hour booking with Autosana Started that starts in about a minute, so it's in "
    "progress during the flows."
)
