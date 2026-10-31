<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { resolve } from '$app/paths';
	import GameGrid from '$lib/components/GameGrid.svelte';
	import { createGrid } from '$lib/minesweeper';
	import {
		PRESETS,
		applyMove,
		newGame,
		type Action,
		type Game,
		type Preset,
		type Variant
	} from '$lib/game/anticheat/engine';
	import type { SessionView } from '$lib/server/anticheat/sessions';

	type Trial = {
		variant: Variant;
		preset: Preset;
		latency: number;
		outcome: string;
		moves: number;
		response: number;
		time: number;
	};
	const labels = { replay: 'local + replay check', server: 'server-owned board' };
	let variant = $state<Variant>('replay');
	let preset = $state<Preset>('9x9');
	let latency = $state(0);
	let grid = $state(createGrid(9, 9));
	let status = $state<'pending' | 'playing' | 'won' | 'lost'>('pending');
	let cursor = $state({ r: 4, c: 4 });
	let keyboard = $state(false);
	let pending = $state(0);
	let message = $state('reveal a cell to start');
	let failure = $state('');
	let verified = $state(false);
	let displayedTime = $state(0);
	let officialTime = $state<number | null>(null);
	let moveTimes = $state<number[]>([]);
	let requestTimes = $state<number[]>([]);
	let trials = $state<Trial[]>([]);
	let width = $state(1000);
	let session: SessionView | null = null;
	let local: Game | null = null;
	let moves: Action[] = [];
	let generation = 0;
	let started = 0;
	let stopped = 0;
	let queue = Promise.resolve();
	let controller = new AbortController();
	const mean = (values: number[]) =>
		values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
	let meanMove = $derived(mean(moveTimes));
	let p95 = $derived(
		[...moveTimes].sort((a, b) => a - b)[Math.max(0, Math.ceil(moveTimes.length * 0.95) - 1)] ?? 0
	);
	let cellSize = $derived(
		Math.max(12, Math.min(30, Math.floor((width - 64) / PRESETS[preset].cols) - 4))
	);
	let flags = $derived(grid.flat().filter((cell) => cell.isFlagged).length);

	function reset() {
		generation++;
		controller.abort();
		controller = new AbortController();
		queue = Promise.resolve();
		session = null;
		local = null;
		moves = [];
		pending = 0;
		started = 0;
		stopped = 0;
		displayedTime = 0;
		officialTime = null;
		verified = false;
		failure = '';
		message = 'reveal a cell to start';
		moveTimes = [];
		requestTimes = [];
		status = 'pending';
		const { rows, cols } = PRESETS[preset];
		grid = createGrid(rows, cols);
		cursor = { r: Math.floor(rows / 2), c: Math.floor(cols / 2) };
	}

	async function request(body: object, token: number): Promise<SessionView> {
		const signal = controller.signal;
		const began = performance.now();
		const wait = () => new Promise<void>((done) => setTimeout(done, latency / 2));
		await wait();
		if (token !== generation) throw new Error('Cancelled');
		const response = await fetch(resolve('/api/anticheat'), {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(body),
			signal
		});
		const value = await response.json();
		await wait();
		if (token !== generation) throw new Error('Cancelled');
		if (!response.ok) throw new Error(value.message || 'Test request failed');
		requestTimes = [...requestTimes, performance.now() - began];
		return value;
	}

	async function retry(body: object, token: number) {
		try {
			return await request(body, token);
		} catch (cause) {
			if (token !== generation) throw cause;
			return request(body, token);
		}
	}

	function record(view: SessionView) {
		if (!view.result) return;
		verified = true;
		officialTime = view.result.elapsedMs;
		trials = [
			{
				variant,
				preset,
				latency,
				outcome: view.result.win ? 'clear' : 'mine',
				moves: view.result.actions,
				response: mean(moveTimes),
				time: view.result.elapsedMs
			},
			...trials
		].slice(0, 12);
		message = view.result.win
			? 'clear — result checked by server'
			: 'mine hit — result checked by server';
	}

	async function act(action: Action, token: number, began: number) {
		if (token !== generation || failure || status === 'won' || status === 'lost') return;
		if (!session) {
			if (action.type !== 'reveal') return;
			started = performance.now();
			message = 'getting a board…';
			session = await request({ operation: 'start', variant, preset, first: action }, token);
			if (variant === 'replay') {
				if (session.seed === undefined) throw new Error('Server did not return a replay seed');
				local = newGame(preset, session.seed, action);
			}
		} else if (variant === 'replay' && local) {
			applyMove(local, action);
			moves.push(action);
		} else {
			message = 'waiting for server…';
			session = await retry(
				{ operation: 'move', id: session.id, revision: session.revision, action },
				token
			);
		}
		const current = local ?? session.game;
		grid = current.grid.map((row) => row.map((cell) => ({ ...cell })));
		status = current.status;
		await tick();
		if (token !== generation) return;
		// Startup is a request in both variants, so keep it out of per-move response measurements.
		if (current.actions > 1) moveTimes = [...moveTimes, performance.now() - began];
		if (status === 'playing') {
			message = variant === 'replay' ? 'playing locally' : 'server is applying each move';
			return;
		}
		stopped = performance.now();
		displayedTime = stopped - started;
		if (variant === 'replay') {
			message = 'checking replay…';
			session = await retry({ operation: 'finish', id: session.id, moves: [...moves] }, token);
			grid = session.game.grid;
		}
		record(session);
	}

	function submit(action: Action) {
		if (failure || status === 'won' || status === 'lost' || pending >= 32) return;
		const token = generation;
		const began = performance.now();
		pending++;
		queue = queue
			.then(() => act(action, token, began))
			.catch((cause) => {
				if (token !== generation) return;
				failure = cause instanceof Error ? cause.message : 'Test failed';
				message = 'start a new board to try again';
				stopped = performance.now();
			})
			.finally(() => {
				if (token === generation) pending--;
			});
	}

	function handleKey(event: KeyboardEvent) {
		const target = event.target;
		if (target instanceof HTMLElement) {
			if (target.closest('input, select, a')) return;
			if (target.closest('button') && !target.closest('[role="grid"]')) return;
		}
		if (event.metaKey || event.ctrlKey || event.altKey) return;
		const directions: Record<string, [number, number]> = {
			h: [0, -1],
			ArrowLeft: [0, -1],
			j: [1, 0],
			ArrowDown: [1, 0],
			k: [-1, 0],
			ArrowUp: [-1, 0],
			l: [0, 1],
			ArrowRight: [0, 1]
		};
		const delta = directions[event.key];
		if (delta) {
			event.preventDefault();
			keyboard = true;
			cursor = {
				r: Math.max(0, Math.min(PRESETS[preset].rows - 1, cursor.r + delta[0])),
				c: Math.max(0, Math.min(PRESETS[preset].cols - 1, cursor.c + delta[1]))
			};
			return;
		}
		if (['Enter', 'i', 'f', 'x', ' '].includes(event.key)) {
			event.preventDefault();
			const type =
				['f', 'x'].includes(event.key) || (event.key === ' ' && !grid[cursor.r][cursor.c].isOpen)
					? 'flag'
					: 'reveal';
			submit({ type, ...cursor });
		}
		if (event.key === 'r') reset();
	}

	onMount(() => {
		const timer = setInterval(() => {
			if (started && !stopped) displayedTime = performance.now() - started;
		}, 50);
		return () => {
			clearInterval(timer);
			generation++;
			controller.abort();
		};
	});
</script>

<svelte:head
	><title>Anticheat A/B test · zsweep</title><meta name="robots" content="noindex" /></svelte:head
>
<svelte:window onkeydown={handleKey} bind:innerWidth={width} />

<div class="mx-auto w-full max-w-5xl px-6 pb-40 font-mono text-text">
	<div class="mb-8 max-w-2xl">
		<a href={resolve('/')} class="text-xs text-sub hover:text-main">back to sweeping</a>
		<h2 class="mb-3 mt-5 text-2xl font-bold tracking-tight">how much control feels right?</h2>
		<p class="text-sm leading-relaxed text-sub">
			same rules, two ways to play. switch between local moves with a replay check and a board
			controlled by the server. these test games don’t affect your stats.
		</p>
	</div>

	<div class="mb-7 flex flex-wrap items-end gap-x-8 gap-y-5 rounded-lg bg-sub/10 p-4 text-xs">
		<fieldset class="flex flex-wrap gap-3">
			<legend class="mb-2 text-sub">anticheat</legend>
			{#each ['replay', 'server'] as choice (choice)}
				<button
					type="button"
					aria-pressed={variant === choice}
					class="rounded px-3 py-2 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-main {variant ===
					choice
						? 'bg-main text-bg'
						: 'bg-sub/10 text-sub hover:text-text'}"
					onclick={() => {
						variant = choice as Variant;
						reset();
					}}>{choice === 'replay' ? 'A · local + replay' : 'B · server-owned'}</button
				>
			{/each}
		</fieldset>
		<label class="flex flex-col gap-2 text-sub"
			>board
			<select
				bind:value={preset}
				onchange={reset}
				class="rounded border-sub/20 bg-bg py-1.5 text-xs text-text focus:border-main focus:ring-main"
			>
				{#each Object.keys(PRESETS) as size (size)}<option value={size}>{size}</option>{/each}
			</select>
		</label>
		<label class="flex flex-col gap-2 text-sub"
			>added round-trip delay
			<select
				bind:value={latency}
				onchange={reset}
				class="rounded border-sub/20 bg-bg py-1.5 text-xs text-text focus:border-main focus:ring-main"
			>
				{#each [0, 50, 100, 200, 400] as delay (delay)}<option value={delay}>{delay} ms</option
					>{/each}
			</select>
		</label>
	</div>

	<div class="mb-6 grid gap-8 lg:grid-cols-[1fr_230px]">
		<div
			class="flex min-w-0 flex-col items-center gap-4 rounded-lg border border-sub/15 p-4 sm:p-6"
		>
			<div class="flex w-full items-center justify-between text-sm">
				<span class="text-main">{(displayedTime / 1000).toFixed(2)}s</span>
				<span class="text-xs text-sub">{PRESETS[preset].mines - flags} mines</span>
			</div>
			<div class="max-w-full overflow-x-auto">
				<GameGrid
					{grid}
					{cursor}
					numCols={PRESETS[preset].cols}
					gameState={status === 'pending'
						? 'pending'
						: status === 'playing'
							? 'playing'
							: 'finished'}
					vimMode={keyboard}
					{cellSize}
					onclick={(pos) => submit({ type: 'reveal', ...pos })}
					onflag={(pos) => submit({ type: 'flag', ...pos })}
					onhover={(pos) => {
						cursor = pos;
						keyboard = false;
					}}
				/>
			</div>
			<p role="status" class="min-h-5 text-center text-xs {verified ? 'text-main' : 'text-sub'}">
				{message}{pending > 1 ? ` (${pending} queued)` : ''}
			</p>
			{#if failure}<p role="alert" class="text-center text-xs text-error">{failure}</p>{/if}
			<button
				type="button"
				class="rounded bg-sub/10 px-4 py-2 text-xs text-sub hover:bg-sub/20 hover:text-text focus-visible:outline focus-visible:outline-main"
				onclick={reset}>new board <kbd class="ml-2 text-main">r</kbd></button
			>
		</div>
		<aside class="text-xs leading-relaxed text-sub">
			<h3 class="mb-3 font-bold text-text">{labels[variant]}</h3>
			<p>
				{variant === 'replay'
					? 'one request to start. every move runs locally, then the server replays the game at the end. the browser knows the mines.'
					: 'every move waits for the server. hidden mines and clues stay off the browser until the game ends.'}
			</p>
			<dl class="mt-6 grid grid-cols-2 gap-y-3 border-t border-sub/15 pt-4">
				<dt>mean move response</dt>
				<dd class="text-right text-main">{meanMove.toFixed(1)} ms</dd>
				<dt>p95 move response</dt>
				<dd class="text-right text-text">{p95.toFixed(1)} ms</dd>
				<dt>requests</dt>
				<dd class="text-right text-text">{requestTimes.length}</dd>
				<dt>server time</dt>
				<dd class="text-right text-text">
					{officialTime === null ? '—' : `${(officialTime / 1000).toFixed(3)}s`}
				</dd>
			</dl>
			<p class="mt-4 text-[11px]">
				move response excludes startup and final replay validation. server time includes network
				delay after the board is issued; it isn’t latency-corrected.
			</p>
		</aside>
	</div>
	<p class="mb-8 text-xs leading-relaxed text-sub">
		click to reveal or chord · right-click to flag · arrows / hjkl to move · enter / i to reveal ·
		space to flag / chord · r to restart
	</p>

	{#if trials.length}
		<div class="overflow-x-auto">
			<div class="mb-3 flex items-center justify-between">
				<h3 class="text-sm font-bold">your test runs</h3>
				<button type="button" class="text-xs text-sub hover:text-text" onclick={() => (trials = [])}
					>clear runs</button
				>
			</div>
			<table class="w-full whitespace-nowrap text-left text-xs">
				<thead class="text-sub"
					><tr
						><th class="py-2 pr-4 font-normal">approach</th><th class="pr-4 font-normal">board</th
						><th class="pr-4 font-normal">added delay</th><th class="pr-4 font-normal">result</th
						><th class="pr-4 font-normal">moves</th><th class="pr-4 font-normal">mean response</th
						><th class="font-normal">server time</th></tr
					></thead
				>
				<tbody
					>{#each trials as trial, index (index)}<tr class="border-t border-sub/10"
							><td class="py-3 pr-4 text-main"
								>{trial.variant === 'replay' ? 'A · local' : 'B · server'}</td
							><td class="pr-4">{trial.preset}</td><td class="pr-4">{trial.latency} ms</td><td
								class="pr-4">{trial.outcome}</td
							><td class="pr-4">{trial.moves}</td><td class="pr-4"
								>{trial.response.toFixed(1)} ms</td
							><td>{(trial.time / 1000).toFixed(3)}s</td></tr
						>{/each}</tbody
				>
			</table>
		</div>
	{/if}
	<p class="mt-8 max-w-2xl text-[11px] leading-relaxed text-sub">
		local prototype for #76. sessions expire after 30 minutes or a server restart. neither approach
		proves a human played. production ranking still needs authenticated, durable sessions, database
		write restrictions, and rate limits.
	</p>
</div>
