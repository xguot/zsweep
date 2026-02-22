<script lang="ts">
	import {
		Search,
		ChevronRight,
		Palette,
		Eye,
		EyeOff,
		Hash,
		Bomb,
		Asterisk,
		Skull,
		Radiation,
		Flame,
		LogOut
	} from 'lucide-svelte';
	import { THEMES, type Theme } from '$lib/themes';
	import { currentTheme, applyThemeToRoot } from '$lib/themeStore';
	import { mineIcon } from '$lib/mineIconStore';
	import { zenMode } from '$lib/zenStore';
	import { lineNumbers, type LineNumberMode } from '$lib/lineNumberStore';
	import { tick } from 'svelte';

	export let show = false;

	let paletteView: 'root' | 'themes' | 'linenumbers' | 'mineicons' = 'root';
	let originalTheme: Theme | null = null;
	let searchQuery = '';
	let searchInputEl: HTMLInputElement;
	let selectedIndex = 0;

	const LINE_NUMBER_OPTIONS: { id: LineNumberMode; label: string }[] = [
		{ id: 'off', label: 'Off' },
		{ id: 'normal', label: 'Normal' },
		{ id: 'relative', label: 'Relative' },
		{ id: 'hybrid', label: 'Hybrid' }
	];

	const MINE_ICON_OPTIONS = [
		{ id: 'asterisk', label: 'Asterisk', icon: Asterisk },
		{ id: 'skull', label: 'Skull', icon: Skull },
		{ id: 'radiation', label: 'Radiation', icon: Radiation },
		{ id: 'flame', label: 'Flame', icon: Flame }
	];

	$: if (show) {
		paletteView = 'root';
		searchQuery = '';
		selectedIndex = 0;
		originalTheme = null;
		tick().then(() => searchInputEl?.focus());
	}

	$: filteredThemes = THEMES.filter((t) =>
		t.label.toLowerCase().includes(searchQuery.toLowerCase())
	);

	$: filteredLineNumbers = LINE_NUMBER_OPTIONS.filter((o) =>
		o.label.toLowerCase().includes(searchQuery.toLowerCase())
	);

	$: filteredMineIcons = MINE_ICON_OPTIONS.filter((o) =>
		o.label.toLowerCase().includes(searchQuery.toLowerCase())
	);

	const COMMANDS = [
		{
			id: 'theme',
			label: 'Theme...',
			icon: Palette,
			action: () => {
				originalTheme = $currentTheme;
				paletteView = 'themes';
				searchQuery = '';
				selectedIndex = 0;
				tick().then(() => searchInputEl?.focus());
			}
		},
		{
			id: 'icons',
			label: 'Mine Icons...',
			icon: Bomb,
			action: () => {
				paletteView = 'mineicons';
				searchQuery = '';
				selectedIndex = 0;
				tick().then(() => searchInputEl?.focus());
			}
		},
		{
			id: 'zen',
			label: 'Toggle Zen Mode',
			icon: $zenMode ? EyeOff : Eye,
			action: () => {
				$zenMode = !$zenMode;
				close();
			}
		},
		{
			id: 'linenumbers',
			label: 'Line Numbers...',
			icon: Hash,
			action: () => {
				paletteView = 'linenumbers';
				searchQuery = '';
				selectedIndex = 0;
				tick().then(() => searchInputEl?.focus());
			}
		},
		{
			id: 'quit',
			label: 'Quit (:q)',
			icon: LogOut,
			action: () => attemptQuit()
		}
	];

	$: filteredCommands = COMMANDS.filter(
		(c) =>
			c.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
			(searchQuery === ':q' && c.id === 'quit')
	);

	$: currentItems =
		paletteView === 'root'
			? filteredCommands
			: paletteView === 'themes'
				? filteredThemes
				: paletteView === 'linenumbers'
					? filteredLineNumbers
					: filteredMineIcons;

	function attemptQuit() {
		try {
			window.close();
		} catch {}
		if (!window.closed) {
			window.location.href = 'https://start.duckduckgo.com';
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (!show) return;

		if (['ArrowUp', 'ArrowDown', 'Enter', 'Escape'].includes(e.key)) {
			e.stopPropagation();
		}

		if (e.key === 'Escape' || (e.ctrlKey && (e.key === '[' || e.key === 'c'))) {
			e.preventDefault();
			if (paletteView !== 'root') {
				if (paletteView === 'themes' && originalTheme) {
					applyThemeToRoot(originalTheme);
				}
				paletteView = 'root';
				searchQuery = '';
				selectedIndex = 0;
				originalTheme = null;
			} else {
				close();
			}
			return;
		}

		if (e.key === 'ArrowDown') {
			e.preventDefault();
			selectedIndex = (selectedIndex + 1) % currentItems.length;
			if (paletteView === 'themes') applyThemeToRoot(currentItems[selectedIndex] as Theme);
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			selectedIndex = (selectedIndex - 1 + currentItems.length) % currentItems.length;
			if (paletteView === 'themes') applyThemeToRoot(currentItems[selectedIndex] as Theme);
		} else if (e.key === 'Enter') {
			e.preventDefault();
			if (paletteView === 'root' && (searchQuery === ':q' || searchQuery === ':wq')) {
				attemptQuit();
			} else {
				executeSelection(currentItems[selectedIndex]);
			}
		}
	}

	function executeSelection(item: any) {
		if (!item) return;

		if (paletteView === 'root') {
			item.action();
		} else if (paletteView === 'themes') {
			originalTheme = null;
			applyThemeToRoot(item as Theme);
			$currentTheme = item;
			close();
		} else if (paletteView === 'linenumbers') {
			$lineNumbers = item.id;
			close();
		} else if (paletteView === 'mineicons') {
			$mineIcon = item.id;
			close();
		}
	}

	function close() {
		if (originalTheme) {
			applyThemeToRoot(originalTheme);
			originalTheme = null;
		}
		show = false;
	}
</script>

{#if show}
	<div
		role="dialog"
		aria-modal="true"
		tabindex="-1"
		class="animate-in fade-in fixed inset-0 z-[100] flex items-start justify-center bg-black/60 backdrop-blur-sm duration-150"
		on:mousedown|self={close}
		on:keydown={handleKeydown}
	>
		<div
			class="mt-[15vh] flex max-h-[50vh] w-[450px] flex-col overflow-hidden rounded-lg border border-sub/20 bg-bg font-mono text-text shadow-2xl"
		>
			<div class="flex items-center gap-3 border-b border-sub/10 p-3">
				<Search size={14} class="text-main" />
				<input
					bind:this={searchInputEl}
					bind:value={searchQuery}
					on:input={() => {
						selectedIndex = 0;
						if (paletteView === 'themes' && filteredThemes[0]) {
							applyThemeToRoot(filteredThemes[0]);
						}
					}}
					type="text"
					placeholder={paletteView === 'root'
						? 'Type to search...'
						: paletteView === 'themes'
							? 'Search themes...'
							: paletteView === 'mineicons'
								? 'Select mine icon...'
								: 'Select line number mode...'}
					class="h-full w-full border-none bg-transparent text-xs text-text outline-none placeholder:text-sub/50"
				/>
			</div>

			<div class="overflow-y-auto p-1.5">
				{#if currentItems.length === 0}
					<div class="p-4 text-center text-xs text-sub/50">No results found.</div>
				{:else}
					{#each currentItems as item, i}
						<button
							class="group flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-xs transition-colors
							{i === selectedIndex ? 'bg-sub/20 text-text' : 'text-sub hover:bg-sub/10 hover:text-text'}"
							on:click={() => executeSelection(item)}
							on:mouseenter={() => {
								selectedIndex = i;
								if (paletteView === 'themes') applyThemeToRoot(item as Theme);
							}}
						>
							{#if paletteView === 'root'}
								<div class="flex items-center gap-3">
									<svelte:component
										this={'icon' in item ? item.icon : Palette}
										size={12}
										class={i === selectedIndex ? 'text-main' : 'text-sub'}
									/>
									<span>{item.label}</span>
								</div>
								<ChevronRight size={12} class="opacity-50" />
							{:else if paletteView === 'themes'}
								{@const theme = item as Theme}
								<div class="flex items-center gap-3">
									<div class="flex items-center gap-0.5">
										{#each [theme.colors.bg, theme.colors.main, theme.colors.sub] as color}
											<span
												class="h-2.5 w-2.5 rounded-full border border-white/10"
												style="background-color: rgb({color})"
											></span>
										{/each}
									</div>
									<span>{theme.label}</span>
								</div>
							{:else if paletteView === 'mineicons'}
								<div class="flex items-center gap-3">
									<svelte:component
										this={item.icon}
										size={12}
										class={i === selectedIndex ? 'text-main' : 'text-sub'}
									/>
									<span>{item.label}</span>
									{#if $mineIcon === item.id}
										<span class="text-main">✓</span>
									{/if}
								</div>
							{:else}
								<div class="flex items-center gap-3">
									<span>{item.label}</span>
									{#if $lineNumbers === item.id}
										<span class="text-main">✓</span>
									{/if}
								</div>
							{/if}
						</button>
					{/each}
				{/if}
			</div>
		</div>
	</div>
{/if}
