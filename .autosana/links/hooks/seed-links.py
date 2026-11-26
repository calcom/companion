"""Create the data the Links suite uses on the Cal.com test account.

Runs after cleanup-test-data. Everything is named with the suite's prefix
"autosana-links-", so the cleanup-test-data teardown removes it, along with
any copy a flow makes in the app ("autosana-links-edit (copy)"). Creates:

- two schedules, "autosana-links-schedule-a" (Monday to Friday, 09:00 to
  17:00) and "autosana-links-schedule-b" (Monday to Friday, 10:00 to 16:00)
- a 30-minute link "autosana-links-edit" on schedule A, with Cal Video as
  its location, no buffers and 2 hours' minimum notice. The flows edit it.
- a 45-minute link "autosana-links-recurring" that repeats weekly 4 times

Needs CAL_API_KEY, the test account's API key (an Autosana environment
secret). Hooks may only use the standard library.
"""

import json
import os
import urllib.error
import urllib.request

API = "https://api.cal.com/v2"
PREFIX = "autosana-links-"
WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]


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
        with urllib.request.urlopen(request, timeout=10) as response:
            text = response.read().decode()
    except urllib.error.HTTPError as error:
        raise SystemExit(f"{method} {path} -> {error.code}: {error.read().decode()[:300]}")
    return json.loads(text) if text else {}


time_zone = call("GET", "/me", "2024-06-11")["data"]["timeZone"]


def create_schedule(name, start, end):
    body = {
        "name": name,
        "timeZone": time_zone,
        "isDefault": False,
        "availability": [{"days": WEEKDAYS, "startTime": start, "endTime": end}],
    }
    return call("POST", "/schedules", "2024-06-11", body)["data"]


def create_link(title, minutes, **settings):
    body = {"title": title, "slug": title, "lengthInMinutes": minutes, **settings}
    return call("POST", "/event-types", "2024-06-14", body)["data"]


schedule_a = create_schedule(PREFIX + "schedule-a", "09:00", "17:00")
create_schedule(PREFIX + "schedule-b", "10:00", "16:00")

# The app counts a link as edited when the minimum notice is 0 or no schedule
# is set, so set both: Save must start disabled.
create_link(
    PREFIX + "edit",
    30,
    description="Edited by the Autosana links suite and deleted after it runs.",
    scheduleId=schedule_a["id"],
    minimumBookingNotice=120,
    beforeEventBuffer=0,
    afterEventBuffer=0,
    locations=[{"type": "integration", "integration": "cal-video"}],
)
create_link(
    PREFIX + "recurring",
    45,
    description="A recurring link for the Autosana links suite's filters.",
    scheduleId=schedule_a["id"],
    minimumBookingNotice=120,
    recurrence={"frequency": "weekly", "interval": 1, "occurrences": 4},
)

print(
    f'Created the schedules "{PREFIX}schedule-a" and "{PREFIX}schedule-b", the 30-minute '
    f'link "{PREFIX}edit" (Cal Video, on schedule-a) and the 45-minute weekly link '
    f'"{PREFIX}recurring" (4 times).'
)
