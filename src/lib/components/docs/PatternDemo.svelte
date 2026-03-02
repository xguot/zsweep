<script lang="ts">
	import GameGrid from '$lib/components/GameGrid.svelte';

	export let pattern: '1-2-1' | '1-2-2-1' | 'wall-3' | '2-3-2' | 'corner-l' | 't-junction' | '1-2-1-stair';
	export let title: string;
	export let desc: string;

	function makeCell(r: number, c: number, overrides = {}): any {
		return {
			row: r,
			col: c,
			isMine: false,
			isOpen: false,
			isFlagged: false,
			neighborCount: 0,
			...overrides
		};
	}

	let grid: any[][] = [];
	let cols = 5;

	function get121() {
		return [
			[
				makeCell(0, 0, { isMine: true, isFlagged: true }),
				makeCell(0, 1),
				makeCell(0, 2, { isMine: true, isFlagged: true }),
				makeCell(0, 3),
				makeCell(0, 4)
			],
			[
				makeCell(1, 0, { isOpen: true, neighborCount: 1 }),
				makeCell(1, 1, { isOpen: true, neighborCount: 2 }),
				makeCell(1, 2, { isOpen: true, neighborCount: 1 }),
				makeCell(1, 3, { isOpen: true, neighborCount: 1 }),
				makeCell(1, 4, { isOpen: true, neighborCount: 0 })
			]
		];
	}

	function get1221() {
		return [
			[
				makeCell(0, 0),
				makeCell(0, 1, { isMine: true, isFlagged: true }),
				makeCell(0, 2, { isMine: true, isFlagged: true }),
				makeCell(0, 3),
				makeCell(0, 4)
			],
			[
				makeCell(1, 0, { isOpen: true, neighborCount: 1 }),
				makeCell(1, 1, { isOpen: true, neighborCount: 2 }),
				makeCell(1, 2, { isOpen: true, neighborCount: 2 }),
				makeCell(1, 3, { isOpen: true, neighborCount: 1 }),
				makeCell(1, 4, { isOpen: true, neighborCount: 0 })
			]
		];
	}

	function getWall3() {
		return [
			[
				makeCell(0, 0, { isMine: true, isFlagged: true }),
				makeCell(0, 1, { isMine: true, isFlagged: true }),
				makeCell(0, 2, { isMine: true, isFlagged: true })
			],
			[
				makeCell(1, 0, { isOpen: true, neighborCount: 2 }),
				makeCell(1, 1, { isOpen: true, neighborCount: 3 }),
				makeCell(1, 2, { isOpen: true, neighborCount: 2 })
			]
		];
	}

	function get232() {
		return [
			[
				makeCell(0, 0, { isMine: true, isFlagged: true }),
				makeCell(0, 1),
				makeCell(0, 2, { isMine: true, isFlagged: true }),
				makeCell(0, 3),
				makeCell(0, 4, { isMine: true, isFlagged: true })
			],
			[
				makeCell(1, 0, { isOpen: true, neighborCount: 1 }),
				makeCell(1, 1, { isOpen: true, neighborCount: 2 }),
				makeCell(1, 2, { isOpen: true, neighborCount: 3 }),
				makeCell(1, 3, { isOpen: true, neighborCount: 2 }),
				makeCell(1, 4, { isOpen: true, neighborCount: 1 })
			]
		];
	}

	function getCornerL() {
		return [
			[
				makeCell(0, 0, { isMine: true, isFlagged: true }),
				makeCell(0, 1),
				makeCell(0, 2),
				makeCell(0, 3)
			],
			[
				makeCell(1, 0, { isOpen: true, neighborCount: 1 }),
				makeCell(1, 1, { isOpen: true, neighborCount: 2 }),
				makeCell(1, 2, { isOpen: true, neighborCount: 1 }),
				makeCell(1, 3, { isOpen: true, neighborCount: 0 })
			],
			[
				makeCell(2, 0, { isOpen: true, neighborCount: 0 }),
				makeCell(2, 1, { isOpen: true, neighborCount: 1 }),
				makeCell(2, 2, { isMine: true, isFlagged: true }),
				makeCell(2, 3)
			],
			[
				makeCell(3, 0, { isOpen: true, neighborCount: 0 }),
				makeCell(3, 1, { isOpen: true, neighborCount: 1 }),
				makeCell(3, 2, { isOpen: true, neighborCount: 1 }),
				makeCell(3, 3, { isOpen: true, neighborCount: 1 })
			]
		];
	}

	function getTJunction() {
		return [
			[
				makeCell(0, 0, { isMine: true, isFlagged: true }),
				makeCell(0, 1),
				makeCell(0, 2),
				makeCell(0, 3),
				makeCell(0, 4, { isMine: true, isFlagged: true })
			],
			[
				makeCell(1, 0, { isOpen: true, neighborCount: 1 }),
				makeCell(1, 1, { isOpen: true, neighborCount: 2 }),
				makeCell(1, 2, { isOpen: true, neighborCount: 1 }),
				makeCell(1, 3, { isOpen: true, neighborCount: 2 }),
				makeCell(1, 4, { isOpen: true, neighborCount: 1 })
			],
			[
				makeCell(2, 0, { isOpen: true, neighborCount: 0 }),
				makeCell(2, 1, { isOpen: true, neighborCount: 1 }),
				makeCell(2, 2, { isMine: true, isFlagged: true }),
				makeCell(2, 3, { isOpen: true, neighborCount: 1 }),
				makeCell(2, 4, { isOpen: true, neighborCount: 0 })
			],
			[
				makeCell(3, 0, { isOpen: true, neighborCount: 0 }),
				makeCell(3, 1, { isOpen: true, neighborCount: 1 }),
				makeCell(3, 2, { isOpen: true, neighborCount: 1 }),
				makeCell(3, 3, { isOpen: true, neighborCount: 1 }),
				makeCell(3, 4, { isOpen: true, neighborCount: 0 })
			]
		];
	}

	function get121Stair() {
		return [
			[
				makeCell(0, 0, { isMine: true, isFlagged: true }),
				makeCell(0, 1),
				makeCell(0, 2),
				makeCell(0, 3),
				makeCell(0, 4)
			],
			[
				makeCell(1, 0, { isOpen: true, neighborCount: 1 }),
				makeCell(1, 1, { isOpen: true, neighborCount: 2 }),
				makeCell(1, 2),
				makeCell(1, 3),
				makeCell(1, 4)
			],
			[
				makeCell(2, 0, { isOpen: true, neighborCount: 0 }),
				makeCell(2, 1, { isOpen: true, neighborCount: 1 }),
				makeCell(2, 2, { isOpen: true, neighborCount: 2 }),
				makeCell(2, 3),
				makeCell(2, 4)
			],
			[
				makeCell(3, 0, { isOpen: true, neighborCount: 0 }),
				makeCell(3, 1, { isOpen: true, neighborCount: 0 }),
				makeCell(3, 2, { isOpen: true, neighborCount: 1 }),
				makeCell(3, 3, { isMine: true, isFlagged: true }),
				makeCell(3, 4)
			]
		];
	}

	if (pattern === '1-2-1') {
		grid = get121();
		cols = 5;
	} else if (pattern === '1-2-2-1') {
		grid = get1221();
		cols = 5;
	} else if (pattern === 'wall-3') {
		grid = getWall3();
		cols = 3;
	} else if (pattern === '2-3-2') {
		grid = get232();
		cols = 5;
	} else if (pattern === 'corner-l') {
		grid = getCornerL();
		cols = 4;
	} else if (pattern === 't-junction') {
		grid = getTJunction();
		cols = 5;
	} else if (pattern === '1-2-1-stair') {
		grid = get121Stair();
		cols = 5;
	}
</script>

<div class="rounded-lg border border-main/10 bg-bg p-6 shadow-sm transition hover:border-main/30">
	<h3 class="mb-2 font-mono text-lg font-bold text-main">{title}</h3>

	<div class="mb-4 flex justify-center rounded bg-sub/5 p-6">
		<GameGrid {grid} numCols={cols} gameState="playing" cursor={{ r: -1, c: -1 }} />
	</div>

	<p class="text-sm leading-relaxed text-sub">{desc}</p>
</div>
