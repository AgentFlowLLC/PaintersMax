-- Add unique constraint on user_id column in painter_profiles
-- Required for ON CONFLICT (user_id) DO UPDATE to work correctly
-- Prevents duplicate painter_profiles rows for the same user
-- Manually applied to production database on June 27 2026
ALTER TABLE painter_profiles
ADD CONSTRAINT painter_profiles_user_id_unique UNIQUE (user_id);
