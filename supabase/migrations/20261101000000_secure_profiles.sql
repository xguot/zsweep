-- Profiles are private account data. Apply this migration to the live database;
-- deploying the web client alone does not change Supabase permissions.
BEGIN;

SET LOCAL lock_timeout = '5s';

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Policies are permissive by default and combine with OR. Replace any existing
-- policies so an older public-read policy cannot bypass the owner checks.
DO $$
DECLARE
  existing_policy record;
BEGIN
  FOR existing_policy IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.profiles', existing_policy.policyname);
  END LOOP;
END;
$$;

REVOKE ALL PRIVILEGES ON TABLE public.profiles FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.profiles TO authenticated;

-- Profile ownership is stored in id (the auth.users foreign key), not user_id.
CREATE POLICY profiles_select_own ON public.profiles
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = id);

-- ensureUserProfile() uses INSERT ... ON CONFLICT DO UPDATE ... RETURNING.
-- Keep all three operations available, scoped to the signed-in user's id.
CREATE POLICY profiles_insert_own ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = id);

CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);

COMMIT;
