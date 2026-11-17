<script lang="ts">
	import { Keyboard, Info, Github, Code2, Cpu } from 'lucide-svelte';
	import { currentTheme } from '$lib/themeStore.svelte';
	import Chart from 'chart.js/auto';
	import { CLEAR_TIME_DIFFICULTIES, formatClearDuration } from '$lib/clearTimeHistogram';

	let { data } = $props();

	// --- CHART ---
	let chartCanvas = $state<HTMLCanvasElement>();
	let selectedDifficulty = $state('9x9');

	const histogram = $derived(data.stats.clearTimeHistograms[selectedDifficulty]);
	const difficultyLabel = $derived(
		CLEAR_TIME_DIFFICULTIES.find((difficulty) => difficulty.setting === selectedDifficulty)!.label
	);
	const formatBinRange = (bin: { start: number; end: number | null }) =>
		bin.end === null
			? `${formatClearDuration(bin.start)} or longer`
			: `${formatClearDuration(bin.start)} to under ${formatClearDuration(bin.end)}`;

	$effect(() => {
		if (!chartCanvas || !histogram.total) return;
		const ctx = chartCanvas.getContext('2d');
		if (!ctx) return;

		const hasOverflow = histogram.bins.at(-1)?.end === null;
		const overflowPosition = histogram.cutoff + histogram.binSize * 1.5;
		const axisMax = histogram.cutoff + (hasOverflow ? histogram.binSize * 2 : 0);
		const points = histogram.bins.map((bin) => ({
			x: bin.end === null ? overflowPosition : bin.start + histogram.binSize / 2,
			y: bin.count
		}));

		const theme = currentTheme.value;
		const mainColor = `rgb(${theme.colors.main})`;
		const fillColor = `rgb(${theme.colors.main} / 0.8)`;
		const gridColor = `rgb(${theme.colors.sub} / 0.1)`;
		const textColor = `rgb(${theme.colors.text})`;
		const font = { family: 'JetBrains Mono, monospace', size: 10 };

		const chartInstance = new Chart<'bar', { x: number; y: number }[]>(ctx, {
			type: 'bar',
			data: {
				datasets: [
					{
						label: 'clears',
						data: points,
						borderColor: mainColor,
						backgroundColor: histogram.bins.map((bin) =>
							bin.end === null ? `rgb(${theme.colors.sub} / 0.35)` : fillColor
						),
						borderWidth: 1,
						borderRadius: 2,
						barPercentage: 0.9,
						categoryPercentage: 0.9
					}
				]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				animation: false,
				interaction: { intersect: false, mode: 'index' },
				layout: { padding: { top: 4, bottom: 4, left: 4, right: hasOverflow ? 48 : 4 } },
				plugins: {
					legend: { display: false },
					tooltip: {
						backgroundColor: `rgb(${theme.colors.bg} / 0.95)`,
						titleColor: textColor,
						bodyColor: `rgb(${theme.colors.text})`,
						borderColor: `rgb(${theme.colors.sub} / 0.2)`,
						borderWidth: 1,
						cornerRadius: 6,
						padding: 10,
						titleFont: { family: 'JetBrains Mono, monospace', size: 11 },
						bodyFont: { family: 'JetBrains Mono, monospace', size: 12 },
						displayColors: false,
						callbacks: {
							title: (items) => formatBinRange(histogram.bins[items[0].dataIndex]),
							afterBody: (items) =>
								histogram.bins[items[0].dataIndex].end === null
									? `longest clear: ${formatClearDuration(histogram.maxTime)}`
									: [],
							label: (item) => {
								const count = item.parsed.y ?? 0;
								return `${count.toLocaleString()} clears · ${((count / histogram.total) * 100).toFixed(1)}%`;
							}
						}
					}
				},
				scales: {
					x: {
						type: 'linear',
						min: 0,
						max: axisMax,
						offset: false,
						afterBuildTicks(scale) {
							const maxTicks = ctx.canvas.clientWidth < 480 ? 3 : 8;
							const targetStep = histogram.cutoff / maxTicks;
							const step =
								[1, 2, 5, 10, 15, 30, 60].find((value) => value >= targetStep) ??
								60 * Math.ceil(targetStep / 60);
							const ticks = [];
							for (let time = 0; time < histogram.cutoff; time += step) {
								ticks.push({ value: time });
							}
							if (hasOverflow) {
								const lastTick = ticks.at(-1);
								const availableWidth = Math.max(0, ctx.canvas.clientWidth - 100);
								if (
									lastTick &&
									ticks.length > 1 &&
									((overflowPosition - lastTick.value) / axisMax) * availableWidth < 55
								) {
									ticks.pop();
								}
								ticks.push({ value: overflowPosition });
							}
							scale.ticks = ticks;
						},
						ticks: {
							color: textColor,
							font,
							padding: 10,
							maxRotation: 0,
							autoSkip: false,
							callback: (value) =>
								hasOverflow && value === overflowPosition
									? `≥${formatClearDuration(histogram.cutoff)}`
									: Number(value) === 0 && histogram.cutoff >= 60
										? '0m'
										: Number(value) < 3600 && Number(value) % 60 === 0 && Number(value) > 0
											? `${Number(value) / 60}m`
											: formatClearDuration(Number(value))
						},
						title: { display: true, text: 'clear time', color: textColor, font },
						border: { display: false },
						grid: { color: gridColor, drawTicks: false, offset: false }
					},
					y: {
						beginAtZero: true,
						ticks: {
							color: textColor,
							font,
							padding: 10,
							precision: 0,
							maxTicksLimit: 5
						},
						title: { display: true, text: 'clears', color: textColor, font },
						border: { display: false },
						grid: { color: gridColor, drawTicks: false }
					}
				}
			}
		});

		return () => chartInstance?.destroy();
	});

	// --- FORMATTING ---
	const fmtCount = (n: number) => {
		if (n >= 1000000) return (n / 1000000).toFixed(1) + 'm';
		if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
		return n.toLocaleString();
	};

	const formatTime = (seconds: number) => {
		const hours = seconds / 3600;
		if (hours >= 1) return { val: hours.toFixed(1), unit: 'hours' };
		const mins = Math.floor(seconds / 60);
		if (mins >= 1) return { val: mins, unit: 'minutes' };
		return { val: seconds, unit: 'seconds' };
	};

	let timeObj = $derived(formatTime(data.stats.seconds));

	// --- CONTRIBUTORS FETCH ---
	type Contributor = { login: string; avatar_url: string; html_url: string };
	let contributors: Contributor[] = $derived(data.contributors || []);
</script>

<div
	class="relative flex min-h-screen flex-col items-center bg-bg p-8 font-mono text-text transition-colors duration-300"
>
	<!-- MAIN STATS SECTION -->
	<div class="animate-in fade-in w-full max-w-4xl duration-700">
		<!-- Summary Stats Grid -->
		<div class="mb-12 grid grid-cols-1 gap-12 text-center md:grid-cols-3">
			<!-- Total Boards Started -->
			<div class="flex flex-col gap-1">
				<span class="text-[10px] font-bold uppercase tracking-widest text-sub opacity-50"
					>global boards started</span
				>
				<span class="text-5xl font-black text-text">{fmtCount(data.stats.started)}</span>
			</div>

			<!-- Total Time Sweeping -->
			<div class="flex flex-col items-center gap-1">
				<span class="mb-2 text-[10px] font-bold uppercase tracking-widest text-sub opacity-50"
					>total time sweeping</span
				>
				<div class="flex flex-col items-center leading-none">
					<span class="text-6xl font-black text-main">{timeObj.val}</span>
					<span class="mt-2 text-xl font-bold text-sub">{timeObj.unit}</span>
				</div>
			</div>

			<!-- Total Boards Cleared -->
			<div class="flex flex-col gap-1">
				<span class="text-[10px] font-bold uppercase tracking-widest text-sub opacity-50"
					>global boards cleared</span
				>
				<span class="text-5xl font-black text-text">{fmtCount(data.stats.completed)}</span>
			</div>
		</div>

		<!-- CHART -->
		<figure class="mx-auto mb-12 w-full max-w-3xl" aria-labelledby="clear-times-title">
			<div class="mb-6 flex flex-wrap items-start justify-between gap-4">
				<div>
					<h2 id="clear-times-title" class="text-lg font-bold text-text">
						How long does a clear take?
					</h2>
					{#if !data.stats.historyUnavailable}
						<p class="mt-1 text-xs text-sub">
							Standard mode · {histogram.total.toLocaleString()} clears
						</p>
					{/if}
				</div>
				{#if histogram.total}
					<p class="text-sm text-sub">
						Median <span class="font-bold text-main">{formatClearDuration(histogram.median)}</span>
					</p>
				{/if}
			</div>
			<div class="mb-6 flex flex-col gap-2">
				<label for="clear-time-difficulty" class="text-xs text-sub">Difficulty</label>
				<select
					id="clear-time-difficulty"
					bind:value={selectedDifficulty}
					class="w-full rounded border border-sub/30 bg-bg px-3 py-2 text-sm text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-main sm:w-auto sm:self-start"
				>
					{#each CLEAR_TIME_DIFFICULTIES as difficulty (difficulty.setting)}
						<option value={difficulty.setting}>{difficulty.label}</option>
					{/each}
				</select>
			</div>
			{#if histogram.total}
				<div
					class="relative h-56 sm:h-64"
					role="img"
					aria-label={`Clear time distribution for ${difficultyLabel}. ${histogram.total.toLocaleString()} standard-mode wins. Median: ${formatClearDuration(histogram.median)}. Exact ranges and counts follow in the data table.`}
					aria-describedby="clear-times-caption"
				>
					<canvas bind:this={chartCanvas} aria-hidden="true"></canvas>
				</div>
				<div class="sr-only">
					<table class="mt-4 w-full text-left">
						<caption class="mb-3 text-left"
							>{difficultyLabel} · {histogram.total.toLocaleString()} clears</caption
						>
						<thead>
							<tr class="border-b border-sub/20 text-text">
								<th scope="col" class="py-2 pr-3">Clear time</th>
								<th scope="col" class="py-2 pr-3 text-right">Clears</th>
								<th scope="col" class="py-2 text-right">Share</th>
							</tr>
						</thead>
						<tbody>
							{#each histogram.bins as bin (bin.start)}
								<tr class="border-b border-sub/10">
									<th scope="row" class="py-2 pr-3 font-normal">{formatBinRange(bin)}</th>
									<td class="py-2 pr-3 text-right">{bin.count.toLocaleString()}</td>
									<td class="py-2 text-right"
										>{((bin.count / histogram.total) * 100).toFixed(1)}%</td
									>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
				<figcaption id="clear-times-caption" class="mt-3 text-xs leading-relaxed text-sub">
					{formatClearDuration(histogram.binSize)} intervals{#if histogram.bins.at(-1)?.end === null};
						clears ≥ {formatClearDuration(histogram.cutoff)} are grouped{/if}.
				</figcaption>
			{:else if data.stats.historyUnavailable}
				<p class="py-12 text-center text-sm text-sub">
					Clear times are unavailable right now. Try refreshing the page.
				</p>
			{:else}
				<p class="py-12 text-center text-sm text-sub">No clears for this difficulty yet.</p>
			{/if}
		</figure>

		<!-- INTRODUCTION -->
		<div class="mx-auto max-w-3xl space-y-20 text-sm leading-relaxed text-sub">
			<p class="mb-16 text-base text-sub">
				<span class="font-bold text-main">zsweep</span> is a minimalist, keyboard-driven Minesweeper focused
				on speed and consistency. Play using Vim-style controls, track your performance over time, and
				see your progress visualized after each session. Clear boards efficiently, reduce mistakes, and
				improve with practice.
			</p>

			<!-- PHILOSOPHY SECTION -->
			<section>
				<h2
					class="mb-6 flex items-center gap-3 text-lg font-black uppercase tracking-tight text-text"
				>
					<Info size={20} class="text-main" /> The Philosophy
				</h2>
				<p class="max-w-3xl text-base">
					Traditional Minesweeper clones rely heavily on mouse inputs, breaking the <span
						class="font-bold text-text">flow state</span
					>.
					<strong class="text-main">zsweep</strong> reimagines the classic logic puzzle as a
					keyboard-centric experience. By implementing Vim-style motions (<code>hjkl</code>,
					<code>w</code>, <code>b</code>, <code>e</code>, <code>ge</code>, <code>0</code>,
					<code>^</code>, <code>$</code>, <code>&#123;</code>, <code>&#125;</code>) and instant
					feedback, we aim to create the most efficient and satisfying sweeping engine for
					developers.
				</p>
			</section>

			<!-- The Stack -->
			<section>
				<h2
					class="mb-6 flex items-center gap-3 text-lg font-black uppercase tracking-tight text-text"
				>
					<Cpu size={20} class="text-main" /> The Stack
				</h2>
				<div class="grid grid-cols-2 gap-4 md:grid-cols-4">
					<div
						class="flex flex-col gap-2 rounded-lg border border-sub/10 bg-sub/5 p-4 transition-colors hover:border-main/30"
					>
						<span class="font-bold text-text">Svelte 5</span>
						<span class="text-xs">Powered by Runes for fine-grained reactivity.</span>
					</div>
					<div
						class="flex flex-col gap-2 rounded-lg border border-sub/10 bg-sub/5 p-4 transition-colors hover:border-main/30"
					>
						<span class="font-bold text-text">TypeScript</span>
						<span class="text-xs">Strict typing for game logic and state machines.</span>
					</div>
					<div
						class="flex flex-col gap-2 rounded-lg border border-sub/10 bg-sub/5 p-4 transition-colors hover:border-main/30"
					>
						<span class="font-bold text-text">Supabase</span>
						<span class="text-xs">Real-time auth and global leaderboards.</span>
					</div>
					<div
						class="flex flex-col gap-2 rounded-lg border border-sub/10 bg-sub/5 p-4 transition-colors hover:border-main/30"
					>
						<span class="font-bold text-text">Tailwind</span>
						<span class="text-xs">Utility-first styling for theming engine.</span>
					</div>
				</div>
			</section>

			<!-- Vim Grammar -->
			<section>
				<h2
					class="mb-6 flex items-center gap-3 text-lg font-black uppercase tracking-tight text-text"
				>
					<Keyboard size={20} class="text-main" /> Vim Grammar
				</h2>
				<div class="grid gap-x-12 gap-y-4 md:grid-cols-2">
					<div class="flex justify-between border-b border-sub/10 pb-2">
						<span>Movement</span>
						<span class="font-mono font-bold text-text">h j k l</span>
					</div>
					<div class="flex justify-between border-b border-sub/10 pb-2">
						<span>Unrevealed Words (Start / End)</span>
						<span class="font-mono font-bold text-text">w / b / e / ge</span>
					</div>
					<div class="flex justify-between border-b border-sub/10 pb-2">
						<span>Frontier Clues (Jump Numbers)</span>
						<span class="font-mono font-bold text-text">W / B / E</span>
					</div>
					<div class="flex justify-between border-b border-sub/10 pb-2">
						<span>Row Bounds & Anchors</span>
						<span class="font-mono font-bold text-text">0 / ^ / $ / g_ / gm</span>
					</div>
					<div class="flex justify-between border-b border-sub/10 pb-2">
						<span>Vertical Anchors</span>
						<span class="font-mono font-bold text-text">gg / G / H / M / L</span>
					</div>
					<div class="flex justify-between border-b border-sub/10 pb-2">
						<span>Flag / Reveal Operators</span>
						<span class="font-mono font-bold text-text">d / c / x / Space / Enter</span>
					</div>
					<div class="flex justify-between border-b border-sub/10 pb-2">
						<span>Search Number</span>
						<span class="font-mono font-bold text-text">/ [0-8] (n / N)</span>
					</div>
					<div class="flex justify-between border-b border-sub/10 pb-2">
						<span>Restart / Command Palette</span>
						<span class="font-mono font-bold text-text">Tab / Esc</span>
					</div>
				</div>
			</section>

			<!-- OPEN SOURCE & CONTRIBUTORS -->
			<section class="mb-16">
				<h2 class="mb-4 flex items-center gap-2 text-lg font-bold uppercase text-text">
					<svg
						class="h-5 w-5 text-main"
						xmlns="http://www.w3.org/2000/svg"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M12 4v16m8-8H4"
						/>
					</svg>
					Contributors
				</h2>

				<p class="mb-6 text-center text-sm text-sub">
					Every contribution, from code to ideas, helps make <span class="font-bold text-main"
						>zsweep</span
					> better.
				</p>

				<div
					class="grid grid-cols-2 justify-items-center gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6"
				>
					{#each contributors as c (c.login)}
						<a
							href={`https://github.com/${c.login}`}
							target="_blank"
							class="flex flex-col items-center text-xs text-sub hover:text-main"
						>
							<img
								src={c.avatar_url}
								alt={c.login}
								class="h-10 w-10 rounded-full border border-sub/20 object-cover"
							/>
							<span class="max-w-[60px] truncate text-center">{c.login}</span>
						</a>
					{/each}

					<div class="flex flex-col items-center text-xs text-sub">
						<div
							class="flex h-10 w-10 items-center justify-center rounded-full border border-main/30 bg-main/5 text-[10px] font-bold text-main"
							title="Logo Designer"
						>
							AY
						</div>
						<span class="max-w-[60px] truncate text-center">Ahmed Yusuf</span>
						<span class="text-[8px] uppercase tracking-tighter opacity-50">Logo</span>
					</div>
				</div>

				<div class="mt-20 border-t border-sub/10 pt-12">
					<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
						<a
							href="https://github.com/xguot/zsweep"
							target="_blank"
							class="group flex items-center justify-center gap-3 rounded-lg border border-sub/20 bg-sub/5 px-6 py-4 text-text transition-all hover:border-main hover:bg-sub/10"
						>
							<Github size={20} class="transition-transform group-hover:scale-110" />
							<div class="flex flex-col items-start">
								<span class="font-bold">GitHub Repository</span>
								<span class="text-xs text-sub group-hover:text-main">Star, Fork, & Contribute</span>
							</div>
						</a>
						<a
							href="https://github.com/xguot/zsweep/issues"
							target="_blank"
							class="group flex items-center justify-center gap-3 rounded-lg border border-sub/20 bg-sub/5 px-6 py-4 text-text transition-all hover:border-main hover:bg-sub/10"
						>
							<Code2 size={20} class="transition-transform group-hover:scale-110" />
							<div class="flex flex-col items-start">
								<span class="font-bold">View Roadmap</span>
								<span class="text-xs text-sub group-hover:text-main">Help us build v1.1</span>
							</div>
						</a>
					</div>
				</div>
			</section>
		</div>
	</div>
</div>
