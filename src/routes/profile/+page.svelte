<script lang="ts">
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { supabase } from '$lib/supabase';
	import { User, Calendar, Clock, Download, Activity, Zap } from 'lucide-svelte';

	interface Profile {
		id: string;
		username: string;
		avatar_url: string;
		created_at: string;
	}

	interface GameResult {
		id: string;
		mode: string;
		setting: string;
		win: boolean;
		time: number;
		grids?: number;
		total_mines?: number;
		accuracy: number;
		created_at: string;
	}

	const safeNum = (val: unknown) => {
		if (val === null || val === undefined) return 0;
		const n = Number(val);
		return isNaN(n) ? 0 : n;
	};

	let ui = $state({
		loading: true
	});

	let dataState = $state({
		profile: null as Profile | null,
		history: [] as GameResult[],
		currentUser: null as string | null,
		bests: [] as {
			label: string;
			score: number;
			acc: number;
			mode: string;
			date: string;
		}[],
		bestMinesPerMin: {} as Record<string, { value: number; date: string }>,
		heatmapData: [] as { date: string; count: number; intensity: number }[]
	});

	let stats = $state({
		started: 0,
		completed: 0,
		timeSweeping: '00:00:00',
		totalMinesSwept: 0,
		completionRate: 0
	});

	function calculateStats(data: GameResult[]) {
		const newStats = {
			started: data.length,
			completed: data.filter((g) => g.win).length,
			timeSweeping: '00:00:00',
			totalMinesSwept: 0,
			completionRate: 0
		};

		newStats.completionRate =
			newStats.started > 0 ? Math.round((newStats.completed / newStats.started) * 100) : 0;

		let totalSeconds = 0;
		let minesSweptCount = 0;

		const groups: Record<string, any> = {};
		const calculatedBests: Record<string, { value: number; date: string }> = {};

		const standardCategories = ['15', '30', '60', '120', '9x9', '16x16', '30x16'];
		standardCategories.forEach((c) => (calculatedBests[c] = { value: 0, date: '' }));

		data.forEach((g) => {
			let timeTaken = safeNum(g.time || (g.mode === 'time' ? parseInt(g.setting) || 15 : 0));
			totalSeconds += timeTaken;

			let mines = safeNum(g.total_mines);
			if (mines === 0) {
				const lookup: Record<string, number> = { '9x9': 10, '16x16': 40, '30x16': 99 };
				mines = g.mode === 'standard' ? lookup[g.setting] || 10 : safeNum(g.grids) * 10;
			}

			if (g.win) {
				minesSweptCount += mines;

				if (timeTaken > 0) {
					const minesPerMin = parseFloat(((mines / timeTaken) * 60).toFixed(1));
					const cat = g.setting;

					if (!calculatedBests[cat] || minesPerMin > calculatedBests[cat].value) {
						calculatedBests[cat] = {
							value: minesPerMin,
							date: g.created_at
						};
					}
				}

				const key = `${g.mode === 'time' ? 'Time' : 'Std'} ${g.setting}`;
				const scoreValue = g.mode === 'time' ? safeNum(g.grids) : safeNum(g.time) || 9999;

				if (
					!groups[key] ||
					(g.mode === 'time' ? scoreValue > groups[key].score : scoreValue < groups[key].score)
				) {
					groups[key] = {
						label: key,
						score: scoreValue,
						acc: g.accuracy,
						mode: g.mode,
						date: g.created_at
					};
				}
			}
		});

		newStats.totalMinesSwept = minesSweptCount;

		const safeTotal = safeNum(totalSeconds);
		const h = Math.floor(safeTotal / 3600)
			.toString()
			.padStart(2, '0');
		const m = Math.floor((safeTotal % 3600) / 60)
			.toString()
			.padStart(2, '0');
		const s = (safeTotal % 60).toString().padStart(2, '0');
		newStats.timeSweeping = `${h}:${m}:${s}`;

		return {
			stats: newStats,
			bests: Object.values(groups),
			bestMinesPerMin: calculatedBests
		};
	}

	function generateHeatmap(data: GameResult[]) {
		const today = new Date();
		const days = [];
		for (let i = 364; i >= 0; i--) {
			const d = new Date();
			d.setDate(today.getDate() - i);
			const dateStr = d.toISOString().split('T')[0];
			const count = data.filter((g) => g.created_at.startsWith(dateStr)).length;
			let intensity = count > 10 ? 4 : count > 5 ? 3 : count > 2 ? 2 : count > 0 ? 1 : 0;
			days.push({ date: dateStr, count, intensity });
		}
		dataState.heatmapData = days;
	}

	$effect(() => {
		let cancelled = false;

		(async () => {
			try {
				const { data: authData, error: authErr } = await supabase.auth.getUser();
				if (authErr) throw authErr;

				const user = authData?.user;
				if (!user) {
					goto(`${base}/login`);
					return;
				}

				const { data: p, error: pErr } = await supabase
					.from('profiles')
					.select('*')
					.eq('id', user.id)
					.single();

				if (pErr) throw pErr;

				const { data: r, error: rErr } = await supabase
					.from('game_results')
					.select('*')
					.eq('user_id', user.id)
					.order('created_at', { ascending: false });

				if (rErr) throw rErr;

				dataState.profile = p;
				dataState.currentUser = p?.username;

				if (r && r.length > 0) {
					dataState.history = r;

					const calculated = calculateStats(r);
					stats = calculated.stats;
					dataState.bests = calculated.bests;
					dataState.bestMinesPerMin = calculated.bestMinesPerMin;

					generateHeatmap(r);
				} else {
					dataState.history = [];
				}

				if (cancelled) return;
			} catch (err) {
				console.error('onMount load failed:', err);
			} finally {
				if (!cancelled) {
					ui.loading = false;
				}
			}
		})();

		return () => {
			cancelled = true;
		};
	});
</script>

<div
	class="relative flex min-h-screen flex-col items-center bg-bg font-mono text-text transition-colors duration-300"
>
	{#if ui.loading}
		<div class="mt-20 animate-pulse text-sub">loading profile...</div>
	{:else}
		<div class="flex w-full max-w-5xl flex-col px-8 pb-32">
			<div
				class="animate-in fade-in mb-8 flex w-full flex-col items-stretch justify-between gap-8 rounded-lg border border-sub/10 bg-sub/5 p-8 delay-75 duration-500 md:flex-row"
			>
				<div class="flex items-center gap-6">
					<div
						class="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-sub/20"
					>
						{#if dataState.profile?.avatar_url}
							<img
								src={dataState.profile.avatar_url}
								alt="avatar"
								class="h-full w-full object-cover"
							/>
						{:else}
							<User size={48} class="text-sub" />
						{/if}
					</div>
					<div class="flex flex-col">
						<h1 class="text-3xl font-bold text-text">
							{dataState.profile?.username || 'Guest'}
						</h1>
						<div class="mt-2 flex items-center gap-2 text-xs font-bold text-sub">
							<Calendar size={12} /> Joined {new Date(
								dataState.profile?.created_at
							).toLocaleDateString()}
						</div>
						<div class="mt-6 flex gap-8">
							<div>
								<div class="text-[10px] font-bold uppercase text-sub opacity-70">started</div>
								<div class="text-xl font-bold text-text">{stats.started}</div>
							</div>
							<div>
								<div class="text-[10px] font-bold uppercase text-sub opacity-70">completed</div>
								<div class="text-xl font-bold text-text">
									{stats.completed}
									<span class="text-xs font-normal text-sub">({stats.completionRate}%)</span>
								</div>
							</div>
							<div>
								<div class="text-[10px] font-bold uppercase text-sub opacity-70">time sweeping</div>
								<div class="text-xl font-bold text-text">{stats.timeSweeping}</div>
							</div>
						</div>
					</div>
				</div>
				<div
					class="flex flex-col items-end justify-center border-l border-sub/10 pl-8 text-right md:pl-16"
				>
					<span class="mb-2 text-xs font-bold uppercase tracking-widest text-sub"
						>estimated mines swept</span
					>
					<span class="text-7xl font-bold leading-none text-main">{stats.totalMinesSwept}</span>
				</div>
			</div>

			<div class="animate-in fade-in mb-8 w-full delay-150 duration-500">
				<h3 class="mb-2 flex items-center gap-2 text-xs font-bold uppercase text-sub opacity-70">
					<Zap size={14} /> Best Mines/min
				</h3>
				<div class="grid w-full grid-cols-3 gap-4">
					{#each ['9x9', '16x16', '30x16'] as size (size)}
						<div class="flex flex-col items-start rounded-lg border border-sub/10 bg-sub/5 p-4">
							<div class="mb-1 text-[10px] font-bold uppercase text-sub opacity-70">
								{size} Standard
							</div>
							<div class="text-2xl font-bold leading-none text-text">
								{dataState.bestMinesPerMin[size]?.value || '-'}
							</div>
							<div class="mt-1 text-[10px] text-sub opacity-50">
								{dataState.bestMinesPerMin[size]?.date
									? new Date(dataState.bestMinesPerMin[size].date).toLocaleDateString()
									: 'N/A'}
							</div>
						</div>
					{/each}
				</div>
			</div>

			<div class="animate-in fade-in mb-8 w-full delay-150 duration-500">
				<div class="mb-2 flex items-center justify-between px-1">
					<div class="flex items-center gap-4">
						<select
							class="cursor-pointer rounded border-none bg-sub/10 px-2 py-1 text-xs font-bold text-sub outline-none"
						>
							<option>last 12 months</option>
						</select>
						<span class="text-xs text-sub opacity-50">{stats.started} tests</span>
					</div>
					<div class="flex items-center gap-1 text-[10px] text-sub">
						<span>less</span>
						{#each [0.1, 0.25, 0.5, 0.8, 1] as op (op)}
							<div
								class="h-2 w-2 rounded-sm"
								style="background-color: rgba(var(--main) / {op})"
							></div>
						{/each}
						<span>more</span>
					</div>
				</div>

				<div
					class="scrollbar-hide ml-8 flex gap-[3px] overflow-x-auto rounded-lg border border-sub/10 bg-sub/5 p-6"
				>
					{#each Array(53), w (w)}
						<div class="flex flex-col gap-[3px]">
							{#each Array(7), d (d)}
								{@const day = dataState.heatmapData[w * 7 + d]}
								{#if day}
									<div
										class="group relative h-3 w-3 rounded-[2px]"
										style="background-color: {day.intensity === 0
											? 'rgba(var(--sub) / 0.1)'
											: `rgba(var(--main) / ${day.intensity * 0.25})`}"
									>
										<div
											class="pointer-events-none absolute bottom-full left-1/2 mb-2 w-max -translate-x-1/2 rounded bg-black px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100"
										>
											{day.count} tests on {day.date}
										</div>
									</div>
								{/if}
							{/each}
						</div>
					{/each}
				</div>
			</div>

			<div class="animate-in fade-in w-full delay-200 duration-500">
				<div class="mb-4 flex items-end justify-between">
					<h3 class="flex items-center gap-2 text-xs font-bold uppercase text-sub opacity-70">
						<Clock size={14} /> Sweep History
					</h3>
					<button
						class="flex items-center gap-1 rounded bg-sub/10 px-2 py-1 text-xs font-bold text-sub transition-colors hover:text-text"
					>
						<Download size={12} /> Export CSV
					</button>
				</div>
				<div class="w-full overflow-hidden rounded-lg border border-sub/10 bg-sub/5">
					<table class="w-full border-collapse text-left text-sm">
						<thead class="bg-sub/10 text-[10px] font-bold uppercase tracking-wider text-sub">
							<tr
								><th class="p-4">Mode</th><th class="p-4">Info</th><th class="p-4">Result</th><th
									class="p-4">Score</th
								><th class="p-4">Accuracy</th><th class="p-4 text-right">Date</th></tr
							>
						</thead>
						<tbody class="divide-y divide-sub/5 text-xs">
							{#each dataState.history.slice(0, 10) as row (row.id)}
								<tr class="transition-colors hover:bg-sub/5">
									<td class="flex items-center gap-2 p-4 font-bold text-text"
										><Activity size={12} class="text-sub opacity-50" />{row.mode}</td
									>
									<td class="p-4 font-medium text-sub">{row.setting}</td>
									<td class="p-4"
										><span class={row.win ? 'font-bold text-main' : 'text-sub opacity-50'}
											>{row.win ? 'Win' : 'Fail'}</span
										></td
									>
									<td class="p-4 font-mono text-sm text-text"
										>{row.mode === 'time' ? row.grids : row.time}<span
											class="ml-1 text-[10px] text-sub opacity-50"
											>{row.mode === 'time' ? 'grids' : 's'}</span
										></td
									>
									<td class="p-4 font-mono text-text">{row.accuracy}%</td>
									<td class="p-4 text-right font-medium text-sub opacity-70"
										>{new Date(row.created_at).toLocaleString()}</td
									>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		</div>
	{/if}
</div>
