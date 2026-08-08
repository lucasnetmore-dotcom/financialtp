DO $$ BEGIN
  CREATE TYPE public.app_plan AS ENUM ('free','pro','business');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS plan public.app_plan NOT NULL DEFAULT 'free';