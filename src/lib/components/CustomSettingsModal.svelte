<script lang="ts">
	import { Wrench, X } from 'lucide-svelte';

	export let show = false;
	export let gameMode: 'standard' | 'time' = 'standard';

	export let currentRows = 9;
	export let currentCols = 9;
	export let currentMines = 10;
	export let currentTime = 15;

	import { createEventDispatcher } from 'svelte';
	const dispatch = createEventDispatcher();

	let config = {
		rows: 20,
		cols: 20,
		mines: 40,
		time: 120
	};

	$: if (show) {
		if (gameMode === 'standard') {
			config.rows = currentRows;
			config.cols = currentCols;
			config.mines = currentMines;
		} else {
			config.time = currentTime;
		}
	}

	function handleApply() {
		dispatch('apply', config);
		show = false;
	}

	function close() {
		show = false;
	}
</script>

{#if show}
	<div
		class="animate-in fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm duration-200"
		on:click|self={close}
	>
		<div class="w-full max-w-sm rounded-xl border border-sub/20 bg-bg p-6 shadow-2xl">
			<div class="mb-6 flex items-center justify-between">
				<h2 class="flex items-center gap-2 text-lg font-bold text-text">
					<Wrench size={18} class="text-main" />
					<span>Custom {gameMode === 'standard' ? 'Grid' : 'Time'}</span>
				</h2>
				<button on:click={close} class="text-sub transition-colors hover:text-error">
					<X size={18} />
				</button>
			</div>

			<div class="flex flex-col gap-4">
				{#if gameMode === 'standard'}
					<div class="grid grid-cols-2 gap-4">
						<div class="flex flex-col gap-1">
							<label class="text-[10px] font-bold uppercase tracking-widest text-sub">Rows</label>
							<input
								type="number"
								bind:value={config.rows}
								min="5"
								max="50"
								class="rounded border border-sub/20 bg-sub/5 p-2 text-sm font-bold text-text outline-none transition-colors focus:border-main"
							/>
						</div>
						<div class="flex flex-col gap-1">
							<label class="text-[10px] font-bold uppercase tracking-widest text-sub">Cols</label>
							<input
								type="number"
								bind:value={config.cols}
								min="5"
								max="50"
								class="rounded border border-sub/20 bg-sub/5 p-2 text-sm font-bold text-text outline-none transition-colors focus:border-main"
							/>
						</div>
					</div>
					<div class="flex flex-col gap-1">
						<label class="text-[10px] font-bold uppercase tracking-widest text-sub">Mines</label>
						<input
							type="number"
							bind:value={config.mines}
							min="1"
							class="rounded border border-sub/20 bg-sub/5 p-2 text-sm font-bold text-text outline-none transition-colors focus:border-main"
						/>
					</div>
				{:else}
					<div class="flex flex-col gap-1">
						<label
							for="time-limit"
							class="text-[10px] font-bold uppercase tracking-widest text-sub"
						>
							Time Limit (Seconds)
						</label>

						<input
							id="time-limit"
							type="number"
							bind:value={config.time}
							min="10"
							max="999"
							class="rounded border border-sub/20 bg-sub/5 p-2 text-sm font-bold text-text outline-none transition-colors focus:border-main"
						/>
					</div>
				{/if}

				<button
					on:click={handleApply}
					class="mt-2 w-full rounded-lg bg-main py-2.5 text-xs font-bold uppercase tracking-widest text-bg transition-opacity hover:opacity-90"
				>
					Apply Settings
				</button>
			</div>
		</div>
	</div>
{/if}
