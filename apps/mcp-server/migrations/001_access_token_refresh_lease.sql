-- Apply before deploying code that enables lease-based Cal.com token refreshes.
-- This migration is additive so old MCP server instances continue to work while
-- the new version is deployed and old Vercel invocations drain.
ALTER TABLE "AccessToken"
  ADD COLUMN IF NOT EXISTS "refreshLeaseId" TEXT,
  ADD COLUMN IF NOT EXISTS "refreshLeaseUntil" INTEGER,
  ADD COLUMN IF NOT EXISTS "calTokenVersion" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "calTokenInvalidAt" INTEGER;
