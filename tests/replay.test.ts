import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import {
	calculate3BV,
	createGrid,
	DIRECTIONS,
	revealCell,
	revealCellsAround
} from '../src/lib/minesweeper';
import {
	MAX_REPLAY_ACTIONS,
	MAX_REPLAY_BOARDS,
	MAX_REPLAY_BYTES,
	ReplayRecorder,
	type GameReplay,
	type ReplayBoard,
	type SubmittedGameResult
} from '../src/lib/game/recording';
import { validateReplay } from '../src/lib/server/validateReplay';
import { submitGame } from '../src/lib/server/submitGame';
import { mergeGameResults } from '../src/lib/game/history';

type Submission = { result: SubmittedGameResult; replay: GameReplay };
const GAME_ID = '11900000-0000-4000-8000-000000000001';

function board(outcome: 'clear' | 'loss' | 'partial' | 'chord' = 'clear', offset = 0) {
	const mines = [20, 21, 22, 29, 38, 39, 40, 41, 72, 80];
	const grid = createGrid(9, 9);
	for (const cell of grid.flat()) {
		cell.isMine = mines.includes(cell.row * 9 + cell.col);
		cell.neighborCount = DIRECTIONS.filter(
			([dr, dc]) =>
				mines.includes((cell.row + dr) * 9 + cell.col + dc) &&
				cell.row + dr >= 0 &&
				cell.row + dr < 9 &&
				cell.col + dc >= 0 &&
				cell.col + dc < 9
		).length;
	}
	const replay: ReplayBoard = { mines, actions: [{ type: 'reveal', r: 0, c: 0, t: offset }] };
	revealCell(grid, 0, 0);
	if (outcome === 'chord') {
		for (const index of mines) {
			grid[Math.floor(index / 9)][index % 9].isFlagged = true;
			replay.actions.push({
				type: 'flag',
				r: Math.floor(index / 9),
				c: index % 9,
				t: offset + 100
			});
		}
		const target = grid.flat().find(
			(cell) =>
				cell.isOpen &&
				cell.neighborCount > 0 &&
				DIRECTIONS.some(([dr, dc]) => {
					const neighbor = grid[cell.row + dr]?.[cell.col + dc];
					return neighbor && !neighbor.isMine && !neighbor.isOpen;
				})
		);
		assert.ok(target);
		replay.actions.push({ type: 'reveal', r: target.row, c: target.col, t: offset + 200 });
		revealCellsAround(grid, target.row, target.col);
	}
	if (outcome === 'clear' || outcome === 'chord') {
		for (const cell of grid.flat()) {
			if (cell.isMine || cell.isOpen) continue;
			replay.actions.push({ type: 'reveal', r: cell.row, c: cell.col, t: offset + 500 });
			revealCell(grid, cell.row, cell.col);
		}
	}
	if (outcome === 'loss') {
		replay.actions.push({ type: 'reveal', r: 8, c: 0, t: offset + 500 });
		revealCell(grid, 8, 0);
	}
	return { replay, threeBV: calculate3BV(grid) };
}

function standard(outcome: 'clear' | 'loss' | 'chord' = 'clear'): Submission {
	const { replay, threeBV } = board(outcome);
	const win = outcome !== 'loss';
	return {
		replay: { version: 1, rows: 9, cols: 9, mines: 10, duration_ms: 500, boards: [replay] },
		result: {
			mode: 'standard',
			setting: '9x9',
			win,
			time: 0,
			grids: win ? 1 : 0,
			total_mines: win ? 10 : 0,
			accuracy: win ? 100 : 90,
			three_bv: threeBV,
			three_bv_per_sec: threeBV
		}
	};
}

function timed(pending = false): Submission {
	const cleared = board();
	return {
		replay: {
			version: 1,
			rows: 9,
			cols: 9,
			mines: 10,
			duration_ms: 15_000,
			boards: [
				cleared.replay,
				pending ? { mines: null, actions: [] } : board('partial', 1000).replay
			]
		},
		result: {
			mode: 'time',
			setting: '15',
			win: true,
			time: 15,
			grids: 1,
			total_mines: 10,
			accuracy: 100,
			three_bv: cleared.threeBV,
			three_bv_per_sec: Number((cleared.threeBV / 15).toFixed(2))
		}
	};
}

function accepted(submission: Submission) {
	assert.deepEqual(validateReplay(submission), { valid: true, result: submission.result });
}

function rejected(submission: unknown, reason?: RegExp) {
	const validation = validateReplay(submission);
	assert.equal(validation.valid, false);
	if (!validation.valid && reason) assert.match(validation.error, reason);
}

describe('replay validation', () => {
	it('accepts standard clears, losses, flags, chords, and custom settings', () => {
		accepted(standard());
		accepted(standard('loss'));
		accepted(standard('chord'));
		const custom = standard();
		custom.result.setting = 'Custom';
		accepted(custom);
	});
	it('accepts timed runs with a partial or pending final board', () => {
		accepted(timed());
		accepted(timed(true));
	});
	it('accepts a timed loss before clearing any boards', () => {
		const submission = standard('loss');
		Object.assign(submission.result, {
			mode: 'time',
			setting: '15',
			time: 1,
			three_bv: 0,
			three_bv_per_sec: 0
		});
		accepted(submission);
	});
	it('checks timed losses and counts wrong flags once', () => {
		const submission = timed();
		submission.replay.boards[1] = board('loss', 1000).replay;
		submission.replay.boards[1].actions.splice(1, 0, { type: 'flag', r: 3, c: 3, t: 1200 });
		submission.replay.duration_ms = 1500;
		Object.assign(submission.result, {
			win: false,
			time: 1,
			total_mines: 0,
			accuracy: 90,
			three_bv_per_sec: submission.result.three_bv
		});
		accepted(submission);
	});
	it('retains pending flags and clears them when the next board starts', () => {
		const pending = timed(true);
		pending.replay.boards[1].actions.push({ type: 'flag', r: 1, c: 1, t: 1000 });
		pending.result.accuracy = 95;
		accepted(pending);
		const started = timed();
		started.replay.boards[1].actions.unshift({ type: 'flag', r: 1, c: 1, t: 900 });
		accepted(started);
	});
	it('rejects every inconsistent result field', () => {
		for (const [field, value] of Object.entries({
			win: false,
			time: 123,
			grids: 3,
			total_mines: 999,
			accuracy: 1,
			three_bv: 999,
			three_bv_per_sec: 999
		})) {
			const submission = standard();
			Object.assign(submission.result, { [field]: value });
			rejected(submission, /does not match/);
		}
	});
	it('rejects malformed versions, settings, boards, and moves without throwing', () => {
		for (const input of [null, [], {}, { result: {}, replay: {} }]) rejected(input);
		for (const patch of [
			{ version: 2 },
			{ rows: 0 },
			{ cols: 51 },
			{ mines: -1 },
			{ duration_ms: -1 },
			{ boards: [] }
		]) {
			const submission = standard();
			Object.assign(submission.replay, patch);
			rejected(submission);
		}
		for (const setting of [null, {}, { toString: null, valueOf: null }, '16x16']) {
			const submission = standard();
			Object.assign(submission.result, { setting });
			rejected(submission);
		}
		for (const action of [
			null,
			{ type: 'other', r: 0, c: 0, t: 0 },
			{ type: 'reveal', r: -1, c: 0, t: 0 },
			{ type: 'flag', r: 0, c: 0, t: 0 }
		]) {
			const submission = standard();
			Object.assign(submission.replay.boards[0].actions, { 0: action });
			rejected(submission);
		}
	});
	it('rejects invalid layouts and unsafe openings', () => {
		for (const value of [-1, 81, 80]) {
			const submission = standard();
			submission.replay.boards[0].mines![0] = value;
			rejected(submission, /mine layout/);
		}
		const submission = standard();
		submission.replay.boards[0].actions[0].r = 2;
		submission.replay.boards[0].actions[0].c = 2;
		rejected(submission, /safe opening/);
	});
	it('rejects unfinished games, moves after completion, and invalid flags', () => {
		const unfinished = standard();
		unfinished.replay.boards[0] = board('partial').replay;
		rejected(unfinished, /unfinished/);
		const extra = standard();
		extra.replay.boards[0].actions.push({ type: 'flag', r: 8, c: 0, t: 500 });
		rejected(extra, /after a board ended/);
		const flag = standard();
		flag.replay.boards[0].actions.splice(1, 0, { type: 'flag', r: 0, c: 0, t: 0 });
		rejected(flag, /open cell/);
	});
	it('rejects backwards timestamps, actions past expiry, and early timed finishes', () => {
		const backwards = standard();
		backwards.replay.boards[0].actions[1].t = -1;
		rejected(backwards, /timing/);
		const expired = timed();
		expired.replay.duration_ms = 16_000;
		expired.replay.boards[1].actions[0].t = 15_001;
		rejected(expired, /timing/);
		const early = timed();
		early.replay.duration_ms = 14_999;
		rejected(early, /before its limit/);
		const afterLoss = standard('loss');
		afterLoss.replay.duration_ms = 2000;
		rejected(afterLoss, /after the final move/);
	});
	it('bounds action and board counts', () => {
		const actions = standard();
		actions.replay.boards[0].actions = Array(MAX_REPLAY_ACTIONS + 1).fill({
			type: 'reveal',
			r: 0,
			c: 0,
			t: 0
		});
		rejected(actions, /Too many/);
		const boards = timed();
		boards.replay.boards = Array(MAX_REPLAY_BOARDS + 1).fill(board().replay);
		rejected(boards, /board count/);
	});
	it('records compact independent snapshots', () => {
		const recorder = new ReplayRecorder(9, 9, 10);
		recorder.nextBoard();
		recorder.startBoard(createGrid(9, 9));
		recorder.record('reveal', 0, 0);
		const snapshot = recorder.finish();
		recorder.record('flag', 8, 0);
		recorder.nextBoard();
		assert.equal(snapshot.boards.length, 1);
		assert.equal(snapshot.boards[0].actions.length, 1);
		assert.equal(snapshot.version, 1);
	});
	it('keeps one event timestamp when a timed move crosses the wall-clock cutoff', () => {
		let now = 0;
		const original = Object.getOwnPropertyDescriptor(performance, 'now');
		Object.defineProperty(performance, 'now', { configurable: true, value: () => now });
		try {
			const recorder = new ReplayRecorder(9, 9, 10);
			const grid = createGrid(9, 9);
			for (const index of board().replay.mines!)
				grid[Math.floor(index / 9)][index % 9].isMine = true;
			recorder.nextBoard();
			recorder.startBoard(grid);
			recorder.record('reveal', 0, 0, 0);
			now = 14_999;
			const timestamp = recorder.elapsed();
			now = 15_001;
			recorder.record('flag', 3, 3, timestamp);
			const submission = timed();
			submission.replay = recorder.finish();
			Object.assign(submission.result, {
				grids: 0,
				total_mines: 0,
				accuracy: 90,
				three_bv: 0,
				three_bv_per_sec: 0
			});
			accepted(submission);
		} finally {
			if (original) Object.defineProperty(performance, 'now', original);
			else Reflect.deleteProperty(performance, 'now');
		}
	});
	it('stops recording at the caps and marks overflow without corrupting the last board', () => {
		const recorder = new ReplayRecorder(9, 9, 10);
		recorder.nextBoard();
		for (let i = 0; i < MAX_REPLAY_ACTIONS; i++) recorder.record('reveal', 0, 0, 0);
		assert.equal(recorder.finish().truncated, false);
		recorder.record('flag', 1, 1, 0);
		assert.equal(recorder.finish().boards[0].actions.length, MAX_REPLAY_ACTIONS);
		assert.equal(recorder.finish().truncated, true);
		const boards = new ReplayRecorder(9, 9, 10);
		for (let i = 0; i < MAX_REPLAY_BOARDS; i++) boards.nextBoard();
		const before = boards.finish();
		boards.nextBoard();
		boards.startBoard(createGrid(9, 9));
		boards.record('reveal', 0, 0, 0);
		assert.deepEqual(boards.finish().boards, before.boards);
		assert.equal(boards.finish().truncated, true);
		const submission = standard();
		submission.replay.truncated = true;
		rejected(submission, /recording limits/);
	});
});

describe('local and remote history', () => {
	it('keeps unsent games visible alongside existing remote results without counting uploads twice', () => {
		const local = {
			...standard().result,
			id: GAME_ID,
			user_id: 'user',
			replay_version: 1,
			created_at: '2026-10-31T10:00:00Z'
		};
		const remote = { ...local, id: 'remote', created_at: '2026-10-30T10:00:00Z' };
		assert.deepEqual(mergeGameResults([remote], [local], 'user'), [local, remote]);
		const uploaded = { ...local, created_at: '2026-10-31T10:00:01Z' };
		assert.deepEqual(mergeGameResults([remote, uploaded], [local], 'user'), [uploaded, remote]);
	});
	it('does not double-count legacy games with different local and server UUIDs', () => {
		const legacy = {
			...standard().result,
			id: 'old-local',
			user_id: 'user',
			created_at: '2026-10-30T10:00:00Z'
		};
		const remote = { ...legacy, id: 'old-server' };
		const unsent = {
			...legacy,
			id: GAME_ID,
			replay_version: 1,
			created_at: '2026-10-31T10:00:00Z'
		};
		assert.deepEqual(mergeGameResults([remote], [legacy, unsent], 'user'), [unsent, remote]);
		assert.deepEqual(mergeGameResults([], [legacy], 'user'), [legacy]);
	});
	it('preserves unmatched legacy games when remote history exists', () => {
		const legacy = {
			...standard().result,
			id: 'failed-old-upload',
			user_id: 'user',
			created_at: '2026-10-30T10:00:00Z'
		};
		const remote = {
			...legacy,
			id: GAME_ID,
			replay_id: GAME_ID,
			created_at: '2026-10-30T10:00:01Z'
		};
		assert.deepEqual(mergeGameResults([remote], [legacy], 'user'), [remote, legacy]);
		const differentStats = { ...remote, replay_id: null, accuracy: 90 };
		assert.deepEqual(mergeGameResults([differentStats], [legacy], 'user'), [
			differentStats,
			legacy
		]);
		const later = { ...remote, replay_id: null, created_at: '2026-10-31T10:00:00Z' };
		assert.deepEqual(mergeGameResults([later], [legacy], 'user'), [later, legacy]);
	});
	it('keeps ambiguous legacy copies rather than consuming the same remote game twice', () => {
		const first = {
			...standard().result,
			id: 'old-local-1',
			user_id: 'user',
			created_at: '2026-10-30T10:00:00Z'
		};
		const second = { ...first, id: 'old-local-2', created_at: '2026-10-30T10:00:01Z' };
		const remote = { ...first, id: 'old-remote', created_at: '2026-10-30T10:00:02Z' };
		assert.deepEqual(mergeGameResults([remote], [first, second], 'user'), [remote, second, first]);
		const otherRemote = { ...remote, id: 'another-remote', created_at: '2026-10-30T10:00:03Z' };
		assert.deepEqual(mergeGameResults([remote, otherRemote], [first], 'user'), [
			otherRemote,
			remote,
			first
		]);
	});
	it('scopes local fallback history to the known account after a remote query failure', () => {
		const own = {
			...standard().result,
			id: GAME_ID,
			user_id: 'user',
			created_at: '2026-10-31T10:00:00Z'
		};
		const other = { ...own, id: 'other-game', user_id: 'other-user' };
		const guest = { ...own, id: 'guest-game', user_id: null };
		assert.deepEqual(mergeGameResults([], [own, other, guest], 'user'), [own]);
	});
	it('does not mix another account or guest history into an account dashboard', () => {
		const local = {
			...standard().result,
			id: GAME_ID,
			user_id: 'other',
			created_at: '2026-10-31T10:00:00Z'
		};
		assert.deepEqual(mergeGameResults([], [local, { ...local, user_id: null }], 'user'), []);
	});
});

function database(
	options: {
		failReplay?: boolean;
		failResult?: boolean;
		failResultOnce?: boolean;
		invalidToken?: boolean;
		duplicateReplay?: boolean;
	} = {}
) {
	const writes: { table: string; row: Record<string, unknown> }[] = [];
	const replays = new Map<string, Record<string, unknown>>();
	const results = new Map<string, Record<string, unknown>>();
	let resultFailurePending = options.failResultOnce ?? false;
	const client = createClient('https://example.supabase.co', 'test-service-key', {
		auth: { persistSession: false, autoRefreshToken: false },
		global: {
			fetch: async (input, init) => {
				const url = new URL(String(input));
				if (url.pathname.includes('/auth/v1/user')) {
					const token = new Headers(init?.headers).get('authorization');
					return Response.json(
						options.invalidToken
							? { message: 'Invalid token' }
							: { id: token === 'Bearer other-token' ? 'other-user' : 'verified-user' },
						{ status: options.invalidToken ? 401 : 200 }
					);
				}
				const table = url.pathname.includes('/game_replays') ? 'game_replays' : 'game_results';
				const rows = table === 'game_replays' ? replays : results;
				if (init?.method === 'GET') {
					const matching = [...rows.values()].filter((row) =>
						[...url.searchParams].every(
							([key, value]) => !value.startsWith('eq.') || String(row[key]) === value.slice(3)
						)
					);
					return Response.json(matching);
				}
				const row = JSON.parse(String(init?.body));
				writes.push({ table, row });
				if (rows.has(row.id) || (table === 'game_replays' && options.duplicateReplay)) {
					return Response.json({ message: 'Duplicate key', code: '23505' }, { status: 409 });
				}
				const failed =
					table === 'game_replays'
						? options.failReplay
						: options.failResult || resultFailurePending;
				if (table === 'game_results') resultFailurePending = false;
				if (!failed) rows.set(row.id, row);
				return Response.json(failed ? { message: 'Database error' } : { id: row.id }, {
					status: failed ? 500 : 201
				});
			}
		}
	});
	return { client, writes, replays, results };
}

function request(body: unknown, token: string | null = 'valid-token') {
	return new Request('https://zsweep.test/api/games', {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			...(token ? { authorization: `Bearer ${token}` } : {})
		},
		body: JSON.stringify({ id: GAME_ID, ...(body as object) })
	});
}

describe('submission boundary', () => {
	it('retains accepted replays before writing server-derived results', async () => {
		const { client, writes } = database();
		const submission = standard();
		Object.assign(submission.result, { user_id: 'spoofed', replay_id: 'spoofed', id: 'spoofed' });
		const response = await submitGame(request(submission, 'valid-token'), client);
		assert.equal(response.status, 201);
		assert.deepEqual(
			writes.map((write) => write.table),
			['game_replays', 'game_results']
		);
		assert.equal(writes[0].row.validation_error, null);
		assert.equal(writes[1].row.user_id, 'verified-user');
		assert.equal(writes[1].row.replay_id, GAME_ID);
		assert.equal(writes[1].row.id, GAME_ID);
	});
	it('rejects anonymous uploads without retaining replay data', async () => {
		const { client, writes } = database();
		assert.equal((await submitGame(request(standard(), null), client)).status, 401);
		assert.equal(writes.length, 0);
	});
	it('rejects repeated game IDs without writing another result', async () => {
		const { client, writes } = database({ duplicateReplay: true });
		assert.equal((await submitGame(request(standard()), client)).status, 409);
		assert.equal(writes.length, 1);
		assert.equal(writes[0].table, 'game_replays');
	});
	it('recovers a retained accepted replay after a transient result-write failure', async () => {
		const { client, replays, results } = database({ failResultOnce: true });
		const submission = standard();
		assert.equal((await submitGame(request(submission), client)).status, 500);
		assert.equal(replays.size, 1);
		assert.equal(results.size, 0);
		// jsonb may return object keys in a different order
		replays.get(GAME_ID)!.submission = {
			replay: submission.replay,
			result: submission.result,
			id: GAME_ID
		};
		assert.equal((await submitGame(request(submission), client)).status, 201);
		assert.equal(replays.size, 1);
		assert.equal(results.size, 1);
		const repeat = await submitGame(request(submission), client);
		assert.equal(repeat.status, 200);
		assert.deepEqual(await repeat.json(), { id: GAME_ID });
		assert.equal(replays.size, 1);
		assert.equal(results.size, 1);
	});
	it('handles simultaneous identical submissions without duplicating results', async () => {
		const { client, replays, results } = database();
		const responses = await Promise.all([
			submitGame(request(standard()), client),
			submitGame(request(standard()), client)
		]);
		assert.deepEqual(responses.map((response) => response.status).sort(), [200, 201]);
		assert.equal(replays.size, 1);
		assert.equal(results.size, 1);
	});
	it('does not recover another user’s replay or replace retained evidence', async () => {
		const { client, replays, results } = database({ failResult: true });
		const submission = standard();
		assert.equal((await submitGame(request(submission), client)).status, 500);
		assert.equal((await submitGame(request(submission, 'other-token'), client)).status, 409);
		const changed = standard();
		changed.replay.duration_ms = 1000;
		changed.result.time = 1;
		accepted(changed);
		assert.equal((await submitGame(request(changed), client)).status, 409);
		assert.deepEqual(replays.get(GAME_ID)!.submission, { id: GAME_ID, ...submission });
		assert.equal(results.size, 0);
	});
	it('does not recover a previously rejected replay or accept a colliding result', async () => {
		const rejectedDb = database();
		const bad = standard();
		bad.result.grids = 999;
		assert.equal((await submitGame(request(bad), rejectedDb.client)).status, 422);
		assert.equal((await submitGame(request(standard()), rejectedDb.client)).status, 409);
		assert.equal(rejectedDb.results.size, 0);
		const collision = database();
		collision.results.set(GAME_ID, {
			id: GAME_ID,
			user_id: 'other-user',
			replay_id: 'other-replay'
		});
		assert.equal((await submitGame(request(standard()), collision.client)).status, 409);
		assert.equal(collision.results.get(GAME_ID)!.user_id, 'other-user');
	});
	it('retains rejected replays and never writes their results', async () => {
		const { client, writes } = database();
		const submission = standard();
		submission.result.grids = 999;
		assert.equal((await submitGame(request(submission), client)).status, 422);
		assert.equal(writes.length, 1);
		assert.match(String(writes[0].row.validation_error), /grids/);
	});
	it('rejects invalid credentials before writes', async () => {
		const { client, writes } = database({ invalidToken: true });
		assert.equal((await submitGame(request(standard(), 'bad-token'), client)).status, 401);
		assert.equal(writes.length, 0);
	});
	it('rejects deeply nested JSON and invalid game IDs before retention', async () => {
		const { client, writes } = database();
		const nested = new Request('https://zsweep.test/api/games', {
			method: 'POST',
			headers: { 'content-type': 'application/json', authorization: 'Bearer valid-token' },
			body:
				`{"id":"${GAME_ID}","result":{},"replay":{},"pad":` +
				'['.repeat(10_000) +
				'0' +
				']'.repeat(10_000) +
				'}'
		});
		assert.equal((await submitGame(nested, client)).status, 400);
		for (const id of [undefined, null, 'not-a-uuid']) {
			assert.equal((await submitGame(request({ ...standard(), id }), client)).status, 400);
		}
		assert.equal(writes.length, 0);
	});
	it('rejects malformed JSON, empty envelopes, and oversized bodies before writes', async () => {
		const { client, writes } = database();
		for (const body of ['{', 'null', '[]', '"string"']) {
			const input = new Request('https://zsweep.test/api/games', {
				method: 'POST',
				headers: { 'content-type': 'application/json', authorization: 'Bearer valid-token' },
				body
			});
			assert.equal((await submitGame(input, client)).status, 400);
		}
		const oversized = request({ padding: 'x'.repeat(MAX_REPLAY_BYTES) });
		assert.equal((await submitGame(oversized, client)).status, 413);
		assert.equal(writes.length, 0);
	});
	it('does not accept a result when replay retention or score storage fails', async () => {
		const retention = database({ failReplay: true });
		assert.equal((await submitGame(request(standard()), retention.client)).status, 500);
		assert.equal(retention.writes.length, 1);
		const result = database({ failResult: true });
		assert.equal((await submitGame(request(standard()), result.client)).status, 500);
		assert.equal(result.writes.length, 2);
	});
});
