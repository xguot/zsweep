import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Sessions, SessionError } from './sessions';
import { newGame, type Action } from '../../game/anticheat/engine';

const first: Action = { type: 'reveal', r: 4, c: 4 };
const isStatus = (status: number) => (err: unknown) =>
	err instanceof SessionError && err.status === status;

describe('test sessions', () => {
	it('exposes the seed only for the replay variant and enforces ownership', () => {
		const store = new Sessions();
		const a = store.start('alice', 'replay', '9x9', first, 1000);
		const b = store.start('alice', 'server', '9x9', first, 1000);
		assert.equal(typeof a.seed, 'number');
		assert.equal(Object.hasOwn(b, 'seed'), false);
		assert.equal(
			b.game.grid.flat().some((cell) => cell.isMine),
			false
		);
		assert.throws(() => store.move('bob', b.id, 0, first, 2000), isStatus(404));
		assert.throws(() => store.finish('bob', a.id, [], 2000), isStatus(404));
	});

	it('binds variant, board, first reveal and server elapsed time', () => {
		const store = new Sessions();
		const a = store.start('alice', 'replay', '9x9', first, 1000);
		const game = newGame('9x9', a.seed!, first);
		const mine = game.grid.flat().find((cell) => cell.isMine)!;
		const moves: Action[] = [{ type: 'reveal', r: mine.row, c: mine.col }];
		const result = store.finish('alice', a.id, moves, 2300);
		assert.equal(result.result?.elapsedMs, 1300);
		assert.equal(result.result?.win, false);
		assert.deepEqual(store.finish('alice', a.id, moves, 9999), result);
		assert.throws(() => store.finish('alice', a.id, [], 9999), isStatus(409));
		assert.throws(() => store.move('alice', a.id, 0, first, 2000), isStatus(409));
	});

	it('applies each server move once, accepts exact retries and rejects conflicting revisions', () => {
		const store = new Sessions();
		const b = store.start('alice', 'server', '9x9', first, 1000);
		const cell = b.game.grid.flat().find((cell) => !cell.isOpen)!;
		const action: Action = { type: 'flag', r: cell.row, c: cell.col };
		const next = store.move('alice', b.id, 0, action, 2000);
		assert.equal(next.revision, 1);
		assert.equal(next.game.grid[cell.row][cell.col].isFlagged, true);
		assert.deepEqual(store.move('alice', b.id, 0, action, 3000), next);
		assert.throws(() => store.move('alice', b.id, 0, first, 3000), isStatus(409));
		assert.throws(() => store.move('alice', b.id, 5, action, 3000), isStatus(409));
		assert.throws(() => store.finish('alice', b.id, [], 3000), isStatus(409));
	});

	it('rejects expired sessions, malformed presets and excessive starts', () => {
		const store = new Sessions();
		const a = store.start('alice', 'replay', '9x9', first, 1000);
		assert.throws(() => store.finish('alice', a.id, [], 1_801_000), isStatus(410));
		for (const preset of ['Custom', '__proto__', 'constructor'])
			assert.throws(() => store.start('bob', 'server', preset, first), isStatus(400));
		assert.throws(() => store.start('bob', 'bogus', '9x9', first), isStatus(400));
		for (let i = 0; i < 30; i++) store.start('bob', 'server', '9x9', first, 2000);
		assert.throws(() => store.start('bob', 'server', '9x9', first, 2000), isStatus(429));
	});
});

describe('session adversarial and lifecycle tests', () => {
	it('keeps hidden information private through 75 complete server games', () => {
		for (const preset of ['9x9', '16x16', '30x16'] as const) {
			for (let i = 0; i < 25; i++) {
				const store = new Sessions();
				let view = store.start('alice', 'server', preset, first, 1000);
				for (const cell of view.game.grid.flat()) {
					if (view.result) break;
					for (const visible of view.game.grid.flat()) {
						assert.equal(visible.isMine, false);
						if (!visible.isOpen) assert.equal(visible.neighborCount, 0);
					}
					if (view.game.grid[cell.row][cell.col].isOpen) continue;
					view = store.move(
						'alice',
						view.id,
						view.revision,
						{ type: 'reveal', r: cell.row, c: cell.col },
						2000
					);
				}
				assert.ok(view.result);
				assert.equal(view.result.elapsedMs, 1000);
				const before = view;
				assert.throws(() => store.move('alice', view.id, view.revision, first, 3000));
				assert.equal(before.result?.elapsedMs, 1000);
			}
		}
	});

	it('leaves sessions usable after bad submissions and rejected moves', () => {
		const store = new Sessions();
		const a = store.start('alice', 'replay', '9x9', first, 1000);
		assert.throws(() => store.finish('alice', a.id, [], 1100));
		assert.throws(() => store.finish('alice', a.id, [{ type: 'reveal', r: 999, c: 1 }], 1100));
		assert.throws(() => store.finish('alice', a.id, [null], 1100));
		const game = newGame('9x9', a.seed!, first);
		const mine = game.grid.flat().find((cell) => cell.isMine)!;
		assert.equal(
			store.finish('alice', a.id, [{ type: 'reveal', r: mine.row, c: mine.col }], 1200).result
				?.elapsedMs,
			200
		);
		const b = store.start('alice', 'server', '9x9', first, 1000);
		for (const revision of [-1, 1.5, '0', null, NaN])
			assert.throws(() => store.move('alice', b.id, revision, first, 1100), isStatus(400));
		assert.throws(() => store.move('alice', b.id, 0, { type: 'reveal', r: -1, c: 0 }, 1100));
		assert.equal(store.move('alice', b.id, 0, first, 1200).revision, 1);
	});

	it('rejects invented terminal actions and forged result payloads', () => {
		const store = new Sessions();
		const a = store.start('alice', 'replay', '16x16', first, 1000);
		assert.throws(() => store.finish('alice', a.id, [{ type: 'won', r: 0, c: 0 }], 1200));
		assert.throws(() => store.finish('alice', a.id, { win: true, time: 0, moves: [] }, 1200));
	});

	it('expires at the boundary, allows starts after the rate window, and caps total sessions', () => {
		const store = new Sessions();
		const a = store.start('alice', 'server', '9x9', first, 1000);
		store.move('alice', a.id, 0, first, 1_800_999);
		assert.throws(() => store.move('alice', a.id, 1, first, 1_801_000), isStatus(410));
		for (let i = 0; i < 30; i++) store.start('bob', 'server', '9x9', first, 2000);
		store.start('bob', 'server', '9x9', first, 62_000);
		const bounded = new Sessions();
		for (let i = 0; i < 1000; i++) bounded.start(`owner-${i}`, 'server', '9x9', first, 1000);
		assert.throws(() => bounded.start('extra', 'server', '9x9', first, 1000), isStatus(429));
		assert.ok(bounded.start('extra', 'server', '9x9', first, 1_801_000));
	});
});
