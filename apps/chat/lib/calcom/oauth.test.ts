import { deepEqual } from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { generateAuthUrl } from "./oauth";

const APPROVED_SCOPES = [
  "EVENT_TYPE_READ",
  "EVENT_TYPE_WRITE",
  "BOOKING_READ",
  "BOOKING_WRITE",
  "SCHEDULE_READ",
  "SCHEDULE_WRITE",
  "APPS_READ",
  "APPS_WRITE",
  "PROFILE_READ",
  "PROFILE_WRITE",
  "WEBHOOK_READ",
  "WEBHOOK_WRITE",
  "VERIFIED_RESOURCES_READ",
  "VERIFIED_RESOURCES_WRITE",
  "CREDITS_READ",
  "CREDITS_WRITE",
  "INSIGHTS_READ",
  "TEAM_EVENT_TYPE_READ",
  "TEAM_EVENT_TYPE_WRITE",
  "TEAM_BOOKING_READ",
  "TEAM_BOOKING_WRITE",
  "TEAM_SCHEDULE_READ",
  "TEAM_SCHEDULE_WRITE",
  "TEAM_PROFILE_READ",
  "TEAM_PROFILE_WRITE",
  "TEAM_MEMBERSHIP_READ",
  "TEAM_MEMBERSHIP_WRITE",
  "TEAM_APPS_READ",
  "TEAM_APPS_WRITE",
  "TEAM_ROUTING_FORM_READ",
  "TEAM_ROUTING_FORM_WRITE",
  "TEAM_WORKFLOW_READ",
  "TEAM_WORKFLOW_WRITE",
  "TEAM_VERIFIED_RESOURCES_READ",
  "TEAM_VERIFIED_RESOURCES_WRITE",
  "TEAM_INSIGHTS_READ",
  "ORG_EVENT_TYPE_READ",
  "ORG_EVENT_TYPE_WRITE",
  "ORG_BOOKING_READ",
  "ORG_BOOKING_WRITE",
  "ORG_SCHEDULE_READ",
  "ORG_SCHEDULE_WRITE",
  "ORG_PROFILE_READ",
  "ORG_PROFILE_WRITE",
  "ORG_MEMBERSHIP_READ",
  "ORG_MEMBERSHIP_WRITE",
  "ORG_ROUTING_FORM_READ",
  "ORG_ROUTING_FORM_WRITE",
  "ORG_WEBHOOK_READ",
  "ORG_WEBHOOK_WRITE",
  "ORG_INSIGHTS_READ",
  "ORG_ATTRIBUTES_READ",
  "ORG_ATTRIBUTES_WRITE",
] as const;

const originalEncryptionKey = process.env.SLACK_ENCRYPTION_KEY;
const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;

afterEach(() => {
  if (originalEncryptionKey === undefined) delete process.env.SLACK_ENCRYPTION_KEY;
  else process.env.SLACK_ENCRYPTION_KEY = originalEncryptionKey;

  if (originalAppUrl === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
  else process.env.NEXT_PUBLIC_APP_URL = originalAppUrl;
});

describe("generateAuthUrl", () => {
  it("requests every approved Cal.com OAuth scope", () => {
    process.env.SLACK_ENCRYPTION_KEY = "test-signing-key";
    process.env.NEXT_PUBLIC_APP_URL = "https://chat.example.com";

    const url = new URL(generateAuthUrl("slack", "team-1", "user-1"));

    deepEqual(url.searchParams.get("scope")?.split(" "), APPROVED_SCOPES);
  });
});
