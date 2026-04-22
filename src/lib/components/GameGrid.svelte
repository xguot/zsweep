<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { Asterisk, Skull, Radiation, Flame, Flag, X } from 'lucide-svelte';
	import type { Cell } from '$lib/minesweeper';
	import type { LineNumberMode } from '$lib/lineNumberStore';
	import { mineIcon } from '$lib/mineIconStore';

	export let grid: Cell[][] = [];
	export let cursor: { r: number; c: number } = { r: 0, c: 0 };
	export let numCols: number;
	export let gameState: 'pending' | 'playing' | 'finished' = 'pending';
	export let vimMode: boolean = false;
	export let isMouseDown: boolean = false;
	export let lineNumberMode: LineNumberMode = 'off';
	export let cellSize: number = 32;

	const dispatch = createEventDispatcher();

	const ICONS = {
		asterisk: Asterisk,
		skull: Skull,
		radiation: Radiation,
		flame: Flame
	};

	let longPressTimer: ReturnType<typeof setTimeout> | null = null;
	let longPressHandled = false;
	let touchFeedback: { r: number; c: number } | null = null;

	function handleLeftClick(r: number, c: number) {
		dispatch('click', { r, c });
	}

	function handleRightClick(r: number, c: number) {
		dispatch('flag', { r, c });
	}

	function handleHover(r: number, c: number) {
		dispatch('hover', { r, c });
	}

	function handleMouseDown() {
		dispatch('mousedown');
	}

	function triggerTouchFeedback(r: number, c: number) {
		touchFeedback = { r, c };
		setTimeout(() => {
			if (touchFeedback?.r === r && touchFeedback?.c === c) {
				touchFeedback = null;
			}
		}, 200);
	}

	function handleTouchStart(r: number, c: number) {
		longPressHandled = false;
		longPressTimer = setTimeout(() => {
			handleRightClick(r, c);
			longPressHandled = true;

			triggerTouchFeedback(r, c);

			if (navigator.vibrate) navigator.vibrate(50);
		}, 500);
	}

	function handleTouchEnd(e: TouchEvent, r: number, c: number) {
		e.preventDefault();
		if (longPressTimer) {
			clearTimeout(longPressTimer);
			longPressTimer = null;
		}
		if (!longPressHandled) {
			handleLeftClick(r, c);
		}
	}

	function handleTouchMove() {
		if (longPressTimer) {
			clearTimeout(longPressTimer);
			longPressTimer = null;
			longPressHandled = true;
		}
	}
</script>

<div
	class="relative select-none bg-bg transition-all duration-300 {vimMode ? 'cursor-none' : ''}"
	style="touch-action: none;"
	on:mousedown={handleMouseDown}
	on:contextmenu|preventDefault
	role="grid"
	tabindex="-1"
>
	{#if lineNumberMode !== 'off'}
		<div class="absolute -bottom-5 left-0 flex gap-1 text-center text-[10px] text-sub/50">
			{#each Array(numCols) as _, c}
				{@const isRelative = lineNumberMode === 'relative' || lineNumberMode === 'hybrid'}
				{@const num = isRelative
					? c === cursor.c && lineNumberMode === 'hybrid'
						? c + 1
						: Math.abs(c - cursor.c)
					: c + 1}
				<div class="flex h-4 items-center justify-center {c === cursor.c ? 'text-main' : ''}" style="width: {cellSize}px;">
					{num}
				</div>
			{/each}
		</div>
		<div class="absolute -left-7 top-0 flex flex-col gap-1 text-right text-[10px] text-sub/50">
			{#each grid as _, r}
				{@const isRelative = lineNumberMode === 'relative' || lineNumberMode === 'hybrid'}
				{@const num = isRelative
					? r === cursor.r && lineNumberMode === 'hybrid'
						? grid.length - r
						: Math.abs(r - cursor.r)
					: grid.length - r}
				<div class="flex w-6 items-center justify-end {r === cursor.r ? 'text-main' : ''}" style="height: {cellSize}px;">
					{num}
				</div>
			{/each}
		</div>
	{/if}
	<div class="grid gap-1" style="grid-template-columns: repeat({numCols}, minmax(0, 1fr));">
		{#each grid as row, r (r)}
			{#each row as cell, c (c)}
				{@const isPressed = isMouseDown && cursor.r === r && cursor.c === c && !cell.isFlagged}
				{@const iconSize = Math.max(10, Math.round(cellSize * 0.55))}
				<button
					type="button"
					class="relative flex select-none items-center justify-center rounded-sm font-bold transition-all
					duration-200 focus:outline-none
					{vimMode ? 'cursor-none' : 'cursor-default'}
					{cell.isOpen || isPressed ? 'bg-sub/10' : `bg-sub/30 ${!vimMode ? 'hover:bg-sub/50' : ''}`}
					{cell.isMine && cell.isOpen ? 'bg-error text-bg' : ''}
					{cell.isMine && !cell.isOpen && gameState === 'finished' ? 'bg-error/50 opacity-50' : ''}
					{cell.isExploded ? '!border-red-600 !bg-red-600' : ''}
					{vimMode && cursor.r === r && cursor.c === c ? 'z-10 ring-2 ring-main/50 brightness-110' : ''}
					{cell.isFlagged ? 'scale-90 bg-sub/20' : 'scale-100'}"
					style="width: {cellSize}px; height: {cellSize}px; font-size: {Math.max(10, Math.round(cellSize * 0.44))}px;"
					on:mousedown={(e) => {
						if (e.button === 2) handleRightClick(r, c);
					}}
					on:dblclick={() => handleRightClick(r, c)}
					on:mouseup={(e) => {
						if (e.button === 0) handleLeftClick(r, c);
					}}
					on:touchstart|passive={() => handleTouchStart(r, c)}
					on:touchend={(e) => handleTouchEnd(e, r, c)}
					on:touchmove={handleTouchMove}
					on:contextmenu|preventDefault
					on:mouseenter={() => handleHover(r, c)}
					aria-label={cell.isOpen
						? cell.isMine
							? 'Mine'
							: `${cell.neighborCount} mines nearby`
						: cell.isFlagged
							? 'Flagged'
							: `Row ${r + 1} Column ${c + 1}`}
				>
					{#if cell.isOpen}
						{#if cell.isMine}
							<svelte:component
								this={ICONS[$mineIcon]}
								size={iconSize}
								fill={cell.isExploded ? 'currentColor' : 'none'}
							/>
						{:else if cell.neighborCount > 0}
							<span
								class={cell.neighborCount === 1
									? 'text-blue-400'
									: cell.neighborCount === 2
										? 'text-green-400'
										: cell.neighborCount === 3
											? 'text-red-400'
											: 'text-purple-400'}
							>
								{cell.neighborCount}
							</span>
						{/if}
					{:else if cell.isFlagged}
						{#if cell.isWrong}
							<div class="relative flex items-center justify-center">
								<Flag size={Math.max(8, iconSize - 4)} fill="currentColor" class="text-error opacity-50" />
								<X size={iconSize} class="absolute text-error" />
							</div>
						{:else}
							<span class="animate-in zoom-in-50 text-error duration-200">
								<Flag size={Math.max(8, iconSize - 4)} fill="currentColor" />
							</span>
						{/if}
					{/if}

					{#if touchFeedback?.r === r && touchFeedback?.c === c}
						<div class="pointer-events-none absolute -top-12 left-1/2 z-50 -translate-x-1/2">
							<div
								class="animate-in slide-in-from-bottom-4 zoom-in fade-in text-error drop-shadow-lg duration-300"
							>
								<Flag size={32} fill="currentColor" />
							</div>
						</div>
					{/if}
				</button>
			{/each}
		{/each}
	</div>
</div>
