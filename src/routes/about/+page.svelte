<script lang="ts">
	import { Keyboard, Info, Github, Code2, GitPullRequest, Cpu } from 'lucide-svelte';

	// --- THEME / NAVIGATION ---
	import { currentTheme } from '$lib/themeStore'; // Light/dark theme state

	// --- SVELTE / THIRD-PARTY ---
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabase'; // Auth + DB
	import Chart from 'chart.js/auto';

	export let data;

	// --- USER STATE ---

	// --- CHART ---
	let chartCanvas: HTMLCanvasElement;
	let chartInstance: Chart;

	const createHistogram = (dataPoints: number[], binSize = 10) => {
		if (dataPoints.length === 0) return { labels: [], counts: [] };

		const min = Math.floor(Math.min(...dataPoints) / binSize) * binSize;
		const max = Math.ceil(Math.max(...dataPoints) / binSize) * binSize;

		const bins: Record<string, number> = {};
		for (let i = min; i < max; i += binSize) {
			bins[`${i}-${i + binSize}`] = 0;
		}

		dataPoints.forEach((val) => {
			const bucket = Math.floor(val / binSize) * binSize;
			const key = `${bucket}-${bucket + binSize}`;
			if (bins[key] !== undefined) bins[key]++;
		});

		return {
			labels: Object.keys(bins),
			counts: Object.values(bins)
		};
	};

	onMount(() => {
		const ctx = chartCanvas.getContext('2d');
		if (!ctx) return;

		const rawData = data.stats.game_results || [];

		const validTimes = rawData
			.filter((g: any) => g.win === true && g.mode === 'standard')
			.map((g: any) => g.time);

		const { labels, counts } = createHistogram(validTimes, 10);

		const mainColor = $currentTheme ? `rgb(${$currentTheme.colors.main})` : '#64b5f6';
		const gridColor = $currentTheme ? `rgba(${$currentTheme.colors.text}, 0.1)` : '#333';
		const textColor = $currentTheme ? `rgb(${$currentTheme.colors.sub})` : '#888';

		chartInstance = new Chart(ctx, {
			type: 'bar',
			data: {
				labels: labels,
				datasets: [
					{
						label: 'Games Completed',
						data: counts,
						backgroundColor: mainColor,
						borderRadius: 2,
						barPercentage: 0.9,
						categoryPercentage: 0.9
					}
				]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				plugins: { legend: { display: false } },
				scales: {
					x: {
						ticks: { color: textColor, font: { family: 'monospace', size: 10 } },
						grid: { display: false }
					},
					y: {
						beginAtZero: true,
						ticks: { color: textColor, font: { family: 'monospace', size: 10 } },
						grid: { color: gridColor }
					}
				}
			}
		});

		return () => chartInstance.destroy();
	});

	$: if (chartInstance && $currentTheme) {
		const newColor = `rgb(${$currentTheme.colors.main})`;
		const newGrid = `rgba(${$currentTheme.colors.text}, 0.1)`;
		const newText = `rgb(${$currentTheme.colors.sub})`;

		chartInstance.data.datasets[0].backgroundColor = newColor;
		chartInstance.options.scales!.x!.ticks!.color = newText;
		chartInstance.options.scales!.y!.ticks!.color = newText;
		chartInstance.options.scales!.y!.grid!.color = newGrid;
		chartInstance.update();
	}

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

	$: timeObj = formatTime(data.stats.seconds);

	// --- AUTHENTICATION ---
	onMount(() => {
		supabase.auth.getSession().then(({ data: { session } }) => {
			if (session?.user) {
				currentUser =
					session.user.user_metadata.full_name || session.user.email?.split('@')[0];
			}
		});

		const {
			data: { subscription }
		} = supabase.auth.onAuthStateChange((_event, session) => {
			currentUser = session?.user
				? session.user.user_metadata.full_name || session.user.email?.split('@')[0]
				: null;
		});

		return () => subscription.unsubscribe();
	});

	async function handleLogout() {
		await supabase.auth.signOut();
		currentUser = null;
	}

	// --- CONTRIBUTORS FETCH ---
	type Contributor = { login: string; avatar_url: string; html_url: string };
	let contributors: Contributor[] = [];
	const GITHUB_TOKEN = ''; // Optional token to avoid rate limits

	onMount(async () => {
		try {
			const headers: Record<string, string> = {};
			if (GITHUB_TOKEN) headers['Authorization'] = `token ${GITHUB_TOKEN}`;

			const res = await fetch('https://api.github.com/repos/oug-t/zsweep/contributors', {
				headers
			});
			if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
			contributors = await res.json();
		} catch (err) {
			console.error('Failed to fetch contributors', err);
			contributors = [];
		}
	});
</script>

<div
	class="relative flex min-h-screen flex-col items-center bg-bg p-8 font-mono text-text transition-colors duration-300"
>
	<!-- MAIN STATS SECTION -->
	<div class="animate-in fade-in w-full max-w-4xl duration-700">
		<!-- Summary Stats Grid -->
		<div class="mb-20 grid grid-cols-1 gap-12 text-center md:grid-cols-3">
			<!-- Total Boards Started -->
			<div class="flex flex-col gap-1">
				<span class="text-[10px] font-bold uppercase tracking-widest text-sub opacity-50"
					>global boards started</span
				>
				<span class="text-5xl font-black text-text">{fmtCount(data.stats.started)}</span>
			</div>

			<!-- Total Time Sweeping -->
			<div class="flex flex-col items-center gap-1">
				<span
					class="mb-2 text-[10px] font-bold uppercase tracking-widest text-sub opacity-50"
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
		<div class="mx-auto my-6 max-w-md" style="height: 200px;">
			<canvas bind:this={chartCanvas}></canvas>
		</div>

		<!-- INTRODUCTION -->
		<div class="space-y-20 text-sm leading-relaxed text-sub">
			<p class="mb-16 max-w-2xl text-base text-sub">
				<span class="font-bold text-main">zsweep</span> is a minimalist, keyboard-driven Minesweeper
				focused on speed and consistency. Play using Vim-style controls, track your performance
				over time, and see your progress visualized after each session. Clear boards efficiently,
				reduce mistakes, and improve with practice.
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
					<strong class="text-main">zsweep</strong> reimagines the classic logic puzzle as
					a keyboard-centric experience. By implementing Vim-style motions (`hjkl`, `w`,
					`b`, `{'{'}`, `{'}'}`) and instant feedback, we aim to create the most efficient
					and satisfying sweeping engine for developers.
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
						<span class="text-xs">Strict typing for game logic and state machines.</span
						>
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
						<span>Jump Words (Skip Open)</span>
						<span class="font-mono font-bold text-text">w / b</span>
					</div>
					<div class="flex justify-between border-b border-sub/10 pb-2">
						<span>Search Number</span>
						<span class="font-mono font-bold text-text">/ [1-8]</span>
					</div>
					<div class="flex justify-between border-b border-sub/10 pb-2">
						<span>Flag / Reveal</span>
						<span class="font-mono font-bold text-text">Space / Enter</span>
					</div>
					<div class="flex justify-between border-b border-sub/10 pb-2">
						<span>Restart</span>
						<span class="font-mono font-bold text-text">Tab</span>
					</div>
					<div class="flex justify-between border-b border-sub/10 pb-2">
						<span>Command Palette</span>
						<span class="font-mono font-bold text-text">Esc</span>
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
					Every contribution, from code to ideas, helps make <span
						class="font-bold text-main">zsweep</span
					> better.
				</p>

				<div
					class="grid grid-cols-2 justify-items-center gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6"
				>
					{#each contributors as c (c.login)}
						<a
							href={c.html_url}
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
							href="https://github.com/oug-t/zsweep"
							target="_blank"
							class="group flex items-center justify-center gap-3 rounded-lg border border-sub/20 bg-sub/5 px-6 py-4 text-text transition-all hover:border-main hover:bg-sub/10"
						>
							<Github size={20} class="transition-transform group-hover:scale-110" />
							<div class="flex flex-col items-start">
								<span class="font-bold">GitHub Repository</span>
								<span class="text-xs text-sub group-hover:text-main"
									>Star, Fork, & Contribute</span
								>
							</div>
						</a>
						<a
							href="https://github.com/oug-t/zsweep/issues"
							target="_blank"
							class="group flex items-center justify-center gap-3 rounded-lg border border-sub/20 bg-sub/5 px-6 py-4 text-text transition-all hover:border-main hover:bg-sub/10"
						>
							<Code2 size={20} class="transition-transform group-hover:scale-110" />
							<div class="flex flex-col items-start">
								<span class="font-bold">View Roadmap</span>
								<span class="text-xs text-sub group-hover:text-main"
									>Help us build v1.1</span
								>
							</div>
						</a>
					</div>
				</div>
			</section>
		</div>
	</div>
</div>
