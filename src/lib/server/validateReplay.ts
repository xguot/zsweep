import {
	calculate3BV,
	countFlagsAround,
	createGrid,
	DIRECTIONS,
	revealCell,
	revealCellsAround
} from '../minesweeper';
import { MAX_REPLAY_ACTIONS, MAX_REPLAY_BOARDS, type SubmittedGameResult } from '../game/recording';

type Validation = { valid: true; result: SubmittedGameResult } | { valid: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function integer(value: unknown, min: number, max: number): value is number {
	return typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max;
}

export function validateReplay(submission: unknown): Validation {
	const reject = (error: string): Validation => ({ valid: false, error });
	if (!isRecord(submission) || !isRecord(submission.result) || !isRecord(submission.replay)) {
		return reject('A result and replay are required.');
	}
	const { result, replay } = submission;
	if (replay.truncated !== undefined && replay.truncated !== false) {
		return reject('Replay exceeded recording limits.');
	}
	const { rows, cols, mines, boards, duration_ms: duration } = replay;
	if (
		replay.version !== 1 ||
		!integer(rows, 5, 50) ||
		!integer(cols, 5, 50) ||
		!integer(mines, 1, Math.min(Math.floor(rows * cols * 0.85), rows * cols - 9)) ||
		!integer(duration, 0, 86_400_000) ||
		!Array.isArray(boards) ||
		boards.length < 1 ||
		boards.length > MAX_REPLAY_BOARDS
	) {
		return reject('Invalid replay version, dimensions, duration, or board count.');
	}
	if (result.mode !== 'standard' && result.mode !== 'time') return reject('Invalid game mode.');
	if (typeof result.setting !== 'string') return reject('Invalid game setting.');
	if (typeof result.win !== 'boolean') return reject('Invalid outcome.');
	const timed = result.mode === 'time';
	const timeLimit = Number(result.setting);
	const presets: Record<string, number[]> = {
		'9x9': [9, 9, 10],
		'16x16': [16, 16, 40],
		'30x16': [16, 30, 99]
	};
	if (timed) {
		if (
			!integer(timeLimit, 10, 999) ||
			result.setting !== String(timeLimit) ||
			rows !== 9 ||
			cols !== 9 ||
			mines !== 10
		)
			return reject('Invalid timed settings.');
	} else {
		if (boards.length !== 1) return reject('Standard games require one board.');
		const preset = presets[result.setting];
		if (
			result.setting !== 'Custom' &&
			(!preset || preset[0] !== rows || preset[1] !== cols || preset[2] !== mines)
		) {
			return reject('Board does not match its setting.');
		}
	}

	let actionCount = 0;
	let previousTime = 0;
	let solved = 0;
	let errors = 0;
	let threeBV = 0;
	let lost = false;
	for (const [boardIndex, board] of boards.entries()) {
		const lastBoard = boardIndex === boards.length - 1;
		if (!isRecord(board) || !Array.isArray(board.actions)) return reject('Invalid board.');
		actionCount += board.actions.length;
		if (actionCount > MAX_REPLAY_ACTIONS) return reject('Too many replay actions.');
		const pending = board.mines === null && timed && lastBoard && boardIndex > 0;
		if (
			!pending &&
			(!Array.isArray(board.mines) ||
				board.mines.length !== mines ||
				!board.mines.every((index) => integer(index, 0, rows * cols - 1)) ||
				new Set(board.mines).size !== mines ||
				board.actions.length === 0)
		)
			return reject('Invalid mine layout or missing actions.');
		const grid = createGrid(rows, cols);
		for (const index of (board.mines ?? []) as number[])
			grid[Math.floor(index / cols)][index % cols].isMine = true;
		for (const cell of grid.flat()) {
			cell.neighborCount = DIRECTIONS.filter(
				([dr, dc]) => grid[cell.row + dr]?.[cell.col + dc]?.isMine
			).length;
		}
		let cleared = false;
		let firstReveal = true;
		for (const action of board.actions) {
			if (
				!isRecord(action) ||
				(action.type !== 'reveal' && action.type !== 'flag') ||
				!integer(action.r, 0, rows - 1) ||
				!integer(action.c, 0, cols - 1) ||
				!integer(action.t, previousTime, duration) ||
				(timed && action.t > timeLimit * 1000)
			)
				return reject('Invalid move or non-monotonic timing.');
			if (cleared || lost) return reject('Moves after a board ended.');
			previousTime = action.t;
			const cell = grid[action.r][action.c];
			if (action.type === 'flag') {
				if (firstReveal && boardIndex === 0) return reject('Replay must start with a reveal.');
				if (cell.isOpen) return reject('Cannot flag an open cell.');
				cell.isFlagged = !cell.isFlagged;
				continue;
			}
			if (cell.isFlagged) return reject('Cannot reveal a flagged cell.');
			if (firstReveal) {
				if (pending || cell.isMine || cell.neighborCount !== 0)
					return reject('First reveal must have a safe opening.');
				for (const row of grid) for (const cell of row) cell.isFlagged = false;
				firstReveal = false;
			}
			const chord =
				cell.isOpen && countFlagsAround(grid, action.r, action.c) === cell.neighborCount;
			lost = (
				chord ? revealCellsAround(grid, action.r, action.c) : revealCell(grid, action.r, action.c)
			).gameOver;
			cleared = !lost && grid.flat().every((cell) => cell.isMine || cell.isOpen);
		}
		if (!pending && firstReveal) return reject('Missing first reveal.');
		const wrongFlags = grid.flat().filter((cell) => cell.isFlagged && !cell.isMine).length;
		errors += wrongFlags + (lost ? 1 : 0);
		if (cleared) solved++;
		if (!timed || cleared) threeBV += calculate3BV(grid);
		if (!lastBoard && !cleared)
			return reject('Only cleared boards may be followed by another board.');
		if (timed && lastBoard && cleared)
			return reject('Timed runs must include their final pending board.');
	}
	const win = timed ? !lost : solved === 1;
	if (!timed && !win && !lost) return reject('Standard game is unfinished.');
	if (timed && win && duration < timeLimit * 1000)
		return reject('Timed run ended before its limit.');
	if ((!timed || lost) && duration - previousTime > 1000)
		return reject('Replay continues after the final move.');
	const time = timed
		? win
			? timeLimit
			: Math.max(1, Math.floor(duration / 1000))
		: Math.floor(duration / 1000);
	const expected: SubmittedGameResult = {
		mode: result.mode,
		setting: result.setting,
		win,
		time,
		grids: solved,
		total_mines: win ? solved * mines : 0,
		accuracy: Math.max(
			0,
			Math.round(((boards.length * mines - errors) / (boards.length * mines)) * 100)
		),
		three_bv: threeBV,
		three_bv_per_sec: Number((threeBV / Math.max(1, time)).toFixed(2))
	};
	for (const key of Object.keys(expected) as (keyof SubmittedGameResult)[]) {
		if (result[key] !== expected[key]) return reject(`Result does not match replay: ${key}.`);
	}
	return { valid: true, result: expected };
}
