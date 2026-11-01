-- Run against a migrated, disposable local database:
-- psql "$LOCAL_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/profiles_rls.sql
-- All fixtures and permission changes are rolled back.
BEGIN;

INSERT INTO auth.users (id) VALUES
  ('e69b4ff1-0000-4000-8000-000000000001'),
  ('e69b4ff1-0000-4000-8000-000000000002'),
  ('e69b4ff1-0000-4000-8000-000000000003');

INSERT INTO public.profiles (id, username) VALUES
  ('e69b4ff1-0000-4000-8000-000000000001', 'rls_test_owner'),
  ('e69b4ff1-0000-4000-8000-000000000002', 'rls_test_other');

DO $$
BEGIN
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.profiles'::regclass) THEN
    RAISE EXCEPTION 'profiles must have RLS enabled';
  END IF;
END;
$$;

SET LOCAL ROLE anon;
DO $$
BEGIN
  BEGIN
    PERFORM * FROM public.profiles;
    RAISE EXCEPTION 'anon must not have SELECT permission';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    INSERT INTO public.profiles (id) VALUES ('e69b4ff1-0000-4000-8000-000000000003');
    RAISE EXCEPTION 'anon must not have INSERT permission';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    UPDATE public.profiles SET avatar_url = 'unauthorized';
    RAISE EXCEPTION 'anon must not have UPDATE permission';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    DELETE FROM public.profiles;
    RAISE EXCEPTION 'anon must not have DELETE permission';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END;
$$;
RESET ROLE;

-- Even if table SELECT is accidentally re-granted, RLS must still hide rows.
GRANT SELECT ON public.profiles TO anon;
SET LOCAL ROLE anon;
DO $$
BEGIN
  IF EXISTS (SELECT FROM public.profiles) THEN
    RAISE EXCEPTION 'RLS must hide every profile from anon';
  END IF;
END;
$$;
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'e69b4ff1-0000-4000-8000-000000000001', true);
SELECT set_config('request.jwt.claims', '{"sub":"e69b4ff1-0000-4000-8000-000000000001","role":"authenticated"}', true);

DO $$
DECLARE
  affected integer;
  profile_id uuid;
BEGIN
  IF (SELECT count(*) FROM public.profiles) <> 1 OR
     NOT EXISTS (SELECT FROM public.profiles WHERE id = auth.uid()) THEN
    RAISE EXCEPTION 'authenticated users must see only their own profile';
  END IF;

  INSERT INTO public.profiles (id, username, avatar_url)
    VALUES (auth.uid(), 'rls_test_owner', 'updated')
    ON CONFLICT (id) DO UPDATE SET avatar_url = EXCLUDED.avatar_url
    RETURNING id INTO profile_id;
  IF profile_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'own profile upsert and RETURNING must work';
  END IF;

  UPDATE public.profiles SET avatar_url = 'unauthorized'
    WHERE id = 'e69b4ff1-0000-4000-8000-000000000002';
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN
    RAISE EXCEPTION 'another user profile must not be updated';
  END IF;

  BEGIN
    INSERT INTO public.profiles (id) VALUES ('e69b4ff1-0000-4000-8000-000000000003');
    RAISE EXCEPTION 'another user profile must not be inserted';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  BEGIN
    INSERT INTO public.profiles (id, avatar_url)
      VALUES ('e69b4ff1-0000-4000-8000-000000000002', 'unauthorized')
      ON CONFLICT (id) DO UPDATE SET avatar_url = EXCLUDED.avatar_url;
    RAISE EXCEPTION 'another user profile must not be upserted';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  BEGIN
    UPDATE public.profiles SET id = 'e69b4ff1-0000-4000-8000-000000000003'
      WHERE id = auth.uid();
    RAISE EXCEPTION 'profile ownership must not be reassigned';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  BEGIN
    DELETE FROM public.profiles WHERE id = auth.uid();
    RAISE EXCEPTION 'authenticated users must not have DELETE permission';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END;
$$;

SELECT set_config('request.jwt.claim.sub', 'e69b4ff1-0000-4000-8000-000000000002', true);
SELECT set_config('request.jwt.claims', '{"sub":"e69b4ff1-0000-4000-8000-000000000002","role":"authenticated"}', true);
DO $$
BEGIN
  IF (SELECT count(*) FROM public.profiles) <> 1 OR
     NOT EXISTS (SELECT FROM public.profiles WHERE id = auth.uid() AND username = 'rls_test_other') THEN
    RAISE EXCEPTION 'the second user must see only their own profile';
  END IF;
END;
$$;

SELECT set_config('request.jwt.claim.sub', 'e69b4ff1-0000-4000-8000-000000000003', true);
SELECT set_config('request.jwt.claims', '{"sub":"e69b4ff1-0000-4000-8000-000000000003","role":"authenticated"}', true);
DO $$
DECLARE
  profile_id uuid;
BEGIN
  INSERT INTO public.profiles (id, username) VALUES (auth.uid(), 'rls_test_new')
    ON CONFLICT (id) DO UPDATE SET username = EXCLUDED.username
    RETURNING id INTO profile_id;
  IF profile_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'new users must be able to create and read their own profile';
  END IF;
END;
$$;

-- A role without a valid user id must not gain access.
SELECT set_config('request.jwt.claim.sub', '', true);
SELECT set_config('request.jwt.claims', '{}', true);
DO $$
BEGIN
  IF EXISTS (SELECT FROM public.profiles) THEN
    RAISE EXCEPTION 'missing identity must not expose profiles';
  END IF;
END;
$$;

RESET ROLE;
ROLLBACK;
