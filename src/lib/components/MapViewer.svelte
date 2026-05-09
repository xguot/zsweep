<script lang="ts">
	import { X } from 'lucide-svelte';
	import GameGrid from './GameGrid.svelte';
	import type { Cell } from '$lib/minesweeper';

	interface Props {
		grid?: Cell[][];
		onClose: () => void;
	}

	let { grid = [], onClose }: Props = $props();

	function handleKey(e: KeyboardEvent) {
		const isEscape = e.key === 'Escape';
		const isCtrlKey = e.ctrlKey && (e.key === '[' || e.key === 'c');

		if (isEscape || isCtrlKey) {
			onClose();
		}
	}
</script>

<svelte:window onkeydown={handleKey} />

<div
	class="animate-in fade-in fixed inset-0 z-50 flex flex-col items-center justify-center bg-bg/95 backdrop-blur-sm duration-200"
>
	<button
		onclick={onClose}
		class="absolute right-8 top-8 p-2 text-sub transition-colors hover:text-text"
		aria-label="Close Map"
	>
		<X size={32} />
	</button>

	<h2 class="mb-6 text-2xl font-bold text-main">Map Inspection</h2>

	<div class="pointer-events-none scale-90 overflow-hidden rounded-lg opacity-100 shadow-2xl">
		{#if grid && grid.length > 0}
			<GameGrid
				{grid}
				cursor={{ r: -1, c: -1 }}
				numCols={grid[0].length}
				gameState="finished"
				vimMode={false}
				isMouseDown={false}
				lineNumberMode="off"
			/>
		{/if}
	</div>

	<p class="mt-6 font-mono text-sm text-sub opacity-60">Press ESC to close</p>
</div>
