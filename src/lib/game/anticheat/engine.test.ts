import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
	PRESETS,
	applyMove,
	newGame,
	parseAction,
	publicGame,
	replay,
	type Action,
	type Preset
} from './engine';

const first: Action = { type: 'reveal', r: 4, c: 4 };

describe('shared anticheat rules', () => {
	for (const preset of Object.keys(PRESETS) as Preset[]) {
		it(`reproduces ${preset} boards and protects the first reveal`, () => {
			const game = newGame(preset, 42, first);
			assert.deepEqual(game, newGame(preset, 42, first));
			assert.notDeepEqual(game.grid, newGame(preset, 43, first).grid);
			assert.equal(game.grid.flat().filter((c) => c.isMine).length, PRESETS[preset].mines);
			for (let r = 3; r <= 5; r++)
				for (let c = 3; c <= 5; c++) assert.equal(game.grid[r][c].isMine, false);
		});
	}

	it('replays a full win and rejects actions after the terminal move', () => {
		const game = newGame('9x9', 42, first);
		const moves: Action[] = [];
		for (const cell of game.grid.flat()) {
			if (cell.isOpen || cell.isMine || game.status !== 'playing') continue;
			const move: Action = { type: 'reveal', r: cell.row, c: cell.col };
			moves.push(move);
			applyMove(game, move);
		}
		assert.equal(game.status, 'won');
		assert.deepEqual(replay('9x9', 42, first, moves), game);
		assert.throws(() => replay('9x9', 42, first, [...moves, first]));
	});

	it('never sends hidden mines or hidden neighboring counts in a live view', () => {
		const game = newGame('9x9', 42, first);
		const view = publicGame(game);
		for (const cell of view.grid.flat()) {
			assert.equal(cell.isMine, false);
			if (!cell.isOpen) assert.equal(cell.neighborCount, 0);
		}
		const original = game.grid[0][0].isOpen;
		view.grid[0][0].isOpen = !original;
		assert.equal(game.grid[0][0].isOpen, original);
		const mine = game.grid.flat().find((cell) => cell.isMine)!;
		applyMove(game, { type: 'reveal', r: mine.row, c: mine.col });
		assert.equal(game.status, 'lost');
		assert.equal(
			publicGame(game)
				.grid.flat()
				.filter((cell) => cell.isMine).length,
			10
		);
	});

	it('uses flags and chords in the same replay rules', () => {
		const game = newGame('9x9', 42, first);
		const clue = game.grid.flat().find((cell) => cell.isOpen && cell.neighborCount > 0)!;
		const moves: Action[] = [];
		for (let r = clue.row - 1; r <= clue.row + 1; r++) {
			for (let c = clue.col - 1; c <= clue.col + 1; c++) {
				if (!game.grid[r]?.[c]?.isMine) continue;
				const move: Action = { type: 'flag', r, c };
				moves.push(move);
				applyMove(game, move);
			}
		}
		applyMove(game, { type: 'reveal', r: clue.row, c: clue.col });
		assert.equal(game.status, 'playing');
		assert.equal(game.grid[clue.row][clue.col].isOpen, true);
		assert.equal(moves.length, clue.neighborCount);
	});

	it('rejects malformed, out-of-bounds and incomplete replays', () => {
		for (const value of [
			null,
			{},
			{ type: 'win', r: 0, c: 0 },
			{ type: 'flag', r: NaN, c: 0 },
			{ type: 'reveal', r: 0.5, c: 0 }
		])
			assert.throws(() => parseAction(value));
		assert.throws(() => newGame('9x9', 42, { type: 'flag', r: 0, c: 0 }));
		assert.throws(() => newGame('9x9', 42, { type: 'reveal', r: -1, c: 0 }));
		assert.throws(() => applyMove(newGame('9x9', 42, first), { type: 'reveal', r: 99, c: 0 }));
		assert.throws(() => replay('9x9', 42, first, []));
		assert.throws(() => replay('9x9', 42, first, Array(10_000).fill(first)));
	});
});

describe('board and replay stress tests', () => {
	for (const preset of Object.keys(PRESETS) as Preset[]) {
		it(`validates 120 ${preset} boards across corners, edges and center`, () => {
			const { rows, cols, mines } = PRESETS[preset];
			const starts = [
				[0, 0],
				[0, cols - 1],
				[rows - 1, 0],
				[rows - 1, cols - 1],
				[0, Math.floor(cols / 2)],
				[Math.floor(rows / 2), Math.floor(cols / 2)]
			];
			for (let seed = 0; seed < 120; seed++) {
				const [r, c] = starts[seed % starts.length];
				const first: Action = { type: 'reveal', r, c };
				const game = newGame(preset, seed, first);
				assert.equal(game.grid.flat().filter((cell) => cell.isMine).length, mines);
				for (const cell of game.grid.flat()) {
					if (Math.abs(cell.row - r) <= 1 && Math.abs(cell.col - c) <= 1)
						assert.equal(cell.isMine, false);
					if (cell.isMine) continue;
					let neighbors = 0;
					for (let dr = -1; dr <= 1; dr++)
						for (let dc = -1; dc <= 1; dc++) {
							if (game.grid[cell.row + dr]?.[cell.col + dc]?.isMine) neighbors++;
						}
					assert.equal(cell.neighborCount, neighbors);
				}
				const moves: Action[] = [];
				for (const cell of game.grid.flat()) {
					if (cell.isMine || cell.isOpen || game.status !== 'playing') continue;
					const move: Action = { type: 'reveal', r: cell.row, c: cell.col };
					moves.push(move);
					applyMove(game, move);
				}
				assert.equal(game.status, 'won');
				assert.deepEqual(replay(preset, seed, first, moves), game);
			}
		});
	}

	it('enforces the action budget without mutating the board on a rejected move', () => {
		const game = newGame('9x9', 42, first);
		const mine = game.grid.flat().find((cell) => cell.isMine)!;
		const flag: Action = { type: 'flag', r: mine.row, c: mine.col };
		for (let i = 1; i < 10_000; i++) applyMove(game, flag);
		const before = structuredClone(game);
		assert.throws(() => applyMove(game, flag));
		assert.deepEqual(game, before);
	});

	it('keeps a flagged cell closed, allows unflagging, and cannot win by flagging mines', () => {
		const game = newGame('16x16', 7, first);
		for (const cell of game.grid.flat().filter((cell) => cell.isMine))
			applyMove(game, { type: 'flag', r: cell.row, c: cell.col });
		assert.equal(game.status, 'playing');
		const mine = game.grid.flat().find((cell) => cell.isMine)!;
		applyMove(game, { type: 'reveal', r: mine.row, c: mine.col });
		assert.equal(mine.isOpen, false);
		assert.equal(game.status, 'playing');
		applyMove(game, { type: 'flag', r: mine.row, c: mine.col });
		applyMove(game, { type: 'reveal', r: mine.row, c: mine.col });
		assert.equal(game.status, 'lost');
	});

	it('loses on a chord with the right number of incorrectly placed flags', () => {
		const game = newGame('9x9', 42, first);
		const clue = game.grid.flat().find((cell) => {
			if (!cell.isOpen || cell.neighborCount < 1) return false;
			let closedSafe = 0;
			for (let dr = -1; dr <= 1; dr++)
				for (let dc = -1; dc <= 1; dc++) {
					const n = game.grid[cell.row + dr]?.[cell.col + dc];
					if (n && !n.isOpen && !n.isMine) closedSafe++;
				}
			return closedSafe >= cell.neighborCount;
		})!;
		assert.ok(clue);
		let flags = 0;
		for (let dr = -1; dr <= 1; dr++)
			for (let dc = -1; dc <= 1; dc++) {
				const n = game.grid[clue.row + dr]?.[clue.col + dc];
				if (n && !n.isMine && !n.isOpen && flags < clue.neighborCount) {
					applyMove(game, { type: 'flag', r: n.row, c: n.col });
					flags++;
				}
			}
		applyMove(game, { type: 'reveal', r: clue.row, c: clue.col });
		assert.equal(game.status, 'lost');
		assert.ok(game.grid.flat().some((cell) => cell.isWrong));
	});
});
