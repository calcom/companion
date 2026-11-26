"""Create the Cal Events the Events suite uses on the Cal.com test account.

Runs after cleanup-test-data. Everything is named with the suite's prefix
"autosana-events-", so the cleanup-test-data teardown deletes it, cancelling
a published event first where it has to. Creates three public events, each
two hours long, five days from now at 1 Autosana Street, Vienna:

- "autosana-events-draft": a draft. The flows edit it.
- "autosana-events-published": published. A flow invites a guest to it.
- "autosana-events-cancel": published. A flow cancels it.

Needs CAL_API_KEY, the test account's API key (an Autosana environment
secret). Hooks may only use the standard library.
"""

import json
import os
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone

API = "https://api.cal.com/v2"
PREFIX = "autosana-events-"


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
start = (datetime.now(timezone.utc) + timedelta(days=5)).replace(
    hour=17, minute=0, second=0, microsecond=0
)


def create_event(name, publish):
    body = {
        "title": PREFIX + name,
        "startTime": iso(start),
        "endTime": iso(start + timedelta(hours=2)),
        "timeZone": time_zone,
        "visibility": "PUBLIC",
        "requiresApproval": False,
        "locations": [{"type": "address", "address": "1 Autosana Street, Vienna"}],
    }
    event = call("POST", "/events", "2024-06-14", body)["data"]
    if publish:
        call("POST", f"/events/{event['uuid']}/publish", "2024-06-14")
    return event


draft = create_event("draft", publish=False)
create_event("published", publish=True)
create_event("cancel", publish=True)

payments = "on" if draft.get("paymentsEnabled") is not False else "off"
print(
    f'Created the Cal Events "{PREFIX}draft" (a draft), "{PREFIX}published" and '
    f'"{PREFIX}cancel" (both published), on {start:%A %d %B} at 1 Autosana Street, '
    f"Vienna. Payments are {payments} for this account's events."
)
