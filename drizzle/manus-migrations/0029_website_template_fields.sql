-- Migration: Add website choice and template selection fields to painter_profiles
-- Used by Chunk 2 signup flow (Website Choice Fork + Template Picker).

ALTER TABLE "painter_profiles"
  ADD COLUMN IF NOT EXISTS "has_website" boolean,
  ADD COLUMN IF NOT EXISTS "template_style" text,
  ADD COLUMN IF NOT EXISTS "template_tier" text;
