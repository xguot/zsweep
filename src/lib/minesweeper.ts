export type Cell = {
	row: number;
	col: number;
	isMine: boolean;
	isOpen: boolean;
	isFlagged: boolean;
	neighborCount: number;
	isExploded?: boolean;
	isWrong?: boolean;
};

export const DIRECTIONS = [
	[-1, -1],
	[-1, 0],
	[-1, 1],
	[0, -1],
	[0, 1],
	[1, -1],
	[1, 0],
	[1, 1]
] as const;

export type RevealResult = {
	grid: Cell[][];
	gameOver: boolean;
};

function inBounds(grid: Cell[][], r: number, c: number): boolean {
	return r >= 0 && r < grid.length && c >= 0 && c < grid[0].length;
}

function forEachNeighbor(
	grid: Cell[][],
	r: number,
	c: number,
	fn: (nr: number, nc: number) => void
): void {
	for (const [dr, dc] of DIRECTIONS) {
		const nr = r + dr;
		const nc = c + dc;
		if (inBounds(grid, nr, nc)) {
			fn(nr, nc);
		}
	}
}

function idx(r: number, c: number, cols: number): number {
	return r * cols + c;
}

/** Create an empty grid with all cells closed and no mines. */
export function createGrid(rows: number, cols: number): Cell[][] {
	return Array.from({ length: rows }, (_, r) =>
		Array.from({ length: cols }, (_, c) => ({
			row: r,
			col: c,
			isMine: false,
			isOpen: false,
			isFlagged: false,
			neighborCount: 0
		}))
	);
}

/**
 * Place mines, avoiding the first click cell and its neighbors.
 * Mutates the grid in place.
 */
export function placeMines(
	grid: Cell[][],
	mines: number,
	firstClick: { r: number; c: number }
): void {
	const rows = grid.length;
	const cols = grid[0].length;

	const safeZone = new Set<number>();
	safeZone.add(idx(firstClick.r, firstClick.c, cols));
	forEachNeighbor(grid, firstClick.r, firstClick.c, (nr, nc) => {
		safeZone.add(idx(nr, nc, cols));
	});

	let minesPlaced = 0;
	while (minesPlaced < mines) {
		const r = Math.floor(Math.random() * rows);
		const c = Math.floor(Math.random() * cols);

		if (grid[r][c].isMine || safeZone.has(idx(r, c, cols))) {
			continue;
		}

		grid[r][c].isMine = true;
		minesPlaced += 1;
	}

	// Compute neighbor counts
	for (let r = 0; r < rows; r++) {
		for (let c = 0; c < cols; c++) {
			const cell = grid[r][c];
			if (cell.isMine) {
				continue;
			}

			let count = 0;
			forEachNeighbor(grid, r, c, (nr, nc) => {
				if (grid[nr][nc].isMine) {
					count += 1;
				}
			});

			cell.neighborCount = count;
		}
	}
}

/**
 * Reveal a cell. If it is a zero, flood-reveal connected zeros and their borders.
 * Mutates the grid in place.
 */
export function revealCell(grid: Cell[][], r: number, c: number): RevealResult {
	if (!inBounds(grid, r, c)) {
		return { grid, gameOver: false };
	}

	const start = grid[r][c];
	if (start.isOpen || start.isFlagged) {
		return { grid, gameOver: false };
	}

	if (start.isMine) {
		start.isOpen = true;
		return { grid, gameOver: true };
	}

	// Iterative flood fill (avoids recursion depth issues)
	const stack: Array<{ r: number; c: number }> = [{ r, c }];

	while (stack.length > 0) {
		const cur = stack.pop()!;
		const cell = grid[cur.r][cur.c];

		if (cell.isOpen || cell.isFlagged) {
			continue;
		}

		cell.isOpen = true;

		if (cell.neighborCount !== 0) {
			continue;
		}

		forEachNeighbor(grid, cur.r, cur.c, (nr, nc) => {
			const ncell = grid[nr][nc];
			if (!ncell.isOpen && !ncell.isFlagged && !ncell.isMine) {
				stack.push({ r: nr, c: nc });
			}
		});
	}

	return { grid, gameOver: false };
}

export function countFlagsAround(grid: Cell[][], r: number, c: number): number {
	let flagsAround = 0;
	forEachNeighbor(grid, r, c, (nr, nc) => {
		if (grid[nr][nc].isFlagged) {
			flagsAround += 1;
		}
	});
	return flagsAround;
}

export function revealCellsAround(grid: Cell[][], r: number, c: number): RevealResult {
	let gameOver = false;

	forEachNeighbor(grid, r, c, (nr, nc) => {
		if (grid[nr][nc].isFlagged) {
			return;
		}

		const result = revealCell(grid, nr, nc);
		if (result.gameOver) {
			gameOver = true;
		}
	});

	return { grid, gameOver };
}

export function calculate3BV(grid: Cell[][]): number {
	let threeBV = 0;
	const rows = grid.length;
	const cols = grid[0].length;
	const visited = Array.from({ length: rows }, () => Array<boolean>(cols).fill(false));

	// Count openings (zero islands)
	for (let r = 0; r < rows; r++) {
		for (let c = 0; c < cols; c++) {
			const cell = grid[r][c];
			if (cell.isMine || cell.neighborCount !== 0 || visited[r][c]) {
				continue;
			}

			threeBV += 1;

			const stack: Array<{ r: number; c: number }> = [{ r, c }];
			while (stack.length > 0) {
				const cur = stack.pop()!;
				if (visited[cur.r][cur.c]) {
					continue;
				}
				visited[cur.r][cur.c] = true;

				if (grid[cur.r][cur.c].neighborCount !== 0) {
					continue;
				}

				for (let dr = -1; dr <= 1; dr++) {
					for (let dc = -1; dc <= 1; dc++) {
						if (dr === 0 && dc === 0) {
							continue;
						}

						const nr = cur.r + dr;
						const nc = cur.c + dc;
						if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && !visited[nr][nc]) {
							stack.push({ r: nr, c: nc });
						}
					}
				}
			}
		}
	}

	// Count remaining safe cells not in openings
	for (let r = 0; r < rows; r++) {
		for (let c = 0; c < cols; c++) {
			if (!grid[r][c].isMine && !visited[r][c]) {
				threeBV += 1;
			}
		}
	}

	return threeBV;
}
