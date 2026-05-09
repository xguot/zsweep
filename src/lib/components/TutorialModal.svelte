<script lang="ts">
	import { createBubbler, stopPropagation } from 'svelte/legacy';

	const bubble = createBubbler();
	import { createEventDispatcher } from 'svelte';
	import { fade, scale } from 'svelte/transition';
	import { ExternalLink, Keyboard, MousePointerClick } from 'lucide-svelte';

	const dispatch = createEventDispatcher();

	function close() {
		dispatch('close');
	}

	function handleKeydown(e: KeyboardEvent) {
		if (['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return;
		close();
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div
	class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm"
	transition:fade={{ duration: 200 }}
	onclick={close}
	role="button"
	tabindex="0"
>
	<div
		class="relative w-full max-w-2xl overflow-hidden rounded-xl border border-white/10 bg-black/30 p-8 shadow-2xl backdrop-blur-md"
		transition:scale={{ duration: 200, start: 0.95 }}
		onclick={stopPropagation(bubble('click'))}
		role="document"
	>
		<div class="space-y-8 font-mono text-text">
			<div class="flex items-center gap-6">
				<div
					class="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-main text-bg shadow-lg shadow-main/20"
				>
					<span class="text-xl font-bold">␣</span>
				</div>
				<div>
					<h3 class="text-lg font-bold text-main">Spacebar</h3>
					<p class="text-sm opacity-90">
						Press <span class="font-bold text-main">Space</span> to
						<span class="font-bold text-white">Flag</span>
						mines. Press it again on an open number to
						<span class="font-bold text-white">Chord</span> (reveal neighbors).
					</p>
				</div>
			</div>

			<div class="space-y-3">
				<h3 class="text-xs font-bold uppercase tracking-widest text-sub opacity-70">
					Essential Patterns
				</h3>

				<div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
					<div
						class="group relative overflow-hidden rounded bg-white/5 p-4 transition hover:bg-white/10"
					>
						<div class="mb-3 text-xs font-bold text-main">1-2-1 Pattern</div>
						<div class="grid grid-cols-3 gap-1 opacity-90">
							<div
								class="flex h-6 w-6 items-center justify-center rounded bg-error/20 text-[10px] text-error"
							>
								⚑
							</div>
							<div
								class="flex h-6 w-6 items-center justify-center rounded bg-main/20 text-[10px] text-main"
							>
								✓
							</div>
							<div
								class="flex h-6 w-6 items-center justify-center rounded bg-error/20 text-[10px] text-error"
							>
								⚑
							</div>
							<div class="flex h-6 w-6 items-center justify-center text-sm font-bold text-blue-400">
								1
							</div>
							<div
								class="flex h-6 w-6 items-center justify-center text-sm font-bold text-green-400"
							>
								2
							</div>
							<div class="flex h-6 w-6 items-center justify-center text-sm font-bold text-blue-400">
								1
							</div>
						</div>
						<p class="mt-3 text-[10px] leading-tight text-sub">Mines are next to the 1s.</p>
					</div>

					<div
						class="group relative overflow-hidden rounded bg-white/5 p-4 transition hover:bg-white/10"
					>
						<div class="mb-3 text-xs font-bold text-main">1-2-2-1 Pattern</div>
						<div class="grid grid-cols-4 gap-1 opacity-90">
							<div
								class="flex h-6 w-6 items-center justify-center rounded bg-main/20 text-[10px] text-main"
							>
								✓
							</div>
							<div
								class="flex h-6 w-6 items-center justify-center rounded bg-error/20 text-[10px] text-error"
							>
								⚑
							</div>
							<div
								class="flex h-6 w-6 items-center justify-center rounded bg-error/20 text-[10px] text-error"
							>
								⚑
							</div>
							<div
								class="flex h-6 w-6 items-center justify-center rounded bg-main/20 text-[10px] text-main"
							>
								✓
							</div>
							<div class="flex h-6 w-6 items-center justify-center text-sm font-bold text-blue-400">
								1
							</div>
							<div
								class="flex h-6 w-6 items-center justify-center text-sm font-bold text-green-400"
							>
								2
							</div>
							<div
								class="flex h-6 w-6 items-center justify-center text-sm font-bold text-green-400"
							>
								2
							</div>
							<div class="flex h-6 w-6 items-center justify-center text-sm font-bold text-blue-400">
								1
							</div>
						</div>
						<p class="mt-3 text-[10px] leading-tight text-sub">Mines are between the 2s.</p>
					</div>

					<div
						class="group relative overflow-hidden rounded bg-white/5 p-4 transition hover:bg-white/10"
					>
						<div class="mb-3 text-xs font-bold text-main">Basic Logic</div>
						<div class="grid grid-cols-3 gap-1 opacity-90">
							<div
								class="flex h-6 w-6 items-center justify-center rounded bg-error/20 text-[10px] text-error"
							>
								⚑
							</div>
							<div
								class="flex h-6 w-6 items-center justify-center rounded bg-error/20 text-[10px] text-error"
							>
								⚑
							</div>
							<div
								class="flex h-6 w-6 items-center justify-center rounded bg-error/20 text-[10px] text-error"
							>
								⚑
							</div>
							<div
								class="flex h-6 w-6 items-center justify-center rounded bg-main/20 text-[10px] text-main"
							>
								✓
							</div>
							<div class="flex h-6 w-6 items-center justify-center text-sm font-bold text-red-400">
								3
							</div>
							<div
								class="flex h-6 w-6 items-center justify-center rounded bg-main/20 text-[10px] text-main"
							>
								✓
							</div>
						</div>
						<p class="mt-3 text-[10px] leading-tight text-sub">
							If a <span class="font-bold text-red-400">3</span> touches 3 hidden squares, they are
							<span class="font-bold text-error">ALL</span> mines.
						</p>
					</div>
				</div>
			</div>

			<div
				class="mt-4 flex flex-col gap-4 border-t border-white/5 pt-2 sm:flex-row sm:items-center sm:justify-between"
			>
				<div class="flex items-center gap-6 text-xs font-bold text-main">
					<a
						href="https://youtu.be/qZO9A5F6BZs?si=c-A1Dwk2e1wClOuZ"
						target="_blank"
						rel="noreferrer"
						class="flex items-center gap-2 opacity-80 transition hover:text-white hover:underline hover:opacity-100"
					>
						<Keyboard size={14} />
						<span>Vim Motions</span>
						<ExternalLink size={10} />
					</a>
					<a
						href="https://youtu.be/6vcSO7h6Nt0?si=fLc6IiY9OEaOdPfj"
						target="_blank"
						rel="noreferrer"
						class="flex items-center gap-2 opacity-80 transition hover:text-white hover:underline hover:opacity-100"
					>
						<MousePointerClick size={14} />
						<span>More Patterns</span>
						<ExternalLink size={10} />
					</a>
				</div>

				<button
					class="ml-auto block text-[10px] font-bold uppercase tracking-widest text-sub opacity-40 transition-opacity hover:opacity-100"
					onclick={close}
				>
					<span class="sm:hidden">Tap to Start</span>

					<span class="hidden sm:inline">Press any key</span>
				</button>
			</div>
		</div>
	</div>
</div>
