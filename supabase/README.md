# Database security

`public.profiles` is private. Authenticated users can select, insert, and update
only the row whose `id` matches `auth.uid()`. Anonymous requests have no table
privileges. Profile deletion is not exposed to either client role.

The public Supabase anon key is intended for browser use. Access control must be
enforced in Postgres using grants and [row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security).

## Apply the profiles fix to production

Pushing this repository or deploying the web app does **not** apply database
migrations. For the existing production database, open the project's
[SQL editor](https://supabase.com/dashboard/project/mtelmxyozxapwuchenjo/sql/new)
and run the entire contents of
[`20261101000000_secure_profiles.sql`](migrations/20261101000000_secure_profiles.sql).
It runs in a transaction and can safely be applied again. If it reports a lock
timeout, rerun it; a failed transaction does not apply the fix.

Alternatively, with an authorized Postgres connection:

```sh
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/20261101000000_secure_profiles.sql
```

Apply only this new migration to an existing database. The initial schema creates
tables and is for new databases. Before adopting `supabase db push`, reconcile
the existing database with the CLI migration history; review its dry run first.

Verify the fix using the public anon key, without a signed-in session:

```sh
curl --head --get "$PUBLIC_SUPABASE_URL/rest/v1/profiles" \
  --data-urlencode 'select=id' --data-urlencode 'limit=0' \
  --header "apikey: $PUBLIC_SUPABASE_ANON_KEY" --header 'Prefer: count=exact'
```

Anonymous requests must receive a permission error, rather than a successful
response exposing a profile count. Also sign in and confirm that profile creation,
game saving, and viewing your own profile still work. A second account must not
be able to read or modify the first account's profile.

## Regression checks

After applying migrations to a disposable local Supabase database, run:

```sh
psql "$LOCAL_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/profiles_rls.sql
```

The checks cover anonymous read/write denial, RLS protection even if anonymous
SELECT is granted, owner-only reads and updates, existing and new profile upserts,
blocked cross-user writes and ownership changes, and missing user identity. All
fixtures and temporary grants are rolled back.
