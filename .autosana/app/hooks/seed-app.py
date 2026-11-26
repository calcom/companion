"""Create the data the App suite uses on the Cal.com test account.

Runs after cleanup-test-data. Everything is named with the suite's prefix
"autosana-app-", so the cleanup-test-data teardown removes it, including the
new booking a reschedule makes. Creates:

- a schedule "autosana-app-schedule", Monday to Friday 09:00 to 17:00. A
  flow edits its working hours.
- a schedule "autosana-app-booking-hours" that is free all day, and a
  15-minute link "autosana-app-link" on it, at 1 Autosana Street, Vienna
- one booking of that link with the attendee "Autosana App", three days from
  now. Its uid is saved as APP_BOOKING_UID for the deep link flow.

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
PREFIX = "autosana-app-"
# Hooks pass values to the suite's later hooks and flows through this file.
EXPORTS = "/tmp/autosana.env"
ALL_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


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
        raise SystemExit(f"{method} {path} -> {error.code}: {error.read().decode()[:300]}")
    return json.loads(text) if text else {}


def iso(moment):
    return moment.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")


time_zone = call("GET", "/me", "2024-06-11")["data"]["timeZone"]

# The link books on its own schedule that is free all day, so the booking and
# its reschedule don't depend on the hours a flow edits.
call(
    "POST",
    "/schedules",
    "2024-06-11",
    {
        "name": PREFIX + "schedule",
        "timeZone": time_zone,
        "isDefault": False,
        "availability": [{"days": ALL_WEEK[:5], "startTime": "09:00", "endTime": "17:00"}],
    },
)
booking_schedule = call(
    "POST",
    "/schedules",
    "2024-06-11",
    {
        "name": PREFIX + "booking-hours",
        "timeZone": "UTC",
        "isDefault": False,
        "availability": [{"days": ALL_WEEK, "startTime": "00:00", "endTime": "23:59"}],
    },
)["data"]
link = call(
    "POST",
    "/event-types",
    "2024-06-14",
    {
        "title": PREFIX + "link",
        "slug": PREFIX + "link",
        "lengthInMinutes": 15,
        "scheduleId": booking_schedule["id"],
        "minimumBookingNotice": 0,
        "locations": [{"type": "address", "address": "1 Autosana Street, Vienna", "public": True}],
    },
)["data"]

# Three days ahead at 18:00 UTC is morning in US Pacific time, the
# simulators' zone, and clear of the Bookings suite's times.
start = (datetime.now(timezone.utc) + timedelta(days=3)).replace(
    hour=18, minute=0, second=0, microsecond=0
)
booking = call(
    "POST",
    "/bookings",
    "2024-08-13",
    {
        "start": iso(start),
        "eventTypeId": link["id"],
        "attendee": {
            "name": "Autosana App",
            # The shared QA Gmail; the plus part keeps each run's address unique.
            "email": f"calcom.qa+{PREFIX}{int(time.time())}@gmail.com",
            "timeZone": time_zone,
            "language": "en",
        },
    },
)["data"]

with open(EXPORTS, "a") as exports:
    exports.write(f"APP_BOOKING_UID={booking['uid']}\n")

print(
    f'Created the schedules "{PREFIX}schedule" (Monday to Friday 9:00 AM to 5:00 PM) and '
    f'"{PREFIX}booking-hours", the link "{PREFIX}link" and a booking of it with the attendee '
    f"Autosana App on {start:%A %d %B}, uid {booking['uid']}."
)
