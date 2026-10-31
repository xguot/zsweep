<script lang="ts">
	import {
		supabase,
		ensureUserProfile,
		getLocalGameResults,
		type StoredGameResult
	} from '$lib/supabase';
	import { User, Calendar, Clock, Download, Hourglass, Grid3x3, Flame, LogIn } from 'lucide-svelte';
	import { SvelteDate } from 'svelte/reactivity';

	interface Profile {
		id: string;
		username: string;
		avatar_url: string;
		created_at: string;
	}

	interface PersonalBestEntry {
		primary: string;
		secondary: string;
		acc: number;
		date: string;
		hasRecord: boolean;
	}

	const safeNum = (val: unknown) => {
		if (val === null || val === undefined) return 0;
		const n = Number(val);
		return isNaN(n) ? 0 : n;
	};

	const TIME_SETTINGS = ['15', '30', '60'] as const;
	const STD_SETTINGS = ['9x9', '16x16', '30x16'] as const;
	const MONTHS = [
		'jan',
		'feb',
		'mar',
		'apr',
		'may',
		'jun',
		'jul',
		'aug',
		'sep',
		'oct',
		'nov',
		'dec'
	];
	const HEATMAP_WEEKS = Array.from({ length: 52 }, (_, i) => i);
	const WEEK_DAYS = [0, 1, 2, 3, 4, 5, 6];

	let ui = $state({
		loading: true,
		isGuest: false,
		modeFilter: 'all' as 'all' | 'standard' | 'time',
		visibleRows: 15
	});

	let dataState = $state({
		profile: null as Profile | null,
		history: [] as StoredGameResult[],
		timeBests: {} as Record<string, PersonalBestEntry>,
		stdBests: {} as Record<string, PersonalBestEntry>,
		heatmapData: [] as { date: string; count: number; intensity: number; monthLabel?: string }[]
	});

	let stats = $state({
		started: 0,
		completed: 0,
		timeSweeping: '00:00:00',
		totalMinesSwept: 0,
		completionRate: 0,
		avgAccuracy: 0,
		currentStreak: 0
	});

	interface RawGameRow {
		id?: string;
		user_id?: string | null;
		mode?: string;
		setting?: string;
		win?: boolean;
		time?: number;
		grids?: number;
		total_mines?: number;
		accuracy?: number;
		three_bv?: number;
		three_bv_per_sec?: number;
		created_at?: string;
	}

	function normalizeRecord(g: RawGameRow): StoredGameResult {
		const rawMode = String(g.mode || 'standard').toLowerCase();
		const mode = rawMode === 'time' || rawMode === 'speed' ? 'time' : 'standard';

		let setting = String(g.setting || '9x9');
		if (setting === 'beginner') setting = mode === 'time' ? '15' : '9x9';
		else if (setting === 'intermediate') setting = mode === 'time' ? '30' : '16x16';
		else if (setting === 'expert') setting = mode === 'time' ? '60' : '30x16';

		const lookupMines: Record<string, number> = { '9x9': 10, '16x16': 40, '30x16': 99 };
		const grids = safeNum(g.grids) || (g.win && mode === 'standard' ? 1 : 0);
		let totalMines = safeNum(g.total_mines);
		if (totalMines === 0 && g.win) {
			totalMines = mode === 'standard' ? lookupMines[setting] || 10 : grids * 10;
		}

		return {
			id: g.id || `${g.created_at}-${Math.random()}`,
			user_id: g.user_id || null,
			mode,
			setting,
			win: Boolean(g.win),
			time: Math.max(1, safeNum(g.time || (mode === 'time' ? parseInt(setting, 10) || 15 : 1))),
			grids,
			total_mines: totalMines,
			accuracy: safeNum(g.accuracy),
			three_bv: safeNum(g.three_bv),
			three_bv_per_sec: safeNum(g.three_bv_per_sec),
			created_at: g.created_at || new Date().toISOString()
		};
	}

	function calculateStats(rawList: StoredGameResult[]) {
		const list = rawList.map(normalizeRecord);
		const wins = list.filter((g) => g.win);

		const started = list.length;
		const completed = wins.length;
		const completionRate = started > 0 ? Math.round((completed / started) * 100) : 0;
		const avgAccuracy =
			started > 0 ? Math.round(list.reduce((sum, g) => sum + g.accuracy, 0) / started) : 0;

		let totalSeconds = 0;
		let minesSweptCount = 0;

		const timeBests: Record<string, PersonalBestEntry> = {};
		const stdBests: Record<string, PersonalBestEntry> = {};

		TIME_SETTINGS.forEach((t) => {
			timeBests[t] = { primary: '-', secondary: '-', acc: 0, date: '', hasRecord: false };
		});
		STD_SETTINGS.forEach((s) => {
			stdBests[s] = { primary: '-', secondary: '-', acc: 0, date: '', hasRecord: false };
		});

		const bestTimeNumeric: Record<string, number> = {};
		const bestStdNumeric: Record<string, number> = {};

		list.forEach((g) => {
			totalSeconds += g.time;

			if (g.win) {
				minesSweptCount += g.total_mines;
				const mpm = parseFloat(((g.total_mines / Math.max(1, g.time)) * 60).toFixed(1));

				if (
					g.mode === 'time' &&
					TIME_SETTINGS.includes(g.setting as (typeof TIME_SETTINGS)[number])
				) {
					const gridsCleared = g.grids;
					if (
						bestTimeNumeric[g.setting] === undefined ||
						gridsCleared > bestTimeNumeric[g.setting]
					) {
						bestTimeNumeric[g.setting] = gridsCleared;
						timeBests[g.setting] = {
							primary: `${gridsCleared}`,
							secondary: `${mpm} mpm`,
							acc: g.accuracy,
							date: g.created_at,
							hasRecord: true
						};
					}
				} else if (
					g.mode === 'standard' &&
					STD_SETTINGS.includes(g.setting as (typeof STD_SETTINGS)[number])
				) {
					const clearTime = g.time;
					if (bestStdNumeric[g.setting] === undefined || clearTime < bestStdNumeric[g.setting]) {
						bestStdNumeric[g.setting] = clearTime;
						stdBests[g.setting] = {
							primary: `${clearTime}s`,
							secondary: `${mpm} mpm`,
							acc: g.accuracy,
							date: g.created_at,
							hasRecord: true
						};
					}
				}
			}
		});

		const h = Math.floor(totalSeconds / 3600)
			.toString()
			.padStart(2, '0');
		const m = Math.floor((totalSeconds % 3600) / 60)
			.toString()
			.padStart(2, '0');
		const s = (totalSeconds % 60).toString().padStart(2, '0');

		// Calculate active daily streak
		const uniqueDates = new Set(list.map((g) => g.created_at.split('T')[0]));
		let streak = 0;
		const cursorDate = new SvelteDate();
		for (let i = 0; i < 365; i++) {
			const dStr = cursorDate.toISOString().split('T')[0];
			if (uniqueDates.has(dStr)) {
				streak++;
			} else if (i > 0) {
				break;
			}
			cursorDate.setDate(cursorDate.getDate() - 1);
		}

		return {
			normalizedHistory: list,
			stats: {
				started,
				completed,
				timeSweeping: `${h}:${m}:${s}`,
				totalMinesSwept: minesSweptCount,
				completionRate,
				avgAccuracy,
				currentStreak: streak
			},
			timeBests,
			stdBests
		};
	}

	function generateHeatmap(list: StoredGameResult[]) {
		const today = new SvelteDate();
		const days: { date: string; count: number; intensity: number; monthLabel?: string }[] = [];
		const countsByDate: Record<string, number> = {};

		for (const g of list) {
			const dateKey = g.created_at.split('T')[0];
			countsByDate[dateKey] = (countsByDate[dateKey] || 0) + 1;
		}

		let lastMonth = -1;
		for (let i = 363; i >= 0; i--) {
			const d = new SvelteDate(today);
			d.setDate(today.getDate() - i);
			const dateStr = d.toISOString().split('T')[0];
			const count = countsByDate[dateStr] || 0;
			const intensity = count > 10 ? 4 : count > 5 ? 3 : count > 2 ? 2 : count > 0 ? 1 : 0;
			const m = d.getMonth();
			const monthLabel = d.getDay() === 0 && m !== lastMonth ? MONTHS[m] : undefined;
			if (monthLabel) lastMonth = m;
			days.push({ date: dateStr, count, intensity, monthLabel });
		}
		dataState.heatmapData = days;
	}

	let filteredHistory = $derived(
		dataState.history.filter((row) => (ui.modeFilter === 'all' ? true : row.mode === ui.modeFilter))
	);

	function exportCsv() {
		if (dataState.history.length === 0) return;
		const headers = [
			'id',
			'mode',
			'setting',
			'win',
			'time_sec',
			'grids',
			'total_mines',
			'accuracy',
			'created_at'
		];
		const rows = dataState.history.map((r) => [
			r.id,
			r.mode,
			r.setting,
			r.win,
			r.time,
			r.grids,
			r.total_mines,
			r.accuracy,
			r.created_at
		]);
		const csvContent =
			'data:text/csv;charset=utf-8,' +
			[headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
		const encodedUri = encodeURI(csvContent);
		const link = document.createElement('a');
		link.setAttribute('href', encodedUri);
		link.setAttribute('download', `zsweep-history-${new Date().toISOString().split('T')[0]}.csv`);
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
	}

	$effect(() => {
		let cancelled = false;

		(async () => {
			try {
				const localHistory = getLocalGameResults();
				const { data: authData } = await supabase.auth.getUser();
				const user = authData?.user;

				if (!user) {
					ui.isGuest = true;
					dataState.profile = {
						id: 'local',
						username: 'local sweeper',
						avatar_url: '',
						created_at: localHistory.at(-1)?.created_at || new Date().toISOString()
					};
					const calculated = calculateStats(localHistory);
					dataState.history = calculated.normalizedHistory;
					stats = calculated.stats;
					dataState.timeBests = calculated.timeBests;
					dataState.stdBests = calculated.stdBests;
					generateHeatmap(calculated.normalizedHistory);
					return;
				}

				ui.isGuest = false;
				const profile = await ensureUserProfile(user);
				dataState.profile = profile;

				const { data: remoteRows } = await supabase
					.from('game_results')
					.select('*')
					.eq('user_id', user.id)
					.order('created_at', { ascending: false });

				const combined = remoteRows && remoteRows.length > 0 ? remoteRows : localHistory;

				if (cancelled) return;

				const calculated = calculateStats(combined);
				dataState.history = calculated.normalizedHistory;
				stats = calculated.stats;
				dataState.timeBests = calculated.timeBests;
				dataState.stdBests = calculated.stdBests;
				generateHeatmap(calculated.normalizedHistory);
			} catch (err) {
				console.error('Profile load fallback:', err);
				const localHistory = getLocalGameResults();
				const calculated = calculateStats(localHistory);
				dataState.history = calculated.normalizedHistory;
				stats = calculated.stats;
				dataState.timeBests = calculated.timeBests;
				dataState.stdBests = calculated.stdBests;
				generateHeatmap(calculated.normalizedHistory);
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

<svelte:head>
	<title>Zsweep | Dashboard</title>
</svelte:head>

<div
	class="relative flex min-h-screen flex-col items-center bg-bg font-mono text-text transition-colors duration-300"
>
	{#if ui.loading}
		<div class="mt-24 animate-pulse text-sm text-sub">loading dashboard...</div>
	{:else}
		<div class="flex w-full max-w-6xl flex-col gap-6 px-8 pb-32">
			{#if ui.isGuest}
				<div
					class="flex items-center justify-between rounded-lg border border-main/20 bg-main/5 px-5 py-3 text-xs text-sub"
				>
					<span>
						viewing local session stats — sign in to sync your personal bests and history across
						devices.
					</span>
					<a
						href="/login"
						class="flex items-center gap-1.5 rounded bg-main px-3 py-1.5 font-bold text-bg transition-opacity hover:opacity-90"
					>
						<LogIn size={13} />
						<span>sign in</span>
					</a>
				</div>
			{/if}

			<!-- MONKEYTYPE-STYLE PROFILE BANNER -->
			<div
				class="animate-in fade-in grid w-full grid-cols-1 items-center gap-8 rounded-lg bg-sub/10 p-6 duration-300 lg:grid-cols-[auto_1fr]"
			>
				<div
					class="flex items-center gap-5 border-b border-sub/15 pb-6 lg:border-b-0 lg:border-r lg:pb-0 lg:pr-8"
				>
					<div
						class="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-main/30 bg-sub/20"
					>
						{#if dataState.profile?.avatar_url}
							<img
								src={dataState.profile.avatar_url}
								alt="avatar"
								class="h-full w-full object-cover"
							/>
						{:else}
							<User size={38} class="text-main" />
						{/if}
					</div>
					<div class="flex flex-col gap-1">
						<h1 class="text-2xl font-bold tracking-tight text-text">
							{dataState.profile?.username || 'sweeper'}
						</h1>
						<div class="flex items-center gap-2 text-[11px] text-sub">
							<Calendar size={11} />
							<span>
								joined {dataState.profile?.created_at
									? new Date(dataState.profile.created_at).toLocaleDateString(undefined, {
											month: 'short',
											day: 'numeric',
											year: 'numeric'
										})
									: 'today'}
							</span>
						</div>
						<div class="mt-1 flex items-center gap-2">
							<span
								class="inline-flex items-center gap-1 rounded bg-main/15 px-2 py-0.5 text-[10px] font-bold text-main"
							>
								<Flame size={11} />
								{stats.currentStreak} day streak
							</span>
						</div>
					</div>
				</div>

				<div class="grid grid-cols-2 gap-6 sm:grid-cols-4">
					<div class="flex flex-col">
						<span class="text-[11px] lowercase text-sub opacity-70">tests started</span>
						<span class="mt-0.5 text-3xl font-bold text-text">{stats.started}</span>
					</div>

					<div class="flex flex-col">
						<span class="text-[11px] lowercase text-sub opacity-70">tests completed</span>
						<div class="mt-0.5 flex items-baseline gap-1.5">
							<span class="text-3xl font-bold text-text">{stats.completed}</span>
							<span class="text-xs text-sub">({stats.completionRate}%)</span>
						</div>
					</div>

					<div class="flex flex-col">
						<span class="text-[11px] lowercase text-sub opacity-70">time sweeping</span>
						<span class="mt-0.5 text-3xl font-bold text-text">{stats.timeSweeping}</span>
					</div>

					<div class="flex flex-col">
						<span class="text-[11px] lowercase text-sub opacity-70">mines swept</span>
						<div class="mt-0.5 flex items-baseline gap-1.5">
							<span class="text-3xl font-bold text-main">{stats.totalMinesSwept}</span>
							<span class="text-xs text-sub">{stats.avgAccuracy}% acc</span>
						</div>
					</div>
				</div>
			</div>

			<!-- MONKEYTYPE DUAL PERSONAL BEST CARDS (TIME MODE & STANDARD MODE) -->
			<div
				class="animate-in fade-in grid w-full grid-cols-1 gap-6 delay-75 duration-300 md:grid-cols-2"
			>
				<!-- TIME MODE PERSONAL BESTS -->
				<div class="rounded-lg bg-sub/10 p-6">
					<div class="mb-4 flex items-center justify-between text-xs text-sub">
						<span class="flex items-center gap-2 font-bold lowercase">
							<Hourglass size={13} class="text-main" />
							time mode (grids cleared)
						</span>
						<span class="text-[10px] opacity-60">personal bests</span>
					</div>
					<div class="grid grid-cols-3 gap-4 text-center">
						{#each TIME_SETTINGS as sec (sec)}
							{@const entry = dataState.timeBests[sec]}
							<div
								class="group relative flex flex-col items-center justify-center rounded-lg bg-bg/40 px-3 py-4 transition-colors hover:bg-bg/70"
							>
								<span class="text-xs text-sub opacity-70">{sec} seconds</span>
								<span class="my-1 text-3xl font-bold text-text">
									{entry?.primary || '-'}
								</span>
								<span class="text-xs text-main opacity-80">
									{entry?.hasRecord ? entry.secondary : '-'}
								</span>
								{#if entry?.hasRecord}
									<span class="mt-0.5 text-[10px] text-sub opacity-50">
										{entry.acc}% acc
									</span>
								{/if}
							</div>
						{/each}
					</div>
				</div>

				<!-- STANDARD MODE PERSONAL BESTS -->
				<div class="rounded-lg bg-sub/10 p-6">
					<div class="mb-4 flex items-center justify-between text-xs text-sub">
						<span class="flex items-center gap-2 font-bold lowercase">
							<Grid3x3 size={13} class="text-main" />
							standard mode (fastest clear)
						</span>
						<span class="text-[10px] opacity-60">personal bests</span>
					</div>
					<div class="grid grid-cols-3 gap-4 text-center">
						{#each STD_SETTINGS as size (size)}
							{@const entry = dataState.stdBests[size]}
							<div
								class="group relative flex flex-col items-center justify-center rounded-lg bg-bg/40 px-3 py-4 transition-colors hover:bg-bg/70"
							>
								<span class="text-xs text-sub opacity-70">{size}</span>
								<span class="my-1 text-3xl font-bold text-text">
									{entry?.primary || '-'}
								</span>
								<span class="text-xs text-main opacity-80">
									{entry?.hasRecord ? entry.secondary : '-'}
								</span>
								{#if entry?.hasRecord}
									<span class="mt-0.5 text-[10px] text-sub opacity-50">
										{entry.acc}% acc
									</span>
								{/if}
							</div>
						{/each}
					</div>
				</div>
			</div>

			<!-- ACTIVITY HEATMAP -->
			<div class="animate-in fade-in w-full rounded-lg bg-sub/10 p-6 delay-100 duration-300">
				<div class="mb-4 flex flex-wrap items-center justify-between gap-4">
					<div class="flex items-center gap-3 text-xs">
						<span class="font-bold lowercase text-sub">last 12 months</span>
						<span class="rounded bg-bg/50 px-2 py-0.5 text-[11px] text-sub">
							{stats.started}
							{stats.started === 1 ? 'test' : 'tests'}
						</span>
					</div>
					<div class="flex items-center gap-1.5 text-[10px] text-sub">
						<span>less</span>
						{#each [0.1, 0.25, 0.5, 0.75, 1] as op (op)}
							<div
								class="h-3 w-3 rounded-[2px]"
								style="background-color: {op === 0.1
									? 'rgb(var(--sub) / 0.15)'
									: `rgb(var(--main) / ${op})`}"
							></div>
						{/each}
						<span>more</span>
					</div>
				</div>

				<div class="scrollbar-hide flex gap-[3px] overflow-x-auto pb-1 pt-4">
					{#each HEATMAP_WEEKS as w (w)}
						{@const firstDayOfWeek = dataState.heatmapData[w * 7]}
						<div class="relative flex flex-col gap-[3px]">
							{#if firstDayOfWeek?.monthLabel}
								<span class="absolute -top-4 left-0 text-[9px] lowercase text-sub opacity-60">
									{firstDayOfWeek.monthLabel}
								</span>
							{/if}
							{#each WEEK_DAYS as d (d)}
								{@const day = dataState.heatmapData[w * 7 + d]}
								{#if day}
									<div
										class="group relative h-3 w-3 shrink-0 rounded-[2px] transition-transform hover:scale-125"
										style="background-color: {day.intensity === 0
											? 'rgb(var(--sub) / 0.15)'
											: `rgb(var(--main) / ${day.intensity * 0.25})`}"
									>
										<div
											class="pointer-events-none absolute bottom-full left-1/2 z-30 mb-1.5 w-max -translate-x-1/2 rounded border border-sub/20 bg-bg px-2 py-1 text-[10px] text-text opacity-0 shadow-lg transition-opacity group-hover:opacity-100"
										>
											<span class="font-bold text-main">{day.count}</span>
											{day.count === 1 ? 'test' : 'tests'} on {day.date}
										</div>
									</div>
								{/if}
							{/each}
						</div>
					{/each}
				</div>
			</div>

			<!-- SWEEP HISTORY TABLE -->
			<div class="animate-in fade-in w-full delay-150 duration-300">
				<div class="mb-3 flex flex-wrap items-center justify-between gap-4">
					<div class="flex items-center gap-4">
						<h3 class="flex items-center gap-2 text-xs font-bold lowercase text-sub">
							<Clock size={14} class="text-main" />
							<span>history</span>
						</h3>

						<div class="flex items-center gap-1 rounded-lg bg-sub/10 p-1 text-[11px]">
							{#each ['all', 'standard', 'time'] as modeOpt (modeOpt)}
								<button
									type="button"
									class="rounded px-2.5 py-0.5 lowercase transition-colors {ui.modeFilter ===
									modeOpt
										? 'bg-main font-bold text-bg'
										: 'text-sub hover:text-text'}"
									onclick={() => {
										ui.modeFilter = modeOpt as 'all' | 'standard' | 'time';
										ui.visibleRows = 15;
									}}
								>
									{modeOpt}
								</button>
							{/each}
						</div>
					</div>

					<button
						type="button"
						onclick={exportCsv}
						disabled={dataState.history.length === 0}
						class="flex items-center gap-1.5 rounded-lg bg-sub/10 px-3 py-1.5 text-xs font-bold lowercase text-sub transition-colors hover:bg-sub/20 hover:text-text disabled:opacity-40"
					>
						<Download size={13} />
						<span>export csv</span>
					</button>
				</div>

				<div class="w-full overflow-x-auto rounded-lg bg-sub/10">
					{#if filteredHistory.length === 0}
						<div class="p-10 text-center text-xs text-sub opacity-60">
							no sweep history recorded yet — press <kbd
								class="rounded bg-sub/20 px-1.5 py-0.5 text-text">tab</kbd
							> to start a board.
						</div>
					{:else}
						<table class="w-full border-collapse text-left text-xs">
							<thead class="border-b border-sub/10 text-[11px] lowercase text-sub opacity-70">
								<tr>
									<th class="px-4 py-3">mode</th>
									<th class="px-4 py-3">result</th>
									<th class="px-4 py-3">score</th>
									<th class="px-4 py-3">mpm</th>
									<th class="px-4 py-3">acc</th>
									<th class="px-4 py-3 text-right">date</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-sub/5">
								{#each filteredHistory.slice(0, ui.visibleRows) as row (row.id)}
									{@const rowMpm =
										row.win && row.total_mines > 0
											? ((row.total_mines / Math.max(1, row.time)) * 60).toFixed(1)
											: '-'}
									<tr class="transition-colors hover:bg-bg/40">
										<td class="px-4 py-3 font-bold text-text">
											<span>{row.mode}</span>
											<span class="ml-1.5 text-main"
												>{row.setting}{row.mode === 'time' ? 's' : ''}</span
											>
										</td>
										<td class="px-4 py-3">
											<span
												class="rounded px-1.5 py-0.5 text-[10px] font-bold lowercase {row.win
													? 'bg-main/15 text-main'
													: 'bg-sub/15 text-sub opacity-60'}"
											>
												{row.win ? 'clear' : 'fail'}
											</span>
										</td>
										<td class="px-4 py-3 font-mono text-text">
											{row.mode === 'time' ? row.grids : row.time}<span
												class="ml-1 text-[10px] text-sub opacity-60"
												>{row.mode === 'time' ? 'grids' : 's'}</span
											>
										</td>
										<td class="px-4 py-3 font-mono text-sub">{rowMpm}</td>
										<td class="px-4 py-3 font-mono text-text">{row.accuracy}%</td>
										<td class="px-4 py-3 text-right text-sub opacity-70">
											{new Date(row.created_at).toLocaleString(undefined, {
												month: 'short',
												day: 'numeric',
												hour: '2-digit',
												minute: '2-digit'
											})}
										</td>
									</tr>
								{/each}
							</tbody>
						</table>

						{#if filteredHistory.length > ui.visibleRows}
							<div class="border-t border-sub/10 p-3 text-center">
								<button
									type="button"
									onclick={() => (ui.visibleRows += 20)}
									class="rounded-lg bg-bg/50 px-4 py-1.5 text-xs font-bold lowercase text-sub transition-colors hover:text-main"
								>
									load more ({filteredHistory.length - ui.visibleRows} remaining)
								</button>
							</div>
						{/if}
					{/if}
				</div>
			</div>
		</div>
	{/if}
</div>
