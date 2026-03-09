<script lang="ts">
	import { Keyboard, Hash, Gamepad2, Zap, BookOpen } from 'lucide-svelte';
	import PatternDemo from '$lib/components/docs/PatternDemo.svelte';

	function cell(r: number, c: number, overrides = {}): any {
		return { row: r, col: c, isMine: false, isOpen: false, isFlagged: false, neighborCount: 0, ...overrides };
	}

	const mine = { isMine: true, isFlagged: true };
	const open = (n: number) => ({ isOpen: true, neighborCount: n });

	const patterns = {
		'1-2-1': {
			cols: 5,
			grid: [
				[cell(0, 0, mine), cell(0, 1), cell(0, 2, mine), cell(0, 3), cell(0, 4)],
				[cell(1, 0, open(1)), cell(1, 1, open(2)), cell(1, 2, open(1)), cell(1, 3, open(1)), cell(1, 4, open(0))]
			]
		},
		'1-2-2-1': {
			cols: 5,
			grid: [
				[cell(0, 0), cell(0, 1, mine), cell(0, 2, mine), cell(0, 3), cell(0, 4)],
				[cell(1, 0, open(1)), cell(1, 1, open(2)), cell(1, 2, open(2)), cell(1, 3, open(1)), cell(1, 4, open(0))]
			]
		},
		'wall-3': {
			cols: 3,
			grid: [
				[cell(0, 0, mine), cell(0, 1, mine), cell(0, 2, mine)],
				[cell(1, 0, open(2)), cell(1, 1, open(3)), cell(1, 2, open(2))]
			]
		},
		'2-3-2': {
			cols: 5,
			grid: [
				[cell(0, 0, mine), cell(0, 1), cell(0, 2, mine), cell(0, 3), cell(0, 4, mine)],
				[cell(1, 0, open(1)), cell(1, 1, open(2)), cell(1, 2, open(3)), cell(1, 3, open(2)), cell(1, 4, open(1))]
			]
		},
		'corner-l': {
			cols: 4,
			grid: [
				[cell(0, 0, mine), cell(0, 1), cell(0, 2), cell(0, 3)],
				[cell(1, 0, open(1)), cell(1, 1, open(2)), cell(1, 2, open(1)), cell(1, 3, open(0))],
				[cell(2, 0, open(0)), cell(2, 1, open(1)), cell(2, 2, mine), cell(2, 3)],
				[cell(3, 0, open(0)), cell(3, 1, open(1)), cell(3, 2, open(1)), cell(3, 3, open(1))]
			]
		},
		't-junction': {
			cols: 5,
			grid: [
				[cell(0, 0, mine), cell(0, 1), cell(0, 2), cell(0, 3), cell(0, 4, mine)],
				[cell(1, 0, open(1)), cell(1, 1, open(2)), cell(1, 2, open(1)), cell(1, 3, open(2)), cell(1, 4, open(1))],
				[cell(2, 0, open(0)), cell(2, 1, open(1)), cell(2, 2, mine), cell(2, 3, open(1)), cell(2, 4, open(0))],
				[cell(3, 0, open(0)), cell(3, 1, open(1)), cell(3, 2, open(1)), cell(3, 3, open(1)), cell(3, 4, open(0))]
			]
		},
		'1-2-1-stair': {
			cols: 5,
			grid: [
				[cell(0, 0, mine), cell(0, 1), cell(0, 2), cell(0, 3), cell(0, 4)],
				[cell(1, 0, open(1)), cell(1, 1, open(2)), cell(1, 2), cell(1, 3), cell(1, 4)],
				[cell(2, 0, open(0)), cell(2, 1, open(1)), cell(2, 2, open(2)), cell(2, 3), cell(2, 4)],
				[cell(3, 0, open(0)), cell(3, 1, open(0)), cell(3, 2, open(1)), cell(3, 3, mine), cell(3, 4)]
			]
		}
	};

	const shortcuts = [
		{ keys: ['Tab'], desc: 'Restart / Back to home' },
		{ keys: ['Enter / i'], desc: 'Reveal a cell' },
		{ keys: ['Space / a'], desc: 'Flag or chord' },
		{ keys: ['Escape'], desc: 'Open palette' },
		{ keys: ['z'], desc: 'Toggle zen mode' }
	];

	const motions = [
		{ keys: ['h', 'j', 'k', 'l'], desc: 'Move Left / Down / Up / Right' },
		{ keys: ['w', 'b'], desc: 'Jump forward / backward by word' },
		{ keys: ['gg', 'G'], desc: 'Jump to Top / Bottom of grid' },
		{ keys: ['/'], desc: 'Search for a number (e.g. /7)' },
		{ keys: ['n', 'N'], desc: 'Next / Previous search match' },
		{ keys: ['Esc'], desc: 'Cancel operator / Clear selection' },
		{ keys: ['{', '}'], desc: 'Jump to previous / next block of numbers (planned)' },
		{ keys: ['0'], desc: 'Jump to first cell in current row (planned)' },
		{ keys: ['$'], desc: 'Jump to last cell in current row (planned)' }
	];

	const operators = [
		{
			combo: ['Space / a'],
			desc: 'Flag Current',
			detail: 'Flags the current cell immediately (like "dd").'
		},
		{
			combo: ['Space', 'j'],
			desc: 'Flag Range',
			detail: 'Flags current cell and the one below.'
		},
		{
			combo: ['4', 'Space', 'l'],
			desc: 'Count + Op',
			detail: 'Flags current cell and 4 cells to the right.'
		}
	];
</script>

<svelte:head>
	<title>Zsweep Manual</title>
</svelte:head>

<div class="min-h-screen bg-bg font-mono text-text selection:bg-main/30">
	<div class="mx-auto grid w-full max-w-[1600px] grid-cols-1 gap-12 p-8 lg:grid-cols-[220px_1fr]">
		<aside class="hidden lg:block">
			<div class="sticky top-8 space-y-8 border-l border-main/20 pl-6">
				<div class="space-y-2">
					<h3 class="text-xs font-bold uppercase tracking-widest text-sub">Controls</h3>
					<ul class="space-y-2 text-sm">
						<li><a href="#shortcuts" class="hover:text-main">Key Bindings</a></li>
						<li><a href="#vim" class="hover:text-main">Vim Motions</a></li>
						<li><a href="#operators" class="hover:text-main">Operators</a></li>
					</ul>
				</div>

				<div class="space-y-2">
					<h3 class="text-xs font-bold uppercase tracking-widest text-sub">Strategy</h3>
					<ul class="space-y-2 text-sm">
						<li><a href="#patterns" class="hover:text-main">Mine Patterns</a></li>
					</ul>
				</div>

				<div class="space-y-2">
					<h3 class="text-xs font-bold uppercase tracking-widest text-sub">Reference</h3>
					<ul class="space-y-2 text-sm">
						<li>
							<a href="#technical-terms" class="hover:text-main">Technical Terms</a>
						</li>
						<li><a href="#origin" class="hover:text-main">Origin</a></li>
					</ul>
				</div>
			</div>
		</aside>

		<main class="max-w-4xl space-y-24">
			<header>
				<h1 class="mb-4 text-4xl font-black tracking-tighter text-main">Help</h1>
				<p class="text-lg text-sub">
					zsweep :help pages, reference guide for controls and strategies.
				</p>
			</header>

			<section id="shortcuts" class="scroll-mt-20">
				<div class="mb-6 flex items-center gap-3 border-b border-main/10 pb-2">
					<Gamepad2 class="text-main" />
					<h2 class="text-2xl font-bold">Key Bindings</h2>
				</div>

				<div class="grid gap-4 sm:grid-cols-2">
					{#each shortcuts as item}
						<div class="flex items-center justify-between rounded bg-sub/5 px-4 py-3">
							<span class="text-sm text-sub">{item.desc}</span>
							<div class="flex gap-1">
								{#each item.keys as key}
									<kbd
										class="min-w-[24px] rounded bg-sub/20 px-2 py-0.5 text-center font-bold text-white shadow-sm"
										>{key}</kbd
									>
								{/each}
							</div>
						</div>
					{/each}
				</div>
			</section>

			<section id="vim" class="scroll-mt-20">
				<div class="mb-6 flex items-center gap-3 border-b border-main/10 pb-2">
					<Keyboard class="text-main" />
					<h2 class="text-2xl font-bold">Vim Motions</h2>
				</div>

				<p class="mb-6 text-sm text-sub">
					Use standard Vim keys to navigate efficiently. Motions support counts (e.g., <code
						>4j</code
					> moves down 4 times).
				</p>

				<div class="grid gap-4 sm:grid-cols-2">
					{#each motions as item}
						<div class="flex items-center justify-between rounded bg-sub/5 px-4 py-3">
							<span class="text-sm text-sub">{item.desc}</span>
							<div class="flex gap-1">
								{#each item.keys as key}
									<kbd
										class="min-w-[24px] rounded bg-sub/20 px-2 py-0.5 text-center font-bold text-main shadow-sm"
										>{key}</kbd
									>
								{/each}
							</div>
						</div>
					{/each}
				</div>
			</section>

			<section id="operators" class="scroll-mt-20">
				<div class="mb-6 flex items-center gap-3 border-b border-main/10 pb-2">
					<Zap class="text-main" />
					<h2 class="text-2xl font-bold">Advanced Operators</h2>
				</div>

				<div class="mb-6 space-y-4 text-sm text-sub">
					<p>
						In Zsweep, <kbd class="rounded bg-sub/20 px-1 font-bold text-main"
							>Space</kbd
						>
						acts as an <strong>Operator</strong> (like <code>d</code> in Vim). It allows you
						to flag or chord multiple cells at once by combining it with motions.
					</p>
					<p>
						To act on multiple cells, place the <strong
							>count before the operator</strong
						>
						(e.g., <code>4 Space l</code>). This prevents latency issues and ensures the
						action is applied to the full range immediately.
					</p>
				</div>

				<div class="grid gap-4">
					{#each operators as item}
						<div
							class="flex flex-col gap-2 rounded bg-sub/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
						>
							<div class="flex items-center gap-2">
								{#each item.combo as key}
									<kbd
										class="min-w-[28px] rounded bg-sub/20 px-2 py-1 text-center font-bold text-white shadow-sm"
										>{key}</kbd
									>
								{/each}
								<span class="ml-2 font-bold text-main">{item.desc}</span>
							</div>
							<span class="text-sm text-sub">{item.detail}</span>
						</div>
					{/each}
				</div>
			</section>

			<section id="patterns" class="scroll-mt-20">
				<div class="mb-6 flex items-center gap-3 border-b border-main/10 pb-2">
					<Hash class="text-main" />
					<h2 class="text-2xl font-bold">Mine Patterns</h2>
				</div>

				<h3 class="mt-4 text-xl font-semibold">Basic Patterns</h3>
				<div class="grid gap-4 sm:grid-cols-2">
					<PatternDemo
						grid={patterns['1-2-1'].grid}
						cols={patterns['1-2-1'].cols}
						title="The 1-2-1 Pattern"
						desc="When you see a 1-2-1 sequence against a straight wall, the cells touching the 1s are always mines."
					/>

					<PatternDemo
						grid={patterns['1-2-2-1'].grid}
						cols={patterns['1-2-2-1'].cols}
						title="The 1-2-2-1 Pattern"
						desc="A 1-2-2-1 sequence indicates that the two mines are located between the 2s."
					/>
				</div>

				<h3 class="mt-6 text-xl font-semibold">Intermediate Patterns</h3>
				<div class="grid gap-4 sm:grid-cols-2">
					<PatternDemo
						grid={patterns['wall-3'].grid}
						cols={patterns['wall-3'].cols}
						title="The Wall of 3s"
						desc="If a 3 is touching exactly 3 hidden squares (flagged or not), all of them must be mines."
					/>
					<PatternDemo
						grid={patterns['2-3-2'].grid}
						cols={patterns['2-3-2'].cols}
						title="The 2-3-2 Pattern"
						desc="The 3 touches exactly 3 hidden squares. Mines can be deduced from surrounding numbers."
					/>
				</div>

				<h3 class="mt-6 text-xl font-semibold">Advanced Patterns</h3>
				<div class="grid gap-4 sm:grid-cols-2">
					<PatternDemo
						grid={patterns['corner-l'].grid}
						cols={patterns['corner-l'].cols}
						title="Corner L Pattern"
						desc="Numbers forming an L in the corner often indicate mines along the edges and at the corner itself."
					/>

					<PatternDemo
						grid={patterns['t-junction'].grid}
						cols={patterns['t-junction'].cols}
						title="T-Junction Pattern"
						desc="A T-shaped number formation usually allows you to deduce mine locations at the ends of the top bar and base of the T."
					/>

					<PatternDemo
						grid={patterns['1-2-1-stair'].grid}
						cols={patterns['1-2-1-stair'].cols}
						title="1-2-1 Staircase"
						desc="A repeating 1-2-1 sequence along a diagonal or edge indicates a predictable arrangement of mines."
					/>
				</div>
			</section>

			<section id="technical-terms" class="scroll-mt-20">
				<div class="mb-6 flex items-center gap-3 border-b border-main/10 pb-2">
					<BookOpen class="text-main" />
					<h2 class="text-2xl font-bold">Technical Minesweeper Terms</h2>
				</div>

				<div class="space-y-6 text-sub">
					<div>
						<h3 class="text-xl font-semibold text-text">
							3BV (Bechtel’s Board Benchmark Value)
						</h3>
						<p class="mt-2">
							3BV measures how complex a Minesweeper board is. It counts the <strong
								>minimum number of logical actions</strong
							> needed to solve the board without guessing.
						</p>
						<p class="mt-2">
							Each action that uncovers a safe area or resolves a pattern adds to the
							board’s 3BV. Boards with higher 3BV are more challenging because they
							require more planning and careful thinking. Players use 3BV to <strong
								>compare performance</strong
							> across different boards and track improvement over time.
						</p>
					</div>

					<div>
						<h3 class="text-xl font-semibold text-text">3BV per second (3BV/s)</h3>
						<p class="mt-2">
							3BV/s measures how efficiently you solve a board. It divides the board’s
							3BV by the time it took to finish.
						</p>
						<p class="mt-2">
							This helps you see not just <strong>how fast you are</strong>, but also
							<strong>how efficiently</strong> you are clearing the board. Higher 3BV/s
							means fewer unnecessary clicks and smarter moves. It’s a simple way to track
							progress and compare your skills across boards.
						</p>
					</div>

					<div>
						<h3 class="text-xl font-semibold text-text">Chording</h3>
						<p class="mt-2">
							Chording lets you reveal multiple safe cells at once. When a revealed
							number has the correct number of mines flagged around it, activating
							that number opens all the remaining safe cells nearby.
						</p>
						<p class="mt-2">
							Chording can <strong>save time and clicks</strong>, but it only works if
							your flags are placed correctly. Learning when and how to chord makes
							your play smoother and more consistent, and it’s essential for improving
							efficiency on harder boards.
						</p>
					</div>
				</div>
			</section>

			<section id="origin" class="scroll-mt-20">
				<div class="mb-6 flex items-center gap-3 border-b border-main/10 pb-2">
					<BookOpen class="text-main" />
					<h2 class="text-2xl font-bold">The Origin of Minesweeper</h2>
				</div>

				<div class="space-y-4 text-sub">
					<p>
						Minesweeper started as a logic puzzle game and became widely known through
						Microsoft Windows in the early 1990s. The original version, <strong
							>Mined-Out</strong
						>, was created by Ian Andrew for the ZX Spectrum in 1983. Andrew notes that
						Microsoft Minesweeper followed the same basic design.
					</p>
					<p>
						The game encourages careful thinking and pattern recognition. Players
						uncover cells using numerical clues to locate hidden mines, aiming to solve
						boards without guessing. Over time, Minesweeper evolved into a game of skill
						and efficiency, where players track speed, accuracy, and board complexity.
					</p>
					<p>
						Modern variants, including <span class="font-bold text-main">zsweep</span>,
						build on these classic mechanics while exploring new interfaces.
						Keyboard-focused controls and Vim-style navigation make the game faster and
						more consistent for players who want a streamlined experience.
					</p>
				</div>
			</section>
		</main>
	</div>
</div>
