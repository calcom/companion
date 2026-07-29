import { deepEqual } from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { generateAuthUrl, CALCOM_OAUTH_SCOPES } from "./oauth";

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

    deepEqual(url.searchParams.get("scope")?.split(" "), CALCOM_OAUTH_SCOPES);
  });
});
