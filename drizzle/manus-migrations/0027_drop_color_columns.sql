-- Drop orphaned color columns from painter_profiles
-- These columns were never written to by any client code.
-- Colors are now determined by the painter's chosen website template.
ALTER TABLE painter_profiles DROP COLUMN IF EXISTS primary_color;
ALTER TABLE painter_profiles DROP COLUMN IF EXISTS secondary_color;
