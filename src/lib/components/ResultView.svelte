<script lang="ts">
	import Chart from 'chart.js/auto';
	import { onMount } from 'svelte';
	import { Eye, RotateCcw } from 'lucide-svelte';
	import { currentTheme } from '$lib/themeStore.svelte';
	import MapViewer from './MapViewer.svelte';

	interface Props {
		win?: boolean;
		time?: number;
		totalMines?: number;
		totalClicks?: number;
		history?: number[];
		finalGrid?: any[][];
		accuracy?: number;
		sizeLabel?: string;
		gridsSolved?: number;
		mode?: 'standard' | 'time';
		cells?: number;
		threeBV?: number;
		restart: () => void;
	}

	let {
		win = false,
		time = 0,
		totalMines = 0,
		totalClicks = 0,
		history = [],
		finalGrid = [],
		accuracy = 0,
		sizeLabel = '',
		gridsSolved = 0,
		mode = 'standard',
		cells = 0,
		threeBV = 0,
		restart
	}: Props = $props();

	let chartCanvas: HTMLCanvasElement | undefined = $state();
	let chartInstance: Chart | null = null;
	let showMap = $state(false);

	let minesPerMin = $derived(
		win && totalMines > 0 ? ((totalMines / Math.max(time, 1)) * 60).toFixed(1) : '0.0'
	);

	let threeBVPerSec = $derived(threeBV > 0 ? (threeBV / Math.max(time, 1)).toFixed(2) : '0.00');

	let consistency = $derived(
		(() => {
			if (!history?.length) return 0;
			const mean = history.reduce((a, b) => a + b, 0) / history.length;
			const variance = history.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / history.length;
			return Math.max(0, Math.round(100 - Math.sqrt(variance) * 10));
		})()
	);

	function buildChart() {
		if (!chartCanvas) return;
		chartInstance?.destroy();

		const chartData =
			history.length === 0
				? [0, 0]
				: history.length === 1
					? [history[0], history[0]]
					: [...history];

		const theme = currentTheme.value;
		const accentRgb = win ? theme.colors.main : theme.colors.error;
		const subRgb = theme.colors.sub;
		const lineColor = `rgb(${accentRgb})`;
		const fillColor = `rgb(${accentRgb} / 0.12)`;
		const gridColor = `rgb(${subRgb} / 0.12)`;
		const tickColor = `rgb(${subRgb} / 0.6)`;

		chartInstance = new Chart(chartCanvas, {
			type: 'line',
			data: {
				labels: chartData.map((_, i) => `${i + 1}s`),
				datasets: [
					{
						label: 'actions/s',
						data: chartData,
						borderColor: lineColor,
						backgroundColor: fillColor,
						fill: true,
						tension: 0.35,
						pointRadius: 2,
						pointHoverRadius: 4,
						borderWidth: 2
					}
				]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				plugins: {
					legend: { display: false },
					tooltip: {
						enabled: true,
						backgroundColor: `rgb(${theme.colors.bg})`,
						titleColor: `rgb(${theme.colors.sub})`,
						bodyColor: `rgb(${theme.colors.text})`,
						borderColor: `rgb(${theme.colors.sub} / 0.2)`,
						borderWidth: 1,
						displayColors: false
					}
				},
				scales: {
					x: {
						grid: { color: gridColor },
						ticks: {
							color: tickColor,
							font: { family: 'JetBrains Mono, monospace', size: 10 },
							maxTicksLimit: 8
						}
					},
					y: {
						beginAtZero: true,
						grid: { color: gridColor },
						ticks: {
							color: tickColor,
							font: { family: 'JetBrains Mono, monospace', size: 10 },
							precision: 0
						}
					}
				},
				layout: { padding: 4 }
			}
		});
	}

	onMount(() => {
		buildChart();
		return () => chartInstance?.destroy();
	});

	$effect(() => {
		if (currentTheme.value && chartCanvas) {
			buildChart();
		}
	});
</script>

{#if showMap}
	<MapViewer grid={finalGrid} onClose={() => (showMap = false)} />
{/if}

<div
	class="animate-in fade-in flex min-h-[55vh] w-full max-w-4xl flex-col justify-center gap-10 px-6 duration-300"
>
	<div class="grid w-full grid-cols-1 items-center gap-8 md:grid-cols-[200px_1fr]">
		<div class="flex flex-row justify-between gap-6 md:flex-col">
			<div>
				<div class="mb-1 flex items-center gap-2">
					<span class="text-sm font-bold lowercase text-sub opacity-70">
						{mode === 'time' ? 'grids' : win ? 'mpm' : 'swept'}
					</span>
					<span
						class="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider {win
							? 'bg-main/15 text-main'
							: 'bg-error/15 text-error'}"
					>
						{win ? 'clear' : 'detonated'}
					</span>
				</div>
				<span
					class="block text-5xl font-bold leading-none md:text-6xl {win
						? 'text-main'
						: 'text-error'}"
				>
					{mode === 'time' ? gridsSolved : win ? minesPerMin : cells}
				</span>
			</div>

			<div>
				<span class="mb-1 block text-sm font-bold lowercase text-sub opacity-70">acc</span>
				<span class="block text-5xl font-bold leading-none text-main md:text-6xl">{accuracy}%</span>
			</div>
		</div>

		<div class="relative h-[200px] w-full rounded-lg border border-sub/10 bg-sub/5 p-4">
			<canvas bind:this={chartCanvas}></canvas>
		</div>
	</div>

	<div class="grid w-full grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-6">
		<div class="flex flex-col">
			<span class="mb-1 text-xs font-bold lowercase text-sub opacity-60">test type</span>
			<span class="text-sm font-bold leading-tight text-main">
				{mode === 'time' ? 'time' : 'standard'}
				{sizeLabel}
			</span>
			<span class="text-xs text-sub opacity-70">{win ? 'completed' : 'incomplete'}</span>
		</div>

		<div class="flex flex-col">
			<span class="mb-1 text-xs font-bold lowercase text-sub opacity-60">3bv/s</span>
			<span class="text-2xl font-bold text-main">{threeBVPerSec}</span>
			<span class="text-[10px] text-sub opacity-50">{threeBV} 3BV</span>
		</div>

		<div class="flex flex-col">
			<span class="mb-1 text-xs font-bold lowercase text-sub opacity-60">raw</span>
			<span class="text-2xl font-bold text-text">{cells}</span>
			<span class="text-[10px] text-sub opacity-50">safe cells</span>
		</div>

		<div class="flex flex-col">
			<span class="mb-1 text-xs font-bold lowercase text-sub opacity-60">actions</span>
			<span class="text-2xl font-bold text-text">{totalClicks}</span>
			<span class="text-[10px] text-sub opacity-50">{totalMines} mines</span>
		</div>

		<div class="flex flex-col">
			<span class="mb-1 text-xs font-bold lowercase text-sub opacity-60">consistency</span>
			<span class="text-2xl font-bold text-text">{consistency}%</span>
		</div>

		<div class="flex flex-col">
			<span class="mb-1 text-xs font-bold lowercase text-sub opacity-60">time</span>
			<span class="text-2xl font-bold text-text">{time}s</span>
		</div>
	</div>

	<div class="mt-2 flex items-center justify-center gap-6">
		<button
			type="button"
			class="flex items-center gap-2 rounded-lg bg-sub/10 px-5 py-2.5 text-xs font-bold text-sub transition-colors hover:bg-sub/20 hover:text-text"
			onclick={restart}
			title="Next Test (Tab)"
		>
			<RotateCcw size={15} />
			<span>next test</span>
			<kbd class="ml-1 rounded bg-sub/20 px-1.5 py-0.5 text-[10px] text-text">tab</kbd>
		</button>

		{#if finalGrid.length > 0}
			<button
				type="button"
				class="flex items-center gap-2 rounded-lg bg-sub/10 px-5 py-2.5 text-xs font-bold text-sub transition-colors hover:bg-main hover:text-bg"
				onclick={(e) => {
					e.stopPropagation();
					showMap = true;
				}}
				title="Inspect Board"
			>
				<Eye size={15} />
				<span>inspect board</span>
			</button>
		{/if}
	</div>
</div>
