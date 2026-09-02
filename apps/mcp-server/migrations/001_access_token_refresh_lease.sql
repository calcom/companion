-- Apply before deploying code that enables lease-based Cal.com token refreshes.
-- This migration is additive so old MCP server instances continue to work while
-- the new version is deployed and old Vercel invocations drain.
BEGIN;

ALTER TABLE "AccessToken"
  ADD COLUMN IF NOT EXISTS "refreshLeaseId" TEXT,
  ADD COLUMN IF NOT EXISTS "refreshLeaseUntil" INTEGER,
  ADD COLUMN IF NOT EXISTS "calTokenVersion" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "calTokenInvalidAt" INTEGER,
  ADD COLUMN IF NOT EXISTS "refreshExpiresAt" INTEGER;

-- Preserve issuance-based lifetime for existing grants. Rows older than 30 days
-- deliberately receive an already-expired timestamp and are removed by cleanup.
UPDATE "AccessToken"
SET "refreshExpiresAt" = "createdAt" + 2592000
WHERE "refreshExpiresAt" IS NULL;

ALTER TABLE "AccessToken"
  ALTER COLUMN "refreshExpiresAt" SET DEFAULT (EXTRACT(EPOCH FROM CURRENT_TIMESTAMP)::INTEGER + 2592000),
  ALTER COLUMN "refreshExpiresAt" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "AccessToken_refreshExpiresAt_idx"
  ON "AccessToken" ("refreshExpiresAt");

COMMIT;
