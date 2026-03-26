<script lang="ts">
	import { onMount } from 'svelte';
	import confetti from 'canvas-confetti';
	import {
		Grid3x3,
		Wrench,
		Hourglass,
		Infinity as InfinityIcon,
		Mail,
		Github,
		Twitter,
        Coffee
	} from 'lucide-svelte';
	import {
		createGrid,
		placeMines,
		revealCell,
		DIRECTIONS,
		revealCellsAround,
		countFlagsAround,
		type Cell
	} from '$lib/minesweeper';

	import { supabase } from '$lib/supabase';
	import { handleVimKey, calculateVimJump } from '$lib/game/input/vim';

	import GameGrid from '$lib/components/GameGrid.svelte';
	import ResultView from '$lib/components/ResultView.svelte';
	import CustomSettingsModal from '$lib/components/CustomSettingsModal.svelte';
	import TutorialModal from '$lib/components/TutorialModal.svelte';
	import { zenMode } from '$lib/zenStore';
	import { lineNumbers } from '$lib/lineNumberStore';

	import type { PageData } from './$types';
	export let data: PageData;

	const GAME_CONFIG = {
		gridSizes: [
			{ label: '9x9', rows: 9, cols: 9, mines: 10 },
			{ label: '16x16', rows: 16, cols: 16, mines: 40 },
			{ label: '30x16', rows: 16, cols: 30, mines: 99 }
		],
		timeLimits: [15, 30, 60]
	};

	let game = {
		mode: 'standard' as 'time' | 'standard',
		size: GAME_CONFIG.gridSizes[0],
		timeLimit: 15,
		state: 'pending' as 'pending' | 'playing' | 'finished',
		grid: [] as Cell[][],
		minesLeft: 0,
		timer: 0,
		timerInterval: undefined as ReturnType<typeof setInterval> | undefined,
		isFirstClick: true
	};

	let input = {
		cursor: { r: 0, c: 0 },
		buffer: '',
		lastKey: '',
		lastKeyTime: 0,
		isMouseDown: false,
		vimMode: false,
		operator: null as 'SMART' | 'FLAG' | 'REVEAL' | null,
		operatorCount: 1
	};

	let search = {
		active: false,
		term: '',
		matches: [] as { r: number; c: number }[],
		matchIndex: -1
	};

	let ui = {
		showCustomModal: false
	};

	let showTutorial = false;

	let stats = {
		clicks: 0,
		clicksThisSecond: 0,
		history: [] as number[],
		isWin: false,
		gridsSolved: 0,
		gridsPlayed: 0,
		cellsRevealed: 0,
		sessionTotalMines: 0,
		sessionErrors: 0,
		finalAccuracy: 0
	};

	let currentUser: string | null = null;

	function openCustomModal() {
		ui.showCustomModal = true;
	}

	function closeTutorial() {
		showTutorial = false;
		localStorage.setItem('zsweep-visited', 'true');
	}

	function applyCustomSettings(event: CustomEvent) {
		const config = event.detail;

		if (game.mode === 'standard') {
			const r = Math.max(5, Math.min(50, config.rows));
			const c = Math.max(5, Math.min(50, config.cols));
			const maxMines = Math.floor(r * c * 0.85);
			const m = Math.max(1, Math.min(maxMines, config.mines));
			game.size = { label: 'Custom', rows: r, cols: c, mines: m };
		} else {
			const t = Math.max(10, Math.min(999, config.time));
			setTime(t);
		}
		ui.showCustomModal = false;
		fullReset();
	}

	function isMobile() {
		return window.matchMedia('(max-width: 768px)').matches;
	}

	function setMode(mode: 'time' | 'standard') {
		game.mode = mode;
		if (game.mode === 'time' && game.size.label !== '9x9') {
			game.size = GAME_CONFIG.gridSizes[0];
		}
		fullReset();
	}

	function setTime(seconds: number) {
		game.timeLimit = seconds;
		fullReset();
	}

	function setSize(size: (typeof GAME_CONFIG.gridSizes)[0]) {
		game.size = size;
		if (game.size.label !== '9x9' && game.mode === 'time') {
			game.mode = 'standard';
		}
		fullReset();
	}

	function fullReset() {
		game.state = 'pending';
		stats.gridsSolved = 0;
		stats.gridsPlayed = 0;
		stats.cellsRevealed = 0;
		stats.clicks = 0;
		stats.sessionTotalMines = 0;
		stats.sessionErrors = 0;
		stats.finalAccuracy = 0;
		stats.isWin = false;
		stats.history = [];
		stats.clicksThisSecond = 0;

		game.timer = game.mode === 'time' ? game.timeLimit : 0;
		if (game.timerInterval) clearInterval(game.timerInterval);

		resetBoard();
	}

	function resetBoard() {
		game.isFirstClick = true;
		game.grid = createGrid(game.size.rows, game.size.cols);
		game.minesLeft = game.size.mines;
		input.cursor = {
			r: Math.floor(game.size.rows / 2),
			c: Math.floor(game.size.cols / 2)
		};
		input.operator = null;
		input.buffer = '';
	}

	function startSession() {
		if (game.state === 'playing') return;
		game.state = 'playing';
		game.timerInterval = setInterval(() => {
			if (game.mode === 'time') game.timer--;
			else game.timer++;

			stats.history = [...stats.history, stats.clicksThisSecond];
			stats.clicksThisSecond = 0;

			if (game.mode === 'time' && game.timer <= 0) finishSession(true);
		}, 1000);
	}

	function finishSession(win: boolean) {
		game.state = 'finished';
		stats.isWin = win;
		if (game.timerInterval) clearInterval(game.timerInterval);
		if (stats.clicksThisSecond > 0) {
			stats.history = [...stats.history, stats.clicksThisSecond];
		}

		if (game.mode === 'standard') {
			stats.gridsPlayed = 1;
			stats.sessionTotalMines = game.size.mines;
			stats.cellsRevealed = win
				? game.size.rows * game.size.cols - game.size.mines
				: countCurrentSafeOpen();
		} else {
			if (win) {
				stats.cellsRevealed += countCurrentSafeOpen();
				stats.sessionTotalMines += game.size.mines;
				stats.gridsPlayed++;
			}
		}

		if (!win) stats.sessionErrors += countWrongFlags();
		stats.finalAccuracy = calculateAccuracy();
		game.grid = [...game.grid];
		if (win) triggerWin();
		saveResult(win);
	}

	function revealFinalBoard(explodedR: number, explodedC: number) {
		game.grid = game.grid.map((row, r) =>
			row.map((cell, c) => {
				const newCell = { ...cell };

				if (newCell.isFlagged && !newCell.isMine) {
					(newCell as any).isWrong = true;
				}

				if (newCell.isMine && !newCell.isFlagged) {
					newCell.isOpen = true;
				}

				if (r === explodedR && c === explodedC) {
					(newCell as any).isExploded = true;
					newCell.isOpen = true;
					newCell.isFlagged = false;
				}

				return newCell;
			})
		);
	}

	function handleClick(r: number, c: number) {
		if (game.state === 'finished' || game.grid[r][c].isFlagged) return;
		stats.clicks++;
		stats.clicksThisSecond++;

		if (game.isFirstClick) {
			game.isFirstClick = false;
			if (game.state === 'pending') startSession();
			for (const row of game.grid) {
				for (const cell of row) {
					cell.isFlagged = false;
				}
			}
			game.minesLeft = game.size.mines;
			placeMines(game.grid, game.size.mines, { r, c });
		}

		const canChord =
			game.grid[r][c].isOpen &&
			countFlagsAround(game.grid, r, c) === game.grid[r][c].neighborCount;

		const result = canChord ? revealCellsAround(game.grid, r, c) : revealCell(game.grid, r, c);

		game.grid = result.grid;

		if (result.gameOver) {
			triggerExplosion();
			stats.sessionErrors += 1 + countWrongFlags();
			revealFinalBoard(r, c);
			finishSession(false);
		} else {
			checkWin();
		}
	}

	function toggleFlag(r: number, c: number) {
		if (game.state === 'finished' || game.grid[r][c].isOpen) return;
		game.grid[r][c].isFlagged = !game.grid[r][c].isFlagged;
		game.minesLeft += game.grid[r][c].isFlagged ? -1 : 1;
		stats.clicks++;
		stats.clicksThisSecond++;
		game.grid = game.grid;
	}

	function attemptChord(r: number, c: number) {
		const cell = game.grid[r][c];
		let flagCount = 0;
		DIRECTIONS.forEach(([dr, dc]) => {
			if (game.grid[r + dr]?.[c + dc]?.isFlagged) flagCount++;
		});
		if (flagCount === cell.neighborCount) {
			stats.clicks++;
			stats.clicksThisSecond++;
			DIRECTIONS.forEach(([dr, dc]) => {
				const nr = r + dr,
					nc = c + dc;
				if (
					game.grid[nr]?.[nc] &&
					!game.grid[nr][nc].isOpen &&
					!game.grid[nr][nc].isFlagged
				) {
					handleClick(nr, nc);
				}
			});
		}
	}

	function applyAction(type: string, r: number, c: number) {
		if (!game.grid[r] || !game.grid[r][c]) return;

		if (type === 'FLAG') {
			toggleFlag(r, c);
		} else if (type === 'REVEAL') {
			handleClick(r, c);
		} else if (type === 'SMART') {
			if (!game.grid[r][c].isOpen) toggleFlag(r, c);
			else attemptChord(r, c);
		}
	}

	function executeOperatorRange(dest: { r: number; c: number }) {
		if (!input.operator) return;

		const r1 = Math.min(input.cursor.r, dest.r);
		const r2 = Math.max(input.cursor.r, dest.r);
		const c1 = Math.min(input.cursor.c, dest.c);
		const c2 = Math.max(input.cursor.c, dest.c);

		for (let r = r1; r <= r2; r++) {
			for (let c = c1; c <= c2; c++) {
				applyAction(input.operator, r, c);
			}
		}

		input.cursor = dest;
		input.operator = null;
		input.operatorCount = 1;
	}

	function handleInput(e: KeyboardEvent) {
		const isEscapeCombo = e.key === 'Escape' || (e.ctrlKey && (e.key === '[' || e.key === 'c'));

		if (search.active) {
			e.preventDefault();
			e.stopPropagation();

			if (isEscapeCombo) {
				search.active = false;
				search.term = '';
			} else if (e.key === 'Enter') {
				executeSearch();
				search.active = false;
			} else if (e.key === 'Backspace') {
				search.term = search.term.slice(0, -1);
			} else if (/^[0-8]$/.test(e.key)) {
				search.term = e.key;
			}
			return;
		}

		const activeEl = document.activeElement;
		if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) return;

		if (isEscapeCombo) {
			if (input.buffer.length > 0 || input.operator !== null) {
				e.preventDefault();
				e.stopPropagation(); // This prevents +layout.svelte from seeing the key
				input.buffer = '';
				input.operator = null;
			}
			return;
		}

		if (e.metaKey || e.ctrlKey || e.altKey) return;

		if (e.key === 'Tab') {
			e.preventDefault();
			fullReset();
			return;
		}

		const now = Date.now();
		if (e.key === 'g' && input.lastKey === 'g' && now - input.lastKeyTime < 500) {
			input.lastKey = '';
			const dest = { r: 0, c: input.cursor.c };
			if (input.operator) executeOperatorRange(dest);
			else input.cursor = dest;
			input.buffer = '';
			return;
		}
		if (e.key === 'g') {
			input.lastKey = 'g';
			input.lastKeyTime = now;
			return;
		}

		const currentMult = input.buffer.length > 0 ? parseInt(input.buffer) : 1;
		const totalMult = input.operator ? input.operatorCount * currentMult : currentMult;

		const jumpDest = calculateVimJump(
			e.key,
			totalMult,
			input.cursor,
			game.grid,
			game.size.rows,
			game.size.cols
		);

		if (jumpDest) {
			e.preventDefault();
			input.vimMode = true;
			if (input.operator) {
				executeOperatorRange(jumpDest);
			} else {
				input.cursor = jumpDest;
			}
			input.buffer = '';
			return;
		}

		const action = handleVimKey(e.key);
		if (action) {
			if (action.type !== 'FLAG' && action.type !== 'SMART') input.vimMode = true;
			e.preventDefault();

			if (action.type === 'START_SEARCH') {
				search.active = true;
				search.term = '';
				return;
			}

			if (action.type === 'NEXT_MATCH' && search.matches.length > 0) {
				search.matchIndex = (search.matchIndex + 1) % search.matches.length;
				input.cursor = search.matches[search.matchIndex];
				return;
			}
			if (action.type === 'PREV_MATCH' && search.matches.length > 0) {
				search.matchIndex =
					(search.matchIndex - 1 + search.matches.length) % search.matches.length;
				input.cursor = search.matches[search.matchIndex];
				return;
			}

			if (action.type === 'DIGIT') {
				input.buffer += action.value;
				return;
			}
			if (action.type === 'ZERO') {
				if (input.buffer.length > 0) input.buffer += '0';
				return;
			}

			if (action.type === 'SMART' || action.type === 'FLAG' || action.type === 'REVEAL') {
				if (input.buffer.length > 0) {
					input.operator = action.type;
					input.operatorCount = currentMult;
					input.buffer = '';
				} else {
					applyAction(action.type, input.cursor.r, input.cursor.c);
				}
				return;
			}
		}
	}

	function executeSearch() {
		if (!search.term) return;
		const target = parseInt(search.term);
		search.matches = [];
		for (let r = 0; r < game.size.rows; r++) {
			for (let c = 0; c < game.size.cols; c++) {
				const cell = game.grid[r][c];
				if (target === 0 ? !cell.isOpen : cell.isOpen && cell.neighborCount === target) {
					search.matches.push({ r, c });
				}
			}
		}
		if (search.matches.length > 0) {
			search.matchIndex = search.matches.findIndex(
				(m) => m.r > input.cursor.r || (m.r === input.cursor.r && m.c >= input.cursor.c)
			);
			if (search.matchIndex === -1) search.matchIndex = 0;
			input.cursor = search.matches[search.matchIndex];
		}
	}

	function countCurrentSafeOpen() {
		let count = 0;
		game.grid.forEach((row) =>
			row.forEach((c) => {
				if (c.isOpen && !c.isMine) count++;
			})
		);
		return count;
	}

	function countWrongFlags() {
		let wrong = 0;
		game.grid.forEach((row) =>
			row.forEach((c) => {
				if (c.isFlagged && !c.isMine) wrong++;
			})
		);
		return wrong;
	}

	function calculateAccuracy() {
		if (stats.sessionTotalMines === 0) return 0;
		return Math.max(
			0,
			Math.round(
				((stats.sessionTotalMines - stats.sessionErrors) / stats.sessionTotalMines) * 100
			)
		);
	}

	function checkWin() {
		let safeOpen = countCurrentSafeOpen();
		const totalSafe = game.size.rows * game.size.cols - game.size.mines;
		if (safeOpen === totalSafe) {
			if (game.mode === 'time') {
				stats.gridsSolved++;
				stats.gridsPlayed++;
				stats.cellsRevealed += totalSafe;
				stats.sessionTotalMines += game.size.mines;
				stats.sessionErrors += countWrongFlags();
				resetBoard();
			} else {
				stats.gridsSolved = 1;
				finishSession(true);
			}
		}
	}

	function triggerExplosion() {
		confetti({
			particleCount: 150,
			spread: 100,
			origin: { y: 0.6 },
			colors: ['#ef4444', '#dc2626', '#b91c1c']
		});
	}

	function triggerWin() {
		confetti({
			particleCount: 200,
			spread: 120,
			origin: { y: 0.6 },
			colors: ['#10b981', '#34d399', '#f59e0b']
		});
	}

	async function saveResult(win: boolean) {
		const {
			data: { session }
		} = await supabase.auth.getSession();
		let timeTaken =
			game.mode === 'standard' ? game.timer : Math.max(0, game.timeLimit - game.timer);
		const { error } = await supabase.from('game_results').insert({
			user_id: session?.user?.id || null,
			mode: game.mode,
			setting: game.mode === 'time' ? game.timeLimit.toString() : game.size.label,
			win,
			time: timeTaken,
			grids: game.mode === 'standard' ? (win ? 1 : 0) : stats.gridsSolved,
			total_mines: win
				? game.mode === 'standard'
					? game.size.mines
					: stats.gridsSolved * game.size.mines
				: 0,
			accuracy: stats.finalAccuracy
		});
		if (error) console.error('Error saving result:', error);
	}

	onMount(async () => {
		const {
			data: { session }
		} = await supabase.auth.getSession();
		if (session?.user) {
			currentUser = session.user.user_metadata.full_name || session.user.email?.split('@')[0];
		}

		const hasVisited = localStorage.getItem('zsweep-visited');
		if (!hasVisited) {
			showTutorial = true;
		}

		game.size = isMobile() ? GAME_CONFIG.gridSizes[0] : GAME_CONFIG.gridSizes[2];

		fullReset();
	});

	async function handleLogout() {
		await supabase.auth.signOut();
		currentUser = null;
		fullReset();
	}
</script>

<svelte:head>
	<title>Zsweep</title>
</svelte:head>

<svelte:document on:keydown={handleInput} />
<svelte:window on:mouseup={() => (input.isMouseDown = false)} />

<div
	class="relative flex min-h-screen flex-col items-center bg-bg font-mono text-text transition-all duration-500 {$zenMode
		? 'fixed inset-0 justify-center'
		: ''}"
>
	{#if game.state === 'finished'}
		<ResultView
			win={stats.isWin}
			time={game.mode === 'time' ? game.timeLimit - game.timer : game.timer}
			cells={stats.cellsRevealed}
			totalClicks={stats.clicks}
			history={stats.history}
			finalGrid={game.grid}
			accuracy={stats.finalAccuracy}
			sizeLabel={game.size.label}
			gridsSolved={stats.gridsSolved}
			gridsPlayed={stats.gridsPlayed}
			mode={game.mode}
			totalMines={stats.sessionTotalMines}
			totalGlobalSeconds={data?.stats?.seconds || 0}
			restart={fullReset}
		/>
	{:else}
		<div
			class="mb-8 flex select-none items-center gap-6 rounded-lg bg-sub/10 px-4 py-2 text-xs transition-all duration-300 {game.state ===
				'playing' || $zenMode
				? 'pointer-events-none opacity-0'
				: 'opacity-100'}"
		>
			<div class="flex items-center gap-3">
				<button
					class="flex items-center gap-2 transition-colors {game.mode === 'standard'
						? 'font-bold text-main'
						: 'text-sub hover:text-text'}"
					on:click={() => setMode('standard')}
				>
					<InfinityIcon size={12} /><span>standard</span>
				</button>
				<button
					class="flex items-center gap-2 transition-colors {game.mode === 'time'
						? 'font-bold text-main'
						: 'text-sub hover:text-text'}"
					on:click={() => setMode('time')}
				>
					<Hourglass size={12} /><span>time</span>
				</button>
			</div>

			<div class="h-3 w-[1px] bg-sub/20"></div>

			<div class="flex items-center gap-3">
				{#if game.mode === 'standard'}
					<Grid3x3 size={12} class="text-sub opacity-50" />
					{#each GAME_CONFIG.gridSizes as size}
						<button
							class={game.size.label === size.label
								? 'font-bold text-main'
								: 'text-sub hover:text-text'}
							on:click={() => setSize(size)}>{size.label}</button
						>
					{/each}
				{:else}
					<Hourglass size={12} class="text-sub opacity-50" />
					{#each GAME_CONFIG.timeLimits as t}
						<button
							class={game.timeLimit === t
								? 'font-bold text-main'
								: 'text-sub hover:text-text'}
							on:click={() => setTime(t)}>{t}s</button
						>
					{/each}
				{/if}

				<div class="mx-1 h-3 w-[1px] bg-sub/20"></div>

				<button
					class="text-sub transition-colors hover:text-main"
					on:click={openCustomModal}
					title="Custom Settings"
				>
					<Wrench size={12} />
				</button>
			</div>
		</div>

		<div
			class="animate-in fade-in flex flex-col gap-2 duration-300 {$zenMode
				? 'scale-110'
				: 'scale-100'}"
			style="transition: transform 500ms ease-in-out;"
		>
			<div class="mb-2 flex select-none items-end justify-between px-1 text-main">
				<div class="flex w-12 flex-col">
					<span class="text-[10px] font-bold uppercase text-sub opacity-50">time</span>
					<span class="text-3xl font-bold leading-none text-main">{game.timer}</span>
				</div>
				<div class="flex w-12 flex-col text-right">
					<span class="text-[10px] font-bold uppercase text-sub opacity-50">mines</span>
					<span class="text-3xl font-bold leading-none">{game.minesLeft}</span>
				</div>
			</div>

			<GameGrid
				grid={game.grid}
				cursor={input.cursor}
				numCols={game.size.cols}
				gameState={game.state}
				vimMode={input.vimMode}
				isMouseDown={input.isMouseDown}
				lineNumberMode={$lineNumbers}
				on:click={(e) => handleClick(e.detail.r, e.detail.c)}
				on:flag={(e) => toggleFlag(e.detail.r, e.detail.c)}
				on:hover={(e) => {
					input.cursor = e.detail;
					input.vimMode = false;
				}}
				on:mousedown={() => {
					if (game.state === 'playing') input.isMouseDown = true;
					input.vimMode = false;
				}}
			/>
		</div>
	{/if}

	<CustomSettingsModal
		bind:show={ui.showCustomModal}
		gameMode={game.mode}
		currentRows={game.size.rows}
		currentCols={game.size.cols}
		currentMines={game.size.mines}
		currentTime={game.timeLimit}
		on:apply={applyCustomSettings}
	/>

	{#if showTutorial}
		<TutorialModal on:close={closeTutorial} />
	{/if}

	{#if search.active}
		<div
			class="animate-in fade-in slide-in-from-bottom-2 fixed bottom-20 left-1/2 z-50 -translate-x-1/2"
		>
			<div
				class="flex items-center gap-2 rounded-full border border-main/20 bg-bg px-4 py-2 shadow-2xl"
			>
				<span class="font-bold text-main">/</span>
				<span class="min-w-[10px] font-mono text-lg text-text">{search.term}</span>
				<span class="animate-pulse text-main">_</span>
			</div>
		</div>
	{/if}

	<footer
		class="mt-auto flex w-full flex-col items-center gap-6 pb-32 pt-20 text-xs text-sub transition-all duration-300 {$zenMode
			? 'pointer-events-none opacity-0'
			: 'opacity-100'}"
	>
		<div class="flex flex-wrap justify-center gap-8 opacity-60">
			<a
				href="mailto:tommyguo024@outlook.com"
				class="flex items-center gap-2 transition-colors hover:text-text"
			>
				<Mail size={14} />
				<span>contact</span>
			</a>

			<a
				href="https://github.com/xguot/zsweep"
				target="_blank"
				rel="noreferrer"
				class="flex items-center gap-2 transition-colors hover:text-text"
			>
				<Github size={14} />
				<span>github</span>
			</a>

			<a
				href="https://x.com/ougoot"
				target="_blank"
				rel="noreferrer"
				class="flex items-center gap-2 transition-colors hover:text-text"
			>
				<Twitter size={14} />
				<span>twitter</span>
			</a>
		</div>

        <div class="flex items-center gap-2 opacity-40">
            <span>Coded with</span>
            <Coffee size={12} />
            <span>by xguot</span>
        </div>
	</footer>
</div>
