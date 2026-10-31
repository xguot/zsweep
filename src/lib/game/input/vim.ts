import { DIRECTIONS, type Cell } from '$lib/minesweeper';

/**
 * Represents the distinct actions a Vim command can trigger.
 */
export type VimAction =
	| { type: 'MOVE_CURSOR'; dx: number; dy: number }
	| { type: 'REVEAL' }
	| { type: 'FLAG' }
	| { type: 'SMART' }
	| { type: 'OPERATOR'; operator: 'SMART' | 'FLAG' | 'REVEAL' }
	| { type: 'DIGIT'; value: string }
	| { type: 'ZERO' }
	| { type: 'GO_TOP' }
	| { type: 'GO_BOTTOM' }
	| { type: 'START_ROW' }
	| { type: 'NEXT_UNREVEALED' }
	| { type: 'PREV_UNREVEALED' }
	| { type: 'END_UNREVEALED' }
	| { type: 'START_SEARCH' }
	| { type: 'NEXT_MATCH' }
	| { type: 'PREV_MATCH' }
	| null;

/**
 * Check whether a cell is an "active frontier clue":
 * an open numbered cell that touches at least one unrevealed, unflagged neighbor.
 */
export function isFrontierClue(grid: Cell[][], r: number, c: number): boolean {
	const cell = grid[r]?.[c];
	if (!cell || !cell.isOpen || cell.neighborCount <= 0) return false;
	for (const [dr, dc] of DIRECTIONS) {
		const neighbor = grid[r + dr]?.[c + dc];
		if (neighbor && !neighbor.isOpen && !neighbor.isFlagged) {
			return true;
		}
	}
	return false;
}

/**
 * Check whether a cell counts as part of a "word" in Minesweeper:
 * unrevealed and unflagged cells form primary sweep words; if all unrevealed cells
 * are flagged, any unrevealed cell counts.
 */
function isWordCell(cell: Cell | undefined): boolean {
	return !!cell && !cell.isOpen;
}

/**
 * Maps a key press to a specific Vim action or motion.
 * @param key - The keyboard event key value.
 */
export function handleVimKey(key: string): VimAction {
	if (/^[1-9]$/.test(key)) return { type: 'DIGIT', value: key };

	switch (key) {
		case '0':
			return { type: 'ZERO' };
		case '_':
		case '^':
			return { type: 'START_ROW' };

		case '/':
			return { type: 'START_SEARCH' };
		case 'n':
			return { type: 'NEXT_MATCH' };
		case 'N':
			return { type: 'PREV_MATCH' };

		case 'h':
		case 'ArrowLeft':
			return { type: 'MOVE_CURSOR', dx: -1, dy: 0 };
		case 'j':
		case 'ArrowDown':
			return { type: 'MOVE_CURSOR', dx: 0, dy: 1 };
		case 'k':
		case 'ArrowUp':
			return { type: 'MOVE_CURSOR', dx: 0, dy: -1 };
		case 'l':
		case 'ArrowRight':
			return { type: 'MOVE_CURSOR', dx: 1, dy: 0 };

		case '$':
			return { type: 'MOVE_CURSOR', dx: 999, dy: 0 };
		case 'G':
			return { type: 'GO_BOTTOM' };
		case 'g':
			return { type: 'GO_TOP' };

		case 'w':
			return { type: 'NEXT_UNREVEALED' };
		case 'b':
			return { type: 'PREV_UNREVEALED' };
		case 'e':
			return { type: 'END_UNREVEALED' };

		case 'i':
		case 'Enter':
			return { type: 'REVEAL' };
		case 'x':
		case 'f':
			return { type: 'FLAG' };
		case ' ':
		case 'a':
			return { type: 'SMART' };
		case 'd':
			return { type: 'OPERATOR', operator: 'FLAG' };
		case 'c':
			return { type: 'OPERATOR', operator: 'REVEAL' };

		default:
			return null;
	}
}

/**
 * Calculates the destination coordinates for g-prefixed Vim motions (gg, ge, g_, gm).
 */
export function calculateVimGJump(
	key: string,
	multiplier: number,
	cursor: { r: number; c: number },
	grid: Cell[][],
	rows: number,
	cols: number
): { r: number; c: number } | null {
	const { r, c } = cursor;
	const total = rows * cols;
	if (total === 0) return null;

	// gg: Jump to top row (or specific row if multiplier > 1)
	if (key === 'g') {
		const targetRow = multiplier > 1 ? Math.min(rows - 1, multiplier - 1) : 0;
		return { r: targetRow, c };
	}

	// g_: Jump to the last unrevealed cell in the current row
	if (key === '_') {
		for (let col = cols - 1; col >= 0; col--) {
			if (!grid[r][col].isOpen) {
				return { r, c: col };
			}
		}
		return { r, c: cols - 1 };
	}

	// gm: Jump to the middle column of the current row
	if (key === 'm') {
		return { r, c: Math.floor((cols - 1) / 2) };
	}

	// ge: Jump backward to the END of the previous block of unrevealed cells
	if (key === 'e') {
		let index = r * cols + c;

		for (let i = 0; i < multiplier; i++) {
			let scanned = 0;

			// Step back at least 1 cell
			index = (index - 1 + total) % total;
			scanned++;

			// If we started inside an unrevealed block and stepped into the same block on the same row,
			// skip backward to the start of this block first so we find the PREVIOUS block's end.
			if (isWordCell(grid[Math.floor(index / cols)][index % cols])) {
				const curRow = Math.floor(index / cols);
				const origCellWasWord = isWordCell(grid[r][c]);
				if (origCellWasWord && curRow === r) {
					while (
						scanned < total &&
						Math.floor(index / cols) === curRow &&
						isWordCell(grid[Math.floor(index / cols)][index % cols])
					) {
						index = (index - 1 + total) % total;
						scanned++;
					}
				}
			}

			// Skip open cells backward until we hit an unrevealed cell (which is the end of that block)
			while (scanned < total && !isWordCell(grid[Math.floor(index / cols)][index % cols])) {
				index = (index - 1 + total) % total;
				scanned++;
			}
		}

		return { r: Math.floor(index / cols), c: index % cols };
	}

	return null;
}

/**
 * Calculates the destination coordinates for Vim motions.
 * Handles simple directions (for operators) and complex state-dependent jumps.
 */
export function calculateVimJump(
	key: string,
	multiplier: number,
	cursor: { r: number; c: number },
	grid: Cell[][],
	rows: number,
	cols: number
): { r: number; c: number } | null {
	let { r, c } = cursor;
	const total = rows * cols;
	if (total === 0) return null;

	// Simple Directions
	if (key === 'h' || key === 'ArrowLeft') return { r, c: Math.max(0, c - multiplier) };
	if (key === 'l' || key === 'ArrowRight') return { r, c: Math.min(cols - 1, c + multiplier) };
	if (key === 'k' || key === 'ArrowUp') return { r: Math.max(0, r - multiplier), c };
	if (key === 'j' || key === 'ArrowDown') return { r: Math.min(rows - 1, r + multiplier), c };

	// Half-grid vertical jumps (J / K)
	if (key === 'J') {
		const step = Math.max(1, Math.floor(rows / 2)) * multiplier;
		return { r: Math.min(rows - 1, r + step), c };
	}
	if (key === 'K') {
		const step = Math.max(1, Math.floor(rows / 2)) * multiplier;
		return { r: Math.max(0, r - step), c };
	}

	// Screen / Board anchors (H = Top, M = Middle, L = Bottom)
	if (key === 'H') {
		const offset = multiplier > 1 ? Math.min(rows - 1, multiplier - 1) : 0;
		return { r: offset, c };
	}
	if (key === 'M') {
		return { r: Math.floor((rows - 1) / 2), c };
	}
	if (key === 'L') {
		const offset = multiplier > 1 ? Math.max(0, rows - multiplier) : rows - 1;
		return { r: offset, c };
	}

	// Line Boundaries
	if (key === '0') return { r, c: 0 };
	if (key === '^' || key === '_') {
		const firstUnrevealed = grid[r]?.findIndex((cell) => !cell.isOpen) ?? -1;
		return { r, c: firstUnrevealed > -1 ? firstUnrevealed : 0 };
	}
	if (key === '$') return { r, c: cols - 1 };
	if (key === '%') return { r, c: cols - 1 - c };

	if (key === 'G') {
		const target = multiplier > 1 ? Math.min(rows - 1, multiplier - 1) : rows - 1;
		return { r: target, c };
	}

	// 'w': Jump forward to the start of the NEXT consecutive block of unrevealed cells
	if (key === 'w') {
		let index = r * cols + c;

		for (let i = 0; i < multiplier; i++) {
			let scanned = 0;

			// 1. If currently on an unrevealed cell, skip the rest of this block on the current row
			if (isWordCell(grid[Math.floor(index / cols)][index % cols])) {
				const startRow = Math.floor(index / cols);
				while (
					scanned < total &&
					Math.floor(index / cols) === startRow &&
					isWordCell(grid[Math.floor(index / cols)][index % cols])
				) {
					index = (index + 1) % total;
					scanned++;
				}
			}

			// 2. Skip open cells (gaps) until we land on the start of the next unrevealed block
			while (scanned < total && !isWordCell(grid[Math.floor(index / cols)][index % cols])) {
				index = (index + 1) % total;
				scanned++;
			}
		}
		return { r: Math.floor(index / cols), c: index % cols };
	}

	// 'b': Jump backward to the start of the PREVIOUS consecutive block of unrevealed cells
	if (key === 'b') {
		let index = r * cols + c;

		for (let i = 0; i < multiplier; i++) {
			let scanned = 0;

			// Step back 1 cell to leave the current start position
			index = (index - 1 + total) % total;
			scanned++;

			// Skip open cells backward until we hit an unrevealed block
			while (scanned < total && !isWordCell(grid[Math.floor(index / cols)][index % cols])) {
				index = (index - 1 + total) % total;
				scanned++;
			}

			// Rewind to the start of this unrevealed block within the same row
			const targetRow = Math.floor(index / cols);
			while (scanned < total) {
				const prevIndex = (index - 1 + total) % total;
				const prevRow = Math.floor(prevIndex / cols);
				const prevCol = prevIndex % cols;

				if (prevRow !== targetRow || !isWordCell(grid[prevRow][prevCol])) break;

				index = prevIndex;
				scanned++;
			}
		}
		return { r: Math.floor(index / cols), c: index % cols };
	}

	// 'e': Jump forward to the END of the current or next consecutive block of unrevealed cells
	if (key === 'e') {
		let index = r * cols + c;

		for (let i = 0; i < multiplier; i++) {
			let scanned = 0;

			// Step forward at least 1 cell (just like Vim's 'e' when already at the end of a word)
			index = (index + 1) % total;
			scanned++;

			// Skip any open cells to find an unrevealed block
			while (scanned < total && !isWordCell(grid[Math.floor(index / cols)][index % cols])) {
				index = (index + 1) % total;
				scanned++;
			}

			// Advance to the last unrevealed cell of this block on the same row
			const targetRow = Math.floor(index / cols);
			while (scanned < total) {
				const nextIndex = (index + 1) % total;
				const nextRow = Math.floor(nextIndex / cols);
				const nextCol = nextIndex % cols;

				if (nextRow !== targetRow || !isWordCell(grid[nextRow][nextCol])) break;

				index = nextIndex;
				scanned++;
			}
		}
		return { r: Math.floor(index / cols), c: index % cols };
	}

	// 'W': Jump forward to the next active frontier number cell (open clue touching unrevealed cells)
	if (key === 'W') {
		let index = r * cols + c;
		for (let i = 0; i < multiplier; i++) {
			let scanned = 0;
			do {
				index = (index + 1) % total;
				scanned++;
			} while (scanned < total && !isFrontierClue(grid, Math.floor(index / cols), index % cols));
		}
		return { r: Math.floor(index / cols), c: index % cols };
	}

	// 'B': Jump backward to the previous active frontier number cell
	if (key === 'B') {
		let index = r * cols + c;
		for (let i = 0; i < multiplier; i++) {
			let scanned = 0;
			do {
				index = (index - 1 + total) % total;
				scanned++;
			} while (scanned < total && !isFrontierClue(grid, Math.floor(index / cols), index % cols));
		}
		return { r: Math.floor(index / cols), c: index % cols };
	}

	// 'E': Jump forward to the end of a contiguous horizontal run of frontier clue numbers
	if (key === 'E') {
		let index = r * cols + c;
		for (let i = 0; i < multiplier; i++) {
			let scanned = 0;
			index = (index + 1) % total;
			scanned++;
			while (scanned < total && !isFrontierClue(grid, Math.floor(index / cols), index % cols)) {
				index = (index + 1) % total;
				scanned++;
			}
			const targetRow = Math.floor(index / cols);
			while (scanned < total) {
				const nextIndex = (index + 1) % total;
				const nextRow = Math.floor(nextIndex / cols);
				const nextCol = nextIndex % cols;
				if (nextRow !== targetRow || !isFrontierClue(grid, nextRow, nextCol)) break;
				index = nextIndex;
				scanned++;
			}
		}
		return { r: Math.floor(index / cols), c: index % cols };
	}

	// '}': Jump DOWN to next row boundary / paragraph with unrevealed cells
	if (key === '}') {
		for (let i = 0; i < multiplier; i++) {
			if (r >= rows - 1) break;
			let found = false;
			for (let nextR = r + 1; nextR < rows; nextR++) {
				// Prefer staying in current column if unrevealed, otherwise jump to first unrevealed cell in that row
				if (!grid[nextR][c]?.isOpen) {
					r = nextR;
					found = true;
					break;
				}
				const firstClosed = grid[nextR].findIndex((cell) => !cell.isOpen);
				if (firstClosed > -1) {
					r = nextR;
					c = firstClosed;
					found = true;
					break;
				}
			}
			if (!found) r = rows - 1;
		}
		return { r, c };
	}

	// '{': Jump UP to previous row boundary / paragraph with unrevealed cells
	if (key === '{') {
		for (let i = 0; i < multiplier; i++) {
			if (r <= 0) break;
			let found = false;
			for (let prevR = r - 1; prevR >= 0; prevR--) {
				if (!grid[prevR][c]?.isOpen) {
					r = prevR;
					found = true;
					break;
				}
				const firstClosed = grid[prevR].findIndex((cell) => !cell.isOpen);
				if (firstClosed > -1) {
					r = prevR;
					c = firstClosed;
					found = true;
					break;
				}
			}
			if (!found) r = 0;
		}
		return { r, c };
	}

	return null;
}
