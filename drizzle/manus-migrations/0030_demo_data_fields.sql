-- Migration: Add is_demo and demo_expires_at fields for demo data tracking
-- Used by Chunk 3 (Demo Data Engine) to flag auto-generated sample data.
-- Chunk 5 (Data Cleanup) will use demoExpiresAt for auto-expiry after 30 days.
-- Note: these tables are Drizzle-managed and use camelCase column names.

ALTER TABLE "leads"
  ADD COLUMN IF NOT EXISTS "isDemo" boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS "demoExpiresAt" timestamp;

ALTER TABLE "invoices"
  ADD COLUMN IF NOT EXISTS "isDemo" boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS "demoExpiresAt" timestamp;

ALTER TABLE "appointments"
  ADD COLUMN IF NOT EXISTS "isDemo" boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS "demoExpiresAt" timestamp;
