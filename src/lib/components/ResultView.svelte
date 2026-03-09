<script lang="ts">
	import { onMount } from 'svelte';
	import Chart from 'chart.js/auto';
	import { Skull, Eye } from 'lucide-svelte';
	import MapViewer from './MapViewer.svelte';

	export let win = false;
	export let time = 0;
	export let totalMines = 0;
	export let totalClicks = 0;
	export let history: number[] = [];
	export let finalGrid: any[][] = [];
	export let accuracy = 0;
	export let sizeLabel = '';
	export let gridsSolved = 0;
	export let mode: 'standard' | 'time' = 'standard';
	export let cells = 0;
	export let restart: () => void;

	let chartCanvas: HTMLCanvasElement;
	let chartInstance: Chart | null = null;
	let showMap = false;

	$: minesPerMin = totalMines > 0 ? ((totalMines / Math.max(time, 1)) * 60).toFixed(1) : '0.0';

	$: consistency = (() => {
		if (!history?.length) return 0;
		const mean = history.reduce((a, b) => a + b, 0) / history.length;
		const variance = history.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / history.length;
		return Math.max(0, Math.round(100 - Math.sqrt(variance) * 10));
	})();

	onMount(() => {
		if (!win || !chartCanvas) return;

		chartInstance = new Chart(chartCanvas, {
			type: 'line',
			data: {
				labels: history.map((_, i) => i + 1),
				datasets: [
					{
						data: history,
						borderColor: '#d8b4fe',
						backgroundColor: 'rgba(216, 180, 254, 0.1)',
						fill: true,
						tension: 0.4,
						pointRadius: 0,
						borderWidth: 2
					}
				]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				plugins: { legend: { display: false }, tooltip: { enabled: false } },
				scales: { x: { display: false }, y: { display: false } },
				layout: { padding: 0 }
			}
		});

		return () => chartInstance?.destroy();
	});
</script>

{#if showMap}
	<MapViewer grid={finalGrid} onClose={() => (showMap = false)} />
{/if}

<div
	class="flex min-h-[50vh] w-full flex-col items-center justify-center gap-8 duration-300 {win
		? 'animate-in fade-in zoom-in'
		: 'animate-shake'}"
>
	{#if !win}
		<div class="flex flex-col items-center gap-6 text-error">
			<Skull size={64} class="animate-bounce" />
			<div class="relative">
				<h1
					class="absolute left-1 top-1 select-none text-8xl font-black uppercase italic tracking-tighter text-red-900 opacity-50 blur-sm"
				>
					BOOM
				</h1>

				<h1
					class="boom-text relative select-none text-8xl font-black uppercase italic tracking-tighter"
				>
					BOOM
				</h1>
			</div>
			<p class="font-mono text-sub">Run ended.</p>
		</div>

		<div class="mt-8 grid w-full max-w-lg grid-cols-3 gap-8 text-center">
			<div class="flex flex-col">
				<span class="text-xs font-bold uppercase text-sub opacity-50">time</span>
				<span class="text-2xl font-bold text-text">{time}s</span>
			</div>
			<div class="flex flex-col">
				<span class="text-xs font-bold uppercase text-sub opacity-50"
					>{mode === 'standard' ? 'swept' : 'solved'}</span
				>
				<span class="text-2xl font-bold text-text">{mode === 'standard' ? cells : gridsSolved}</span
				>
			</div>
			<div class="flex flex-col">
				<span class="text-xs font-bold uppercase text-sub opacity-50">acc</span>
				<span class="text-2xl font-bold text-text">{accuracy}%</span>
			</div>
		</div>
	{:else}
		<div class="grid w-full max-w-4xl grid-cols-[auto_1fr] items-center gap-12">
			<div class="flex min-w-[120px] flex-col gap-6">
				<div>
					<span class="mb-1 block text-2xl font-bold leading-none text-sub opacity-50"
						>{mode === 'time' ? 'grid(s)' : 'mines/min'}</span
					>
					<span class="block text-[64px] font-bold leading-[0.8] text-main"
						>{mode === 'time' ? gridsSolved : minesPerMin}</span
					>
				</div>
				<div>
					<span class="mb-1 block text-2xl font-bold leading-none text-sub opacity-50">acc</span>
					<span class="block text-[64px] font-bold leading-[0.8] text-main">{accuracy}%</span>
				</div>
			</div>
			<div class="relative h-[180px] w-full">
				<canvas bind:this={chartCanvas}></canvas>
			</div>
		</div>

		<div class="grid w-full max-w-4xl grid-cols-5 gap-4">
			<div class="flex flex-col">
				<span class="mb-1 text-xs font-bold text-sub opacity-50">type</span>
				<span class="font-bold leading-tight text-text"
					>{mode === 'time' ? 'time attack' : 'standard'}</span
				>
				<span class="text-sm leading-tight text-main">{sizeLabel}</span>
			</div>
			<div class="flex flex-col">
				<span class="mb-1 text-xs font-bold text-sub opacity-50">mines</span>
				<span class="text-2xl font-bold text-text">{totalMines}</span>
			</div>
			<div class="flex flex-col">
				<span class="mb-1 text-xs font-bold text-sub opacity-50">clicks</span>
				<span class="text-2xl font-bold text-text">{totalClicks}</span>
			</div>
			<div class="flex flex-col">
				<span class="mb-1 text-xs font-bold text-sub opacity-50">consistency</span>
				<span class="text-2xl font-bold text-text">{consistency}%</span>
			</div>
			<div class="flex flex-col">
				<span class="mb-1 text-xs font-bold text-sub opacity-50">time</span>
				<span class="text-2xl font-bold text-text">{time}s</span>
			</div>
		</div>
	{/if}

	<div class="mt-8 flex flex-col items-center gap-4">
		{#if finalGrid.length > 0}
			<button
				type="button"
				class="flex items-center gap-2 rounded-full bg-sub/10 px-6 py-3 font-bold text-main transition-all hover:bg-main hover:text-bg"
				on:click|stopPropagation={() => (showMap = true)}
			>
				<Eye size={18} />
				<span>View Map</span>
			</button>
		{/if}

		<button
			type="button"
			class="cursor-pointer text-xs text-sub opacity-40 transition-opacity hover:opacity-100"
			on:click={restart}
		>
			press <kbd class="font-sans">tab</kbd> to restart
		</button>
	</div>
</div>

<style>
	@keyframes shake {
		0%,
		100% {
			transform: translateX(0);
		}
		10%,
		30%,
		50%,
		70%,
		90% {
			transform: translateX(-5px);
		}
		20%,
		40%,
		60%,
		80% {
			transform: translateX(5px);
		}
	}
	.animate-shake {
		animation: shake 0.5s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
	}

	.boom-text {
		color: transparent;
		-webkit-text-stroke: 2px #ef4444;
	}
</style>
