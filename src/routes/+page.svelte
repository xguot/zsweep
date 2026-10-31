<script lang="ts">
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
		calculate3BV,
		type Cell
	} from '$lib/minesweeper';

	import { supabase, ensureUserProfile, saveLocalGameResult } from '$lib/supabase';
	import { handleVimKey, calculateVimJump, calculateVimGJump } from '$lib/game/input/vim';

	import GameGrid from '$lib/components/GameGrid.svelte';
	import ResultView from '$lib/components/ResultView.svelte';
	import CustomSettingsModal from '$lib/components/CustomSettingsModal.svelte';
	import TutorialModal from '$lib/components/TutorialModal.svelte';
	import { onMount } from 'svelte';
	import { zenMode } from '$lib/zenStore.svelte';
	import { lineNumbers } from '$lib/lineNumberStore.svelte';

	const GAME_CONFIG = {
		gridSizes: [
			{ label: '9x9', rows: 9, cols: 9, mines: 10 },
			{ label: '16x16', rows: 16, cols: 16, mines: 40 },
			{ label: '30x16', rows: 16, cols: 30, mines: 99 }
		],
		timeLimits: [15, 30, 60]
	};

	let game = $state({
		mode: 'standard' as 'time' | 'standard',
		size: GAME_CONFIG.gridSizes[0],
		timeLimit: 15,
		state: 'pending' as 'pending' | 'playing' | 'finished',
		grid: [] as Cell[][],
		minesLeft: 0,
		timer: 0,
		timerInterval: undefined as ReturnType<typeof setInterval> | undefined,
		isFirstClick: true
	});

	let input = $state({
		cursor: { r: 0, c: 0 },
		buffer: '',
		lastKey: '',
		lastKeyTime: 0,
		isMouseDown: false,
		vimMode: false,
		operator: null as 'SMART' | 'FLAG' | 'REVEAL' | null,
		operatorKey: '',
		operatorCount: 1
	});

	let search = $state({
		active: false,
		term: '',
		matches: [] as { r: number; c: number }[],
		matchIndex: -1
	});

	let ui = $state({
		showCustomModal: false
	});

	let showTutorial = $state(false);

	let stats = $state({
		clicks: 0,
		clicksThisSecond: 0,
		history: [] as number[],
		isWin: false,
		gridsSolved: 0,
		gridsPlayed: 0,
		cellsRevealed: 0,
		sessionTotalMines: 0,
		sessionErrors: 0,
		finalAccuracy: 0,
		threeBV: 0
	});

	let windowWidth = $state(0);
	let windowHeight = $state(0);

	let cellSize = $derived(
		(() => {
			if (!windowWidth) return 32;
			const cols = game.size.cols;
			const rows = game.size.rows;
			const gap = 4;
			const hPad = 64;
			const vPad = 260; // top UI + footer breathing room
			const availW = windowWidth - hPad;
			const availH = windowHeight - vPad;
			const maxW = Math.floor((availW - (cols - 1) * gap) / cols);
			const maxH = Math.floor((availH - (rows - 1) * gap) / rows);
			return Math.max(20, Math.min(32, maxW, maxH));
		})()
	);

	let vimStatusText = $derived(
		(() => {
			const parts: string[] = [];
			if (input.operator) {
				const opLabel =
					input.operatorKey ||
					(input.operator === 'FLAG' ? 'f' : input.operator === 'REVEAL' ? 'c' : '␣');
				parts.push(`${input.operatorCount > 1 ? input.operatorCount : ''}${opLabel}`);
			}
			if (input.buffer) parts.push(input.buffer);
			if (input.lastKey === 'g') parts.push('g');
			return parts.join('');
		})()
	);

	function openCustomModal() {
		ui.showCustomModal = true;
	}

	function closeTutorial() {
		showTutorial = false;
		localStorage.setItem('zsweep-visited', 'true');
	}

	function applyCustomSettings(config: {
		rows: number;
		cols: number;
		mines: number;
		time: number;
	}) {
		if (game.mode === 'standard') {
			const r = Math.max(5, Math.min(50, config.rows));
			const c = Math.max(5, Math.min(50, config.cols));
			const maxMines = Math.min(Math.floor(r * c * 0.85), r * c - 9);
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
		stats.threeBV = 0;
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
		input.operatorKey = '';
		input.operatorCount = 1;
		input.buffer = '';
		input.lastKey = '';
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
			if (!game.isFirstClick && game.grid.length > 0) {
				stats.threeBV = calculate3BV(game.grid);
			}
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
					newCell.isWrong = true;
				}

				if (newCell.isMine && !newCell.isFlagged) {
					newCell.isOpen = true;
				}

				if (r === explodedR && c === explodedC) {
					newCell.isExploded = true;
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
			game.grid[r][c].isOpen && countFlagsAround(game.grid, r, c) === game.grid[r][c].neighborCount;

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
				if (game.grid[nr]?.[nc] && !game.grid[nr][nc].isOpen && !game.grid[nr][nc].isFlagged) {
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
		input.operatorKey = '';
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
				executeSearch();
				search.active = false;
			}
			return;
		}

		const activeEl = document.activeElement;
		if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) return;

		if (isEscapeCombo) {
			if (input.buffer.length > 0 || input.operator !== null || input.lastKey !== '') {
				e.preventDefault();
				e.stopPropagation(); // Prevents +layout.svelte from opening the command palette when clearing pending Vim state
				input.buffer = '';
				input.operator = null;
				input.operatorKey = '';
				input.operatorCount = 1;
				input.lastKey = '';
			}
			return;
		}

		if (e.metaKey || e.ctrlKey || e.altKey) return;

		if (e.key === 'Tab') {
			e.preventDefault();
			fullReset();
			return;
		}

		if (game.state === 'finished') return;

		const currentMult = input.buffer.length > 0 ? parseInt(input.buffer, 10) : 1;
		const totalMult = input.operator ? input.operatorCount * currentMult : currentMult;

		// Handle g-prefixed multi-key motions (gg, ge, g_, gm)
		const now = Date.now();
		if (input.lastKey === 'g' && now - input.lastKeyTime < 1000) {
			input.lastKey = '';
			const gDest = calculateVimGJump(
				e.key,
				totalMult,
				input.cursor,
				game.grid,
				game.size.rows,
				game.size.cols
			);
			if (gDest) {
				e.preventDefault();
				input.vimMode = true;
				if (input.operator) executeOperatorRange(gDest);
				else input.cursor = gDest;
				input.buffer = '';
				return;
			}
		}

		if (e.key === 'g') {
			e.preventDefault();
			input.vimMode = true;
			input.lastKey = 'g';
			input.lastKeyTime = now;
			return;
		}
		input.lastKey = '';

		// Handle '0' as part of a count if buffer is already non-empty (e.g., 10j, 20l)
		if (e.key === '0' && input.buffer.length > 0) {
			e.preventDefault();
			input.vimMode = true;
			input.buffer += '0';
			return;
		}

		// Handle double-operator shortcuts (dd -> flag current, cc -> reveal/chord current)
		if (input.operator && input.operatorKey === e.key && (e.key === 'd' || e.key === 'c')) {
			e.preventDefault();
			const endCol = Math.min(game.size.cols - 1, input.cursor.c + totalMult - 1);
			executeOperatorRange({ r: input.cursor.r, c: endCol });
			input.buffer = '';
			return;
		}

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
				search.matchIndex = (search.matchIndex - 1 + search.matches.length) % search.matches.length;
				input.cursor = search.matches[search.matchIndex];
				return;
			}

			if (action.type === 'DIGIT') {
				input.buffer += action.value;
				return;
			}

			if (action.type === 'OPERATOR') {
				input.operator = action.operator;
				input.operatorKey = e.key;
				input.operatorCount = currentMult;
				input.buffer = '';
				return;
			}

			if (action.type === 'SMART' || action.type === 'FLAG' || action.type === 'REVEAL') {
				if (input.buffer.length > 0) {
					input.operator = action.type;
					input.operatorKey = e.key === ' ' ? '␣' : e.key;
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
		const target = parseInt(search.term, 10);
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
				(m) => m.r > input.cursor.r || (m.r === input.cursor.r && m.c > input.cursor.c)
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
			Math.round(((stats.sessionTotalMines - stats.sessionErrors) / stats.sessionTotalMines) * 100)
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
				stats.threeBV += calculate3BV(game.grid);
				resetBoard();
			} else {
				stats.gridsSolved = 1;
				finishSession(true);
			}
		}
	}

	function triggerExplosion() {
		confetti({
			particleCount: 120,
			spread: 90,
			origin: { y: 0.6 },
			colors: ['#ef4444', '#dc2626', '#b91c1c']
		});
	}

	function triggerWin() {
		confetti({
			particleCount: 160,
			spread: 110,
			origin: { y: 0.6 },
			colors: ['#10b981', '#34d399', '#f59e0b']
		});
	}

	async function saveResult(win: boolean) {
		const timeTaken =
			game.mode === 'standard' ? game.timer : Math.max(1, game.timeLimit - game.timer);
		const totalMinesCleared = win
			? game.mode === 'standard'
				? game.size.mines
				: stats.gridsSolved * game.size.mines
			: 0;
		const settingLabel = game.mode === 'time' ? game.timeLimit.toString() : game.size.label;
		const gridsCount = game.mode === 'standard' ? (win ? 1 : 0) : stats.gridsSolved;
		const threeBvPerSec =
			stats.threeBV > 0 ? parseFloat((stats.threeBV / Math.max(1, timeTaken)).toFixed(2)) : 0;

		const {
			data: { session }
		} = await supabase.auth.getSession();

		// Always persist locally so the dashboard and personal bests work offline and in guest mode
		saveLocalGameResult({
			user_id: session?.user?.id || null,
			mode: game.mode,
			setting: settingLabel,
			win,
			time: timeTaken,
			grids: gridsCount,
			total_mines: totalMinesCleared,
			accuracy: stats.finalAccuracy,
			three_bv: stats.threeBV,
			three_bv_per_sec: threeBvPerSec
		});

		if (session?.user) {
			await ensureUserProfile(session.user);
		}

		const { error } = await supabase.from('game_results').insert({
			user_id: session?.user?.id || null,
			mode: game.mode,
			setting: settingLabel,
			win,
			time: timeTaken,
			grids: gridsCount,
			total_mines: totalMinesCleared,
			accuracy: stats.finalAccuracy
		});
		if (error) console.error('Error saving result:', error);
	}

	onMount(async () => {
		const {
			data: { session }
		} = await supabase.auth.getSession();
		if (session?.user) {
			ensureUserProfile(session.user);
		}

		const hasVisited = localStorage.getItem('zsweep-visited');
		if (!hasVisited) {
			showTutorial = true;
		}

		game.size = isMobile() ? GAME_CONFIG.gridSizes[0] : GAME_CONFIG.gridSizes[2];

		fullReset();
	});
</script>

<svelte:head>
	<title>Zsweep</title>
</svelte:head>

<svelte:document onkeydown={handleInput} />
<svelte:window
	onmouseup={() => (input.isMouseDown = false)}
	bind:innerWidth={windowWidth}
	bind:innerHeight={windowHeight}
/>

<div
	class="relative flex min-h-screen flex-col items-center bg-bg font-mono text-text transition-all duration-500 {zenMode.value
		? 'fixed inset-0 justify-center'
		: ''}"
>
	{#if game.state === 'finished'}
		<ResultView
			win={stats.isWin}
			time={game.mode === 'time' ? Math.max(1, game.timeLimit - game.timer) : game.timer}
			cells={stats.cellsRevealed}
			totalClicks={stats.clicks}
			history={stats.history}
			finalGrid={game.grid}
			accuracy={stats.finalAccuracy}
			sizeLabel={game.mode === 'time' ? `${game.timeLimit}s` : game.size.label}
			gridsSolved={stats.gridsSolved}
			mode={game.mode}
			totalMines={stats.sessionTotalMines}
			threeBV={stats.threeBV}
			restart={fullReset}
		/>
	{:else}
		<div
			class="mb-8 flex select-none items-center gap-6 rounded-lg bg-sub/10 px-4 py-2 text-xs transition-all duration-300 {game.state ===
				'playing' || zenMode.value
				? 'pointer-events-none opacity-0'
				: 'opacity-100'}"
		>
			<div class="flex items-center gap-3">
				<button
					class="flex items-center gap-2 transition-colors {game.mode === 'standard'
						? 'font-bold text-main'
						: 'text-sub hover:text-text'}"
					onclick={() => setMode('standard')}
				>
					<InfinityIcon size={12} /><span>standard</span>
				</button>
				<button
					class="flex items-center gap-2 transition-colors {game.mode === 'time'
						? 'font-bold text-main'
						: 'text-sub hover:text-text'}"
					onclick={() => setMode('time')}
				>
					<Hourglass size={12} /><span>time</span>
				</button>
			</div>

			<div class="h-3 w-[1px] bg-sub/20"></div>

			<div class="flex items-center gap-3">
				{#if game.mode === 'standard'}
					<Grid3x3 size={12} class="text-sub opacity-50" />
					{#each GAME_CONFIG.gridSizes as size (size.label)}
						<button
							class={game.size.label === size.label
								? 'font-bold text-main'
								: 'text-sub hover:text-text'}
							onclick={() => setSize(size)}>{size.label}</button
						>
					{/each}
				{:else}
					<Hourglass size={12} class="text-sub opacity-50" />
					{#each GAME_CONFIG.timeLimits as t (t)}
						<button
							class={game.timeLimit === t ? 'font-bold text-main' : 'text-sub hover:text-text'}
							onclick={() => setTime(t)}>{t}s</button
						>
					{/each}
				{/if}

				<div class="mx-1 h-3 w-[1px] bg-sub/20"></div>

				<button
					class="text-sub transition-colors hover:text-main"
					onclick={openCustomModal}
					title="Custom Settings"
				>
					<Wrench size={12} />
				</button>
			</div>
		</div>

		<div
			class="animate-in fade-in flex flex-col gap-2 duration-300 {zenMode.value
				? 'scale-110'
				: 'scale-100'}"
			style="transition: transform 500ms ease-in-out;"
		>
			<div class="mb-2 flex select-none items-end justify-between px-1 text-main">
				<div class="flex w-16 flex-col">
					<span class="text-[10px] font-bold uppercase text-sub opacity-50">time</span>
					<span class="text-3xl font-bold leading-none text-main">{game.timer}</span>
				</div>

				<div class="flex items-center gap-2 pb-0.5 text-xs">
					{#if vimStatusText}
						<span
							class="rounded bg-main/15 px-2 py-0.5 font-mono text-xs font-bold tracking-wider text-main"
						>
							{vimStatusText}
						</span>
					{:else if input.vimMode}
						<span class="font-mono text-[10px] text-sub opacity-40">
							{input.cursor.r + 1}:{input.cursor.c + 1}
						</span>
					{/if}
				</div>

				<div class="flex w-16 flex-col text-right">
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
				lineNumberMode={lineNumbers.value}
				{cellSize}
				onclick={(e) => handleClick(e.r, e.c)}
				onflag={(e) => toggleFlag(e.r, e.c)}
				onhover={(e) => {
					input.cursor = e;
					input.vimMode = false;
				}}
				onmousedown={() => {
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
		onapply={applyCustomSettings}
	/>

	{#if showTutorial}
		<TutorialModal onclose={closeTutorial} />
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
		class="mt-auto flex w-full flex-col items-center gap-6 pb-32 pt-20 text-xs text-sub transition-all duration-300 {zenMode.value
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
