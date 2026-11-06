import { describe, it as test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
	calculate3BV,
	calculateSolved3BV,
	createGrid,
	DIRECTIONS,
	revealCell,
	revealCellsAround
} from './minesweeper';

function board(rows: string[]) {
	const grid = createGrid(rows.length, rows[0].length);
	for (const cell of grid.flat()) cell.isMine = rows[cell.row][cell.col] === '*';
	for (const cell of grid.flat()) {
		if (cell.isMine) continue;
		cell.neighborCount = DIRECTIONS.filter(
			([dr, dc]) => grid[cell.row + dr]?.[cell.col + dc]?.isMine
		).length;
	}
	return grid;
}

describe('completed 3BV', () => {
	test('counts an opening once, including when only its border is open', () => {
		const grid = board(['....', '....', '...*']);
		grid[1][2].isOpen = true;
		assert.equal(calculateSolved3BV(grid), 0);
		revealCell(grid, 0, 0);
		assert.equal(calculateSolved3BV(grid), 1);
		assert.equal(calculateSolved3BV(grid), calculate3BV(grid));
	});

	test('counts isolated numbers only when opened', () => {
		const grid = board(['*.*', '.*.', '*.*']);
		assert.equal(calculate3BV(grid), 4);
		grid[0][1].isOpen = true;
		grid[2][1].isOpen = true;
		assert.equal(calculateSolved3BV(grid), 2);
	});

	test('a fully revealed board always has its full 3BV', () => {
		for (let mask = 0; mask < 512; mask++) {
			const rows = Array.from({ length: 3 }, (_, r) =>
				Array.from({ length: 3 }, (_, c) => (mask & (1 << (r * 3 + c)) ? '*' : '.')).join('')
			);
			const grid = board(rows);
			for (const cell of grid.flat()) cell.isOpen = !cell.isMine;
			assert.equal(calculateSolved3BV(grid), calculate3BV(grid));
		}
	});
});

describe('chording', () => {
	test('stops at the mine and reports the exploded cell', () => {
		const grid = board(['*..', '...', '...']);
		grid[1][1].isOpen = true;
		grid[2][2].isFlagged = true;
		const result = revealCellsAround(grid, 1, 1);
		assert.equal(result.gameOver, true);
		assert.deepEqual(result.exploded, { r: 0, c: 0 });
		assert.equal(grid[0][1].isOpen, false);
	});
});
