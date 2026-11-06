ALTER TABLE public.game_results
  ALTER COLUMN time TYPE double precision,
  ADD COLUMN IF NOT EXISTS three_bv integer,
  ADD COLUMN IF NOT EXISTS three_bv_per_sec numeric;
