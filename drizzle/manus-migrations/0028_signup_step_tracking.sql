-- Migration: Add signup step tracking columns to painter_profiles
-- Used by Chunk 1 signup flow to track progress through Steps 1-4.
-- Full abandoned-signup recovery (Chunk 5) will build on these columns.

ALTER TABLE "painter_profiles"
  ADD COLUMN IF NOT EXISTS "signup_step" integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "signup_updated_at" timestamp DEFAULT now();
