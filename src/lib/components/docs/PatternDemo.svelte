<script lang="ts">
	import GameGrid from '$lib/components/GameGrid.svelte';

	export let grid: any[][];
	export let cols: number;
	export let title: string;
	export let desc: string;
</script>

<div class="rounded-lg border border-main/10 bg-bg p-6 shadow-sm transition hover:border-main/30">
	<h3 class="mb-2 font-mono text-lg font-bold text-main">{title}</h3>

	<div class="mb-4 flex justify-center rounded bg-sub/5 p-6">
		<GameGrid {grid} numCols={cols} gameState="playing" cursor={{ r: -1, c: -1 }} />
	</div>

	<p class="text-sm leading-relaxed text-sub">{desc}</p>
</div>
