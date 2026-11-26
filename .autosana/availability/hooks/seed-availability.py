"""Create the schedules the Availability suite uses on the Cal.com test account.

Runs after cleanup-test-data. Everything is named with the suite's prefix
"autosana-availability-", so the cleanup-test-data teardown deletes it, along
with the schedules flows make in the app ("autosana-availability-new" and
"autosana-availability-edit (Copy)"). A flow makes "autosana-availability-default"
the default schedule; the teardown makes the account's own schedule the
default again first. Creates three schedules, Monday to Friday, 09:00 to
17:00, in the account's time zone:

- "autosana-availability-edit": the flows rename it, change its time zone,
  working hours and date overrides
- "autosana-availability-default": a flow makes it the default
- "autosana-availability-delete": a flow deletes it

Needs CAL_API_KEY, the test account's API key (an Autosana environment
secret). Hooks may only use the standard library.
"""

import json
import os
import urllib.error
import urllib.request

API = "https://api.cal.com/v2"
PREFIX = "autosana-availability-"
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
for name in ("edit", "default", "delete"):
    body = {
        "name": PREFIX + name,
        "timeZone": time_zone,
        "isDefault": False,
        "availability": [{"days": WEEKDAYS, "startTime": "09:00", "endTime": "17:00"}],
    }
    call("POST", "/schedules", "2024-06-11", body)

print(
    f'Created the schedules "{PREFIX}edit", "{PREFIX}default" and "{PREFIX}delete", '
    f"each Monday to Friday 9:00 AM to 5:00 PM in {time_zone}, with no date overrides."
)
