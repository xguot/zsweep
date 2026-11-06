CREATE TABLE public.game_replays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  submission jsonb NOT NULL,
  validation_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.game_replays ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.game_replays FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.game_replays TO service_role;

ALTER TABLE public.game_results
  ADD COLUMN replay_id uuid UNIQUE REFERENCES public.game_replays(id),
  ADD COLUMN IF NOT EXISTS three_bv integer,
  ADD COLUMN IF NOT EXISTS three_bv_per_sec numeric;

ALTER TABLE public.game_results ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.game_results FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.game_results TO anon, authenticated;
GRANT ALL ON public.game_results TO service_role;
CREATE POLICY "Public game results are readable" ON public.game_results
  FOR SELECT TO anon, authenticated USING (true);
