import type { Cell } from '../minesweeper';

export const MAX_REPLAY_ACTIONS = 10_000;
export const MAX_REPLAY_BOARDS = 256;
export const MAX_REPLAY_BYTES = 1_048_576;

export interface ReplayAction {
	type: 'reveal' | 'flag';
	r: number;
	c: number;
	t: number;
}

export interface ReplayBoard {
	mines: number[] | null;
	actions: ReplayAction[];
}

export interface GameReplay {
	version: 1;
	rows: number;
	cols: number;
	mines: number;
	duration_ms: number;
	boards: ReplayBoard[];
	truncated?: boolean;
}

export interface SubmittedGameResult {
	mode: 'standard' | 'time';
	setting: string;
	win: boolean;
	time: number;
	grids: number;
	total_mines: number;
	accuracy: number;
	three_bv: number;
	three_bv_per_sec: number;
}

export class ReplayRecorder {
	private boards: ReplayBoard[] = [];
	private startedAt: number | null = null;
	private actionCount = 0;
	private truncated = false;

	constructor(
		private rows: number,
		private cols: number,
		private mines: number
	) {}

	nextBoard() {
		if (this.truncated) return;
		if (this.boards.length >= MAX_REPLAY_BOARDS) {
			this.truncated = true;
			return;
		}
		this.boards.push({ mines: null, actions: [] });
	}

	startBoard(grid: Cell[][]) {
		if (this.truncated) return;
		this.startedAt ??= performance.now();
		this.boards[this.boards.length - 1].mines = grid
			.flat()
			.filter((cell) => cell.isMine)
			.map((cell) => cell.row * this.cols + cell.col);
	}

	elapsed() {
		return this.startedAt === null ? 0 : Math.floor(performance.now() - this.startedAt);
	}

	record(type: ReplayAction['type'], r: number, c: number, t = this.elapsed()) {
		if (this.truncated) return;
		if (this.actionCount >= MAX_REPLAY_ACTIONS) {
			this.truncated = true;
			return;
		}
		this.boards[this.boards.length - 1].actions.push({ type, r, c, t });
		this.actionCount++;
	}

	finish(): GameReplay {
		return structuredClone({
			version: 1,
			rows: this.rows,
			cols: this.cols,
			mines: this.mines,
			duration_ms: this.elapsed(),
			boards: this.boards,
			truncated: this.truncated
		});
	}
}
