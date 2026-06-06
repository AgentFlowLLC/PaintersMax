-- Create painter_profiles table
CREATE TABLE IF NOT EXISTS "painter_profiles" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "company_name" text NOT NULL,
  "phone" text NOT NULL,
  "business_email" text NOT NULL,
  "website" text,
  "address" text NOT NULL,
  "years_in_business" integer,
  "license_number" text,
  "insurance_carrier" text,
  "service_cities" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "service_radius" integer,
  "logo_url" text,
  "primary_color" text,
  "secondary_color" text,
  "tagline" text,
  "onboarding_completed" boolean DEFAULT false NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Add index on user_id for faster lookups
CREATE INDEX IF NOT EXISTS "painter_profiles_user_id_idx" ON "painter_profiles" ("user_id");
