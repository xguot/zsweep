# #76: compare replay validation and server-owned games

Issue: https://github.com/xguot/zsweep/issues/76
Leaderboard requirements: https://github.com/xguot/zsweep/issues/21

Status: both approaches implemented as a local A/B prototype at `/anticheat`.
This does not close #76 or secure the existing score submission path.

## Try it

Run `bun install`, then `bun run dev` and open `/anticheat` on the printed URL.
No database migration, Supabase service key, or login is needed for the test.
The test route and its API return 404 outside development. The existing app still
uses its normal Supabase configuration.

Choose A or B, a standard board size, and an optional added round-trip delay.
Changing a setting starts a fresh board. Reveal a cell to start. Play a few games
in each variant at 0, 50, 100, and 200 ms added delay, with the same board size.
Boards are independently generated so a seed exposed by A cannot reveal B's board.
This compares feel under the same rules, not paired completion times on identical
boards. It is a manual crossover test, not a randomized experiment.

The page shows mean and p95 response time from input to DOM update, including
queued input but excluding startup and final replay validation. This is not a
browser paint measurement. Startup, moves and validation use real same-origin
HTTP requests. Added delay is split before sending and after receiving each
request; it approximates latency, not packet loss or bandwidth limits.

Completed games, including losses, appear in a rolling list of twelve runs for
the current page visit. Nothing is uploaded to profiles or global stats.
Keyboard support covers arrows/hjkl, enter/i to reveal, f/x to flag, space to
flag/chord, and r to restart. This prototype does not implement the main game's
full Vim operators and search. Mouse and touch use the existing grid component.

## Shared rules

Both variants use the existing mine placement, flood reveal, flag counting,
chording and 3BV functions. Mine placement now accepts an optional random source;
the existing game retains its default randomness.

The prototype fixes a deterministic PRNG for A and rules version (1). B draws
mine placement randomness directly from the server’s cryptographic random source,
rather than a small reconstructible PRNG seed. The server commits the preset and
first reveal before returning any board information. Mines
avoid that reveal and its neighbors. All safe cells must be open to win; flags
alone never establish a win. A reveal on an open clue chords only when the adjacent
flag count matches. No client-supplied win, score, time, mine map or 3BV is accepted.

A compact action is `{ type: 'reveal' | 'flag', r, c }`. First reveal is stored
separately; subsequent moves are ordered in the replay. Cursor motion is not
needed to verify a solution. Coordinates and action types are checked, play stops
at the first terminal action, and a session permits at most 10,000 actions.

## A: local play, server replay check

1. On the first reveal, POST `start` with variant, preset and coordinates.
2. The server stores the issued board parameters and start time, applies the
   first reveal, and returns the session ID and seed.
3. The browser reproduces that board and applies subsequent moves immediately.
4. At game end it POSTs `finish` with the session ID and subsequent moves.
5. The server rebuilds the issued board and replays every action. An incomplete
   replay, illegal action, or action after game end is rejected. Metrics come
   from the resulting board. An exact resubmission returns the original result;
   a changed submission is rejected.

There is one startup round trip and one validation round trip. No move waits on
network access. A modified client can read the seed and solve the board with full
knowledge. A signed token would bind issuance, but cannot hide a seed the browser
needs. Replay validation proves a legal result for the issued board, not human play.

## B: server-owned board

1. `start` creates the same kind of session but returns only the visible board.
2. Each move POST includes the session ID, expected revision and one action.
3. The server applies it and returns the next visible state and revision.
4. A win or loss finalizes the result automatically. There is no client finish claim.

Closed cells have no mine identity or neighboring clue in live responses, even
when flagged. Open cells contain only information the player has earned. The
full board and 3BV are released when the game finishes. No replay seed is sent in this variant. Hidden information also stays out of page loads and errors.

Inputs are queued, with at most 32 pending, to preserve order under latency.
Each state-changing request is retried once if it fails. Revision plus action
makes an exact retry idempotent; a conflicting revision is rejected. Switching
settings, restarting, or leaving the page invalidates outstanding responses.

This blocks reading the hidden mine map from browser state, but a bot can still
play using revealed clues. CAPTCHA or proof-of-work may reduce submission spam;
neither proves a human played a particular game.

## Timing and session boundaries

Both variants rank conceptually by elapsed time, as agreed in #76's discussion;
3BV is an additional metric, not the ranking key. The displayed local stopwatch
uses `performance.now()`. The server's result uses its own start and finish times,
never client timestamps. A starts timing before sending the seed and finishes
when its replay arrives; B finishes on the terminal move. Network overhead is
included, with no subtractable, client-controlled latency compensation. Test
results from A and B should stay separated; they have different timing overhead.
No hardcoded minimum human completion time is used as proof of cheating.

The development store is an in-memory singleton bound to an HttpOnly SameSite
cookie, with 30-minute expiry, at most 1,000 sessions and 30 starts per cookie per
minute. It is intentionally disposable and does not work across serverless
instances. Cookie reset bypasses that rate limit, so it is not a production abuse
control. Same-origin POST checks and request/replay limits provide basic test
isolation. The test is disabled in production builds.

## Production design after the A/B decision

Use SvelteKit server routes and `$lib/server` for the verifier and privileged
Supabase client. Keep service credentials in private environment variables.
Use the installed Kit 2 private environment API; current Kit 3 examples use
different imports. Validate authentication with Supabase `auth.getUser()` and
derive ownership from that result, never from request JSON. The browser client
currently stores its session in local storage, whereas the existing server hook
uses cookies: explicitly send its access token as Bearer auth and validate it
server-side, or migrate the browser to cookie-backed SSR auth first.

Persist sessions with owner, variant, preset, private seed, first reveal, rules
version, start/expiry/finish timestamps, revision, action log and terminal result.
Use a database transaction or service-only RPC to compare revisions, commit
moves, consume a session and create exactly one result. Add a unique result
session ID. Stateless signed tokens alone cannot enforce single use. Keep private
board state out of client-readable tables/views, Realtime and storage policies.
A service-only RPC needs execute privileges restricted to the service role.

Revoke direct anon/authenticated INSERT, UPDATE and DELETE on `game_results`,
enable RLS, and permit writes only through the verified server path. The checked-in
schema has no RLS policies, so inspect deployed grants, policies and existing RPCs
before writing the migration. Service-role bypass means every privileged handler
must check ownership explicitly. Do not let users mark their own rows verified.

Add verification provenance, variant, rules version, duration in milliseconds,
3BV and session ID to results. Keep historical rows explicitly unverified; never
backfill a verified label from their current time/win fields. #21's daily and
all-time top-50 lists should read only verified standard wins, take each user's
best result per board and use a defined UTC day boundary. Do not mix variants in
one competitive ranking while comparing them.

Keep guest, offline, time-mode and custom-board history local until a separate
bounded unranked ingestion path exists. If remote unverified history is retained,
exclude it from trusted public aggregates and show its provenance in profiles.
Coordinate this transition with removal of the existing direct client insert so
production play does not silently lose saved history. Any public aggregate RPC
must apply the same trust filter as the leaderboard.

Add shared rate limits by validated account and trusted deployment IP, expiry
cleanup, bounded replay verification work, request-size enforcement at ingress,
and a review/suppression mechanism for suspicious records. Do not trust arbitrary
forwarded IP headers. CAPTCHA should be a response to observed abuse rather than
a prerequisite for every game. Preserve replay/rules versions for auditability.

Roll out the chosen mode behind a feature flag, test database grants using real
anon and authenticated roles, verify duplicate submissions and concurrent moves,
and then enable leaderboard reads. Choosing B additionally requires testing from
the intended deployment region: localhost plus simulated delay cannot measure
cold starts or database round trips.

References: [Supabase getUser](https://supabase.com/docs/reference/javascript/auth-getuser),
[Supabase RLS and service roles](https://supabase.com/docs/guides/database/postgres/row-level-security),
[SvelteKit server-only modules](https://svelte.dev/docs/kit/server-only-modules).

## Verification

Run `bun test src/lib/game/anticheat src/lib/server/anticheat`, `bun run check`,
and `bun run lint`. The current Vercel adapter accepts Node 20, 22 or 24 for builds;
this machine defaults to unsupported Node 25. To check the production build here,
use `bunx --package node@24 node node_modules/vite/bin/vite.js build`.

The automated suite includes 360 deterministic board/replay checks across every
preset and six first-reveal positions, 75 server-game lifecycles, incorrect chords,
flag behavior, terminal-state rejection, malformed submissions, ownership,
idempotency, action/session caps and expiry boundaries. Browser QA completed local
wins on every preset, dropped responses after committed moves and finishes, queued
flag toggles, outage recovery, switching variants during a request, normal Tab
navigation and all three boards at 320, 390, 768 and 1280 px widths. HTTP QA also
checked malformed payloads, request limits, origin/method restrictions, cookie
renewal and response cache headers. Production smoke checks confirm both test
routes return 404.
