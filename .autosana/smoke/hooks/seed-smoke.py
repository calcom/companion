"""Create the data the Smoke suite checks on the Cal.com test account.

Runs after cleanup-test-data. Creates:

- a schedule named "autosana-smoke" (09:00 to 17:00 every day)
- a 15-minute link (event type) titled "autosana-smoke" that uses it
- one upcoming booking of that link with the attendee "Autosana Smoke"

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
NAME = "autosana-smoke"
ATTENDEE = "Autosana Smoke"
DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


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
        raise SystemExit(f"{method} {path} -> {error.code}: {error.read().decode()[:300]}")
    return json.loads(text) if text else {}


def parse_time(value):
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


me = call("GET", "/me", "2024-06-11")["data"]
time_zone = me.get("timeZone") or "Europe/London"

schedule = call(
    "POST",
    "/schedules",
    "2024-06-11",
    {
        "name": NAME,
        "timeZone": time_zone,
        "isDefault": False,
        "availability": [{"days": DAYS, "startTime": "09:00", "endTime": "17:00"}],
    },
)["data"]

event_type = call(
    "POST",
    "/event-types",
    "2024-06-14",
    {
        "title": NAME,
        "slug": NAME,
        "lengthInMinutes": 15,
        "description": "Created by the Autosana smoke suite and deleted after it runs.",
        "scheduleId": schedule["id"],
    },
)["data"]

# Book the first free slot from tomorrow on, so the booking is upcoming
# whatever time zone the device uses.
now = datetime.now(timezone.utc)
first_day = (now + timedelta(days=1)).date()
query = (
    f"eventTypeId={event_type['id']}&start={first_day.isoformat()}"
    f"&end={(first_day + timedelta(days=7)).isoformat()}&timeZone=UTC"
)
# A new link can show no slots for a few seconds, so ask again before giving up.
starts = []
for attempt in range(6):
    slots_by_day = call("GET", f"/slots?{query}", "2024-09-04").get("data") or {}
    starts = sorted(
        parse_time(slot["start"])
        for day in slots_by_day.values()
        for slot in day
        if parse_time(slot["start"]) > now + timedelta(hours=12)
    )
    if starts:
        break
    time.sleep(5)
if not starts:
    raise SystemExit(f"No free slot for {NAME} in the next week")

call(
    "POST",
    "/bookings",
    "2024-08-13",
    {
        "start": starts[0].astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z"),
        "eventTypeId": event_type["id"],
        "attendee": {
            "name": ATTENDEE,
            # The shared QA Gmail; the plus part keeps each run's address unique.
            "email": f"calcom.qa+autosana-{int(time.time())}@gmail.com",
            "timeZone": time_zone,
            "language": "en",
        },
    },
)

print(
    f'Created the schedule "{NAME}", the 15-minute link "{NAME}" and one upcoming '
    f'booking of it with the attendee "{ATTENDEE}".'
)
