-- Migration: Add chatbot_name and chatbot_avatar to painter_profiles
-- Improvement 3: Brand Kit chatbot fields

ALTER TABLE "painter_profiles"
  ADD COLUMN IF NOT EXISTS "chatbot_name" text DEFAULT 'Iris',
  ADD COLUMN IF NOT EXISTS "chatbot_avatar" text;
