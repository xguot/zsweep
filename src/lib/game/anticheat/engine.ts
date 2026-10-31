import {
	calculate3BV,
	countFlagsAround,
	createGrid,
	placeMines,
	revealCell,
	revealCellsAround,
	type Cell
} from '../../minesweeper';

export const PRESETS = {
	'9x9': { rows: 9, cols: 9, mines: 10 },
	'16x16': { rows: 16, cols: 16, mines: 40 },
	'30x16': { rows: 16, cols: 30, mines: 99 }
} as const;
export type Preset = keyof typeof PRESETS;
export type Variant = 'replay' | 'server';
export type Action = { type: 'reveal' | 'flag'; r: number; c: number };
export type Game = { grid: Cell[][]; status: 'playing' | 'won' | 'lost'; actions: number };
export const MAX_ACTIONS = 10_000;
export const RULES_VERSION = 1;

// A fixed integer PRNG makes a given seed, first reveal and rules version replayable.
export function seededRandom(seed: number) {
	let state = seed >>> 0;
	return () => {
		state = (state + 0x6d2b79f5) | 0;
		let t = Math.imul(state ^ (state >>> 15), 1 | state);
		t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

export function parseAction(value: unknown): Action {
	if (!value || typeof value !== 'object') throw new Error('Invalid move');
	const action = value as Action;
	if (
		!['reveal', 'flag'].includes(action.type) ||
		!Number.isInteger(action.r) ||
		!Number.isInteger(action.c)
	)
		throw new Error('Invalid move');
	return { type: action.type, r: action.r, c: action.c };
}

export function newGame(
	preset: Preset,
	seed: number,
	first: Action,
	random: () => number = seededRandom(seed)
): Game {
	const { rows, cols, mines } = PRESETS[preset];
	if (first.type !== 'reveal' || first.r < 0 || first.r >= rows || first.c < 0 || first.c >= cols) {
		throw new Error('Choose a valid first reveal');
	}
	const grid = createGrid(rows, cols);
	placeMines(grid, mines, first, random);
	const game: Game = { grid, status: 'playing', actions: 0 };
	applyMove(game, first);
	return game;
}

export function applyMove(game: Game, action: Action) {
	const cell = game.grid[action.r]?.[action.c];
	if (!cell || game.status !== 'playing' || game.actions >= MAX_ACTIONS) {
		throw new Error('Move is outside the board, after game end, or over the move limit');
	}
	game.actions++;
	if (action.type === 'flag') {
		if (!cell.isOpen) cell.isFlagged = !cell.isFlagged;
		return;
	}
	const chord =
		cell.isOpen && countFlagsAround(game.grid, action.r, action.c) === cell.neighborCount;
	const result = chord
		? revealCellsAround(game.grid, action.r, action.c)
		: revealCell(game.grid, action.r, action.c);
	if (result.gameOver) {
		game.status = 'lost';
		for (const row of game.grid) {
			for (const cell of row) {
				cell.isExploded = cell.isMine && cell.isOpen;
				cell.isWrong = cell.isFlagged && !cell.isMine;
			}
		}
		return;
	}
	if (game.grid.every((row) => row.every((cell) => cell.isMine || cell.isOpen))) {
		game.status = 'won';
	}
}

export function replay(preset: Preset, seed: number, first: Action, moves: Action[]) {
	if (moves.length > MAX_ACTIONS - 1) throw new Error('Replay exceeds the move limit');
	const game = newGame(preset, seed, first);
	for (const move of moves) applyMove(game, parseAction(move));
	if (game.status === 'playing') throw new Error('Replay does not finish the game');
	return game;
}

export function publicGame(game: Game): Game {
	const finished = game.status !== 'playing';
	return {
		status: game.status,
		actions: game.actions,
		grid: game.grid.map((row) =>
			row.map((cell) => ({
				row: cell.row,
				col: cell.col,
				isOpen: cell.isOpen,
				isFlagged: cell.isFlagged,
				isMine: finished ? cell.isMine : false,
				neighborCount: finished || cell.isOpen ? cell.neighborCount : 0,
				...(finished ? { isExploded: cell.isExploded, isWrong: cell.isWrong } : {})
			}))
		)
	};
}

export function gameMetrics(game: Game) {
	return {
		win: game.status === 'won',
		actions: game.actions,
		threeBV: calculate3BV(game.grid),
		safeOpen: game.grid.flat().filter((cell) => cell.isOpen && !cell.isMine).length
	};
}
