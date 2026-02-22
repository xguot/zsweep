<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { Bomb, User, LogOut, BookOpen, Info, Palette } from 'lucide-svelte';

	import { supabase } from '$lib/supabase';
	import { currentTheme } from '$lib/themeStore';
	import { zenMode } from '$lib/zenStore';
	import CommandPalette from '$lib/components/CommandPalette.svelte';

	$: isHomePage = $page.url.pathname === '/';
	$: showZenUI = $zenMode && isHomePage;

	let currentUser: string | null = null;
	let showPalette = false;
	let lastKey = '';
	let lastKeyTime = 0;

	let seenState = {
		about: true,
		manual: true
	};

	function attemptQuit() {
		try {
			window.close();
		} catch {}
		if (!window.closed) {
			window.location.href = 'https://start.duckduckgo.com';
		}
	}

	function handleGlobalKeydown(e: KeyboardEvent) {
		// ZZ and ZQ Logic
		if (e.shiftKey && !showPalette) {
			const now = Date.now();
			if (now - lastKeyTime > 1000) lastKey = '';

			if (e.key === 'Z') {
				if (lastKey === 'Z') {
					attemptQuit();
					lastKey = '';
				} else {
					lastKey = 'Z';
				}
			} else if (e.key === 'Q') {
				if (lastKey === 'Z') {
					attemptQuit();
					lastKey = '';
				} else {
					lastKey = '';
				}
			} else {
				lastKey = '';
			}
			lastKeyTime = now;
		} else {
			// Reset sequence if Shift isn't held or other keys pressed
			if (e.key !== 'Shift') lastKey = '';
		}

		if (e.key === 'Escape' || (e.ctrlKey && (e.key === '[' || e.key === 'c'))) {
			if (showPalette) {
				e.preventDefault();
				e.stopPropagation();
				showPalette = false;
				return;
			} else {
				const active = document.activeElement;
				const isInput =
					active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement;

				if (!isInput) {
					e.preventDefault();
					showPalette = true;
					return;
				}
			}
		}

		if (e.key === 'z' && !e.metaKey && !e.ctrlKey && !e.altKey && isHomePage) {
			const active = document.activeElement;
			const isInput =
				active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement;
			if (!isInput && !showPalette) {
				e.preventDefault();
				$zenMode = !$zenMode;
				return;
			}
		}

		if (e.key === 'Tab') {
			const active = document.activeElement;
			const isInput =
				active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement;

			if (!isInput && $page.url.pathname !== '/') {
				e.preventDefault();
				goto('/');
			}
		}
	}

	function markAsSeen(key: 'about' | 'manual') {
		if (!seenState[key]) {
			seenState[key] = true;
			localStorage.setItem(`zsweep-seen-${key}`, 'true');
		}
	}

	onMount(() => {
		const aboutSeen = localStorage.getItem('zsweep-seen-about');
		const manualSeen = localStorage.getItem('zsweep-seen-manual');

		seenState = {
			about: !!aboutSeen,
			manual: !!manualSeen
		};

		supabase.auth.getSession().then(({ data: { session } }) => {
			if (session?.user) {
				currentUser =
					session.user.user_metadata.full_name || session.user.email?.split('@')[0];
			}
		});

		const {
			data: { subscription }
		} = supabase.auth.onAuthStateChange((_event, session) => {
			currentUser = session?.user
				? session.user.user_metadata.full_name || session.user.email?.split('@')[0]
				: null;
		});

		return () => subscription.unsubscribe();
	});

	async function handleLogout() {
		await supabase.auth.signOut();
		currentUser = null;
	}
</script>

<svelte:window on:keydown={handleGlobalKeydown} />

<svelte:head>
	<title>Zsweep</title>
	<meta
		name="description"
		content="A modern, minimalistic minesweeper game inspired by Monkeytype."
	/>
	<meta name="theme-color" content="#323437" />
</svelte:head>

<div class="relative min-h-screen bg-bg pb-20 font-mono text-text transition-colors duration-300">
	<header
		class="flex w-full items-center justify-between p-8 transition-opacity duration-300 {showZenUI
			? 'pointer-events-none opacity-0'
			: 'opacity-100'}"
	>
		<div class="flex items-center gap-5">
			<a
				href="/"
				class="group flex select-none items-center gap-3 transition-opacity hover:opacity-80"
			>
				<svg
					class="h-8 w-8 fill-current text-main transition-transform group-hover:rotate-12"
					viewBox="0 0 1001 1023"
					version="1.1"
					xmlns="http://www.w3.org/2000/svg"
					xmlns:xlink="http://www.w3.org/1999/xlink"
					xml:space="preserve"
					style="fill-rule:evenodd;clip-rule:evenodd;stroke-linejoin:round;stroke-miterlimit:2;"
				>
					<g transform="matrix(1,0,0,1,-9432.959936,-5660.500283)">
						<g transform="matrix(1,0,0,1,-0.299213,4375.543734)">
							<g transform="matrix(-0.789789,0,-0,-0.834522,11925.12142,3309.862971)">
								<path
									d="M2924.824,1459.487L2924.668,1459.59L2923.992,1460.295L2907.574,1481.904C2904.292,1486.223 2905.146,1492.378 2909.678,1495.525C2911.618,1496.872 2914.374,1497.246 2917.045,1496.852C2919.299,1496.519 2921.415,1495.711 2922.156,1495.407L2969.55,1481.143C3009.448,1526.142 3024.623,1554.979 3046.62,1604.133L3047.341,1605.234L3048.354,1606.06L3049.581,1606.564L3050.942,1606.699L3120.803,1603.403L3120.803,1603.4L3120.843,1603.401L3120.892,1603.398C3125.246,1603.112 3129.435,1605.401 3133.38,1608.971C3140.397,1615.319 3146.394,1625.74 3150.32,1636.817C3154.247,1647.896 3156.114,1659.662 3154.547,1668.801C3153.66,1673.97 3151.737,1678.259 3148.025,1680.602L3148.021,1680.604L3147.967,1680.639L3147.922,1680.669L3088.967,1720.059L3088.014,1720.922L3087.38,1721.986L3087.095,1723.178L3087.189,1724.423C3102.156,1787.635 3101.252,1835.797 3099.263,1858.012C3099.262,1858.021 3099.261,1858.029 3099.26,1858.038C3099.099,1859.168 3098.251,1860.096 3097.096,1860.406C3095.918,1860.721 3094.655,1860.33 3093.902,1859.415L3090.675,1857.922L3090.679,1857.921L3093.886,1859.395L3093.867,1859.373C3059.751,1818.964 2955.225,1700.08 2819.399,1608.711C2728.375,1547.48 2624.928,1500.055 2522.983,1499.553L2522.976,1499.553L2522.018,1499.549L2521.989,1499.549L2521.031,1499.553L2521.024,1499.553C2419.079,1500.055 2315.632,1547.48 2224.607,1608.711C2088.782,1700.08 1984.256,1818.964 1950.14,1859.373L1953.328,1857.922L1950.121,1859.395L1950.105,1859.415C1949.352,1860.33 1948.089,1860.721 1946.911,1860.406C1945.755,1860.096 1944.907,1859.167 1944.748,1858.044C1942.755,1835.805 1941.85,1787.641 1956.817,1724.423L1956.912,1723.178L1956.627,1721.986L1955.993,1720.922L1955.04,1720.059L1896.085,1680.669L1893.726,1679.96L1893.733,1679.959L1896.039,1680.639L1895.982,1680.602C1892.27,1678.259 1890.347,1673.97 1889.46,1668.801C1887.893,1659.662 1889.76,1647.896 1893.686,1636.817C1897.613,1625.74 1903.609,1615.319 1910.626,1608.971C1914.573,1605.4 1918.762,1603.111 1923.117,1603.398L1923.164,1603.401L1923.204,1603.403L1993.065,1606.699L1994.425,1606.564L1995.652,1606.06L1996.666,1605.234L1997.387,1604.133C2019.384,1554.979 2034.558,1526.142 2074.456,1481.143L2121.858,1495.41C2122.588,1495.709 2124.705,1496.519 2126.961,1496.852C2129.633,1497.246 2132.388,1496.872 2134.328,1495.525C2138.86,1492.378 2139.715,1486.223 2136.433,1481.904L2120.014,1460.295L2119.338,1459.59L2119.182,1459.487L2017.11,1324.245C2013.997,1320.121 2014.51,1314.221 2016.814,1307.569C2020.881,1295.827 2030.93,1282.105 2043.04,1270.283C2055.122,1258.488 2069.272,1248.556 2081.834,1244.6C2089.067,1242.322 2095.683,1241.983 2100.687,1245.247L2246.734,1340.498L2247.824,1341.017L2248.999,1341.235L2250.194,1341.148L2251.341,1340.754C2316.198,1308.33 2384.144,1287.721 2450.382,1279.036L2451.669,1278.674L2452.762,1277.984L2453.594,1277.022L2454.101,1275.845L2467.706,1222.227C2468.789,1217.961 2473.254,1214.855 2479.264,1212.296C2490.056,1207.7 2505.839,1205.473 2521.609,1205.472L2521.994,1205.473L2521.999,1201.603L2522.01,1201.603L2522.017,1205.473L2522.388,1205.472L2522.391,1201.602L2522.394,1201.602L2522.394,1205.472C2538.166,1205.472 2553.95,1207.699 2564.743,1212.296C2570.753,1214.855 2575.218,1217.961 2576.301,1222.227L2589.906,1275.845L2590.412,1277.022L2591.245,1277.984L2592.338,1278.674L2593.625,1279.036C2659.863,1287.721 2727.809,1308.33 2792.666,1340.754L2793.813,1341.148L2795.008,1341.235L2796.183,1341.017L2797.273,1340.498L2943.32,1245.247C2948.324,1241.983 2954.94,1242.322 2962.173,1244.6C2974.735,1248.556 2988.885,1258.488 3000.967,1270.283C3013.076,1282.105 3023.125,1295.827 3027.193,1307.569C3029.497,1314.221 3030.01,1320.121 3026.897,1324.245L2924.824,1459.487ZM2521.609,1539.23L2521.998,1539.23L2522.001,1535.36L2522.006,1535.36L2522.009,1539.23L2522.398,1539.23C2629.556,1539.23 2716.555,1621.566 2716.555,1722.98C2716.555,1824.395 2629.556,1906.731 2522.398,1906.731L2522.003,1906.73L2521.609,1906.731C2414.451,1906.731 2327.451,1824.395 2327.451,1722.98C2327.451,1621.566 2414.451,1539.23 2521.609,1539.23ZM2521.609,1608.577C2454.892,1608.577 2400.726,1659.839 2400.726,1722.98C2400.726,1786.122 2454.892,1837.384 2521.609,1837.384L2521.609,1837.312L2521.619,1837.314L2521.619,1837.384L2522.004,1837.384L2522.35,1837.384L2522.398,1837.384C2589.115,1837.384 2643.281,1786.122 2643.281,1722.98C2643.281,1659.839 2589.115,1608.577 2522.398,1608.577L2522.003,1608.577L2521.609,1608.577ZM2922.501,1774.569C2927.398,1770.049 2934.014,1767.589 2940.853,1767.745C2947.693,1767.9 2954.177,1770.659 2958.84,1775.397L2958.857,1775.415L2958.872,1775.43C2997.095,1813.455 3074.458,1891.014 3086.604,1907.719L3086.612,1907.73C3090.039,1912.407 3090.473,1919.553 3090.064,1926.392C3089.397,1937.54 3086.072,1948.051 3086.021,1948.211L3089.914,1945.475L3085.99,1948.314L3085.965,1948.401C3081.003,1967.07 3057.601,2069.077 2974.836,2165.14L2974.165,2166.208L2973.856,2167.389L2973.915,2168.604L2974.352,2169.776C2997.969,2211.973 3021.081,2253.122 3042.528,2291.089C3044.921,2295.325 3043.158,2300.712 3039.545,2306.622C3032.991,2317.343 3019.84,2329.194 3005.123,2339.027C2990.39,2348.872 2974.061,2356.706 2960.982,2359.122C2953.683,2360.471 2947.524,2360.33 2943.886,2356.887C2912.175,2326.876 2833.011,2253.031 2808.854,2228.019C2804.039,2223.033 2800.354,2215.607 2799.998,2209.204C2798.71,2186.091 2810.373,2171.192 2816.131,2161.093C2816.159,2161.043 2824.005,2147.348 2808.997,2137.953C2803.883,2134.751 2794.581,2134.619 2788.349,2137.543C2782.777,2140.158 2777.352,2147.239 2772.941,2153.259C2757.644,2174.139 2752.009,2203.73 2763.004,2233.329C2767.618,2245.747 2783.219,2285.257 2787.156,2295.666C2780.945,2299.969 2761.654,2311.687 2717.381,2326.543L2716.06,2327.245L2715.086,2328.292L2714.526,2329.583L2714.447,2331.016L2723.971,2406.417L2723.975,2406.447L2723.978,2406.472C2725.404,2416.624 2715.163,2423.007 2704.126,2425.406C2697.027,2426.948 2689.377,2426.813 2683.411,2424.531C2679.971,2423.215 2677.113,2421.175 2675.535,2418.189L2639.124,2348.674L2638.28,2347.562L2637.137,2346.781L2635.793,2346.377L2634.347,2346.397C2599.285,2352.357 2562.118,2355.653 2522.003,2355.653C2481.889,2355.653 2444.722,2352.357 2409.66,2346.397L2408.214,2346.377L2406.87,2346.781L2405.727,2347.562L2404.883,2348.674L2368.472,2418.189C2366.894,2421.175 2364.036,2423.215 2360.596,2424.531C2354.63,2426.813 2346.98,2426.948 2339.881,2425.406C2328.843,2423.007 2318.602,2416.624 2320.028,2406.472L2320.032,2406.447L2320.036,2406.417L2329.559,2331.016L2329.481,2329.583L2328.921,2328.292L2327.947,2327.245L2326.626,2326.543C2282.354,2311.687 2263.062,2299.97 2256.851,2295.666C2260.788,2285.257 2276.389,2245.747 2281.002,2233.329C2291.998,2203.73 2286.363,2174.139 2271.066,2153.259C2266.655,2147.239 2261.23,2140.158 2255.658,2137.543C2249.426,2134.619 2240.124,2134.751 2235.01,2137.953C2220.002,2147.348 2227.848,2161.043 2227.876,2161.093C2233.633,2171.192 2245.297,2186.091 2244.009,2209.204C2243.652,2215.607 2239.968,2223.033 2235.153,2228.019C2210.996,2253.031 2131.831,2326.876 2100.121,2356.887C2096.483,2360.33 2090.324,2360.471 2083.025,2359.122C2069.945,2356.706 2053.617,2348.872 2038.883,2339.027C2024.167,2329.194 2011.016,2317.343 2004.462,2306.622C2000.849,2300.712 1999.086,2295.325 2001.479,2291.089C2022.926,2253.122 2046.038,2211.973 2069.655,2169.776L2070.092,2168.604L2070.151,2167.389L2069.841,2166.208L2069.171,2165.14C1986.406,2069.077 1963.004,1967.07 1958.042,1948.401L1954.075,1945.475L1954.092,1945.475L1958.017,1948.314L1957.986,1948.212L1957.986,1948.211C1957.934,1948.049 1954.609,1937.539 1953.943,1926.392C1953.533,1919.553 1953.968,1912.407 1957.394,1907.73L1957.403,1907.719C1969.549,1891.014 2046.912,1813.455 2085.134,1775.429L2085.149,1775.415L2085.168,1775.396C2089.831,1770.658 2096.315,1767.9 2103.154,1767.745C2109.993,1767.589 2116.61,1770.05 2121.508,1774.571L2121.533,1774.594L2121.555,1774.614C2176.273,1823.661 2330.102,1943.949 2521.033,1943.949L2522.003,1943.948L2522.974,1943.949C2713.905,1943.949 2867.734,1823.66 2922.451,1774.613L2922.473,1774.594L2922.501,1774.569ZM2522.003,2085.987C2540.969,2085.987 2556.366,2071.415 2556.366,2053.467C2556.366,2035.518 2540.969,2020.946 2522.003,2020.946C2503.038,2020.946 2487.641,2035.518 2487.641,2053.467C2487.641,2071.415 2503.038,2085.987 2522.003,2085.987Z"
								/>
							</g>
						</g>
					</g>
				</svg>
				<div class="flex flex-col">
					<h1 class="text-3xl font-black leading-none tracking-tighter text-text">
						z<span class="text-main">sweep</span>
					</h1>
				</div>
			</a>

			<div class="flex items-center gap-2">
				<a
					href="/about"
					on:click={() => markAsSeen('about')}
					class="flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-sub/10 hover:text-text {$page
						.url.pathname === '/about'
						? 'bg-sub/10 text-text'
						: !seenState.about
							? 'animate-pulse text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.8)]'
							: 'text-sub'}"
					title="About"
				>
					<Info size={22} />
				</a>

				<a
					href="/help"
					on:click={() => markAsSeen('manual')}
					class="flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-sub/10 hover:text-text {$page
						.url.pathname === '/help'
						? 'bg-sub/10 text-text'
						: !seenState.manual
							? 'animate-pulse text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.8)]'
							: 'text-sub'}"
					title="Manual / Help"
				>
					<BookOpen size={22} />
				</a>
			</div>
		</div>

		<div class="flex items-center gap-6 text-sm transition-opacity duration-300">
			{#if currentUser}
				<div class="group relative z-20">
					<button
						title="Go to Profile"
						class="flex items-center gap-2 rounded px-3 py-1.5 text-main transition-all hover:bg-sub/10"
					>
						<User size={16} />
						<span class="font-bold">{currentUser}</span>
					</button>
					<div
						class="invisible absolute right-0 top-full pt-2 opacity-0 transition-all duration-200 group-hover:visible group-hover:opacity-100"
					>
						<div
							class="flex min-w-[160px] flex-col rounded border border-sub/20 bg-bg p-1 font-mono text-sm shadow-xl"
						>
							<a
								href="/profile"
								class="flex items-center gap-2 rounded px-3 py-2 text-sub transition-colors hover:bg-sub/10 hover:text-text"
							>
								<User size={14} /><span>Profile</span>
							</a>
							<div class="my-1 h-[1px] bg-sub/10"></div>
							<button
								on:click={handleLogout}
								class="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sub transition-colors hover:bg-error/10 hover:text-error"
							>
								<LogOut size={14} /><span>Sign Out</span>
							</button>
						</div>
					</div>
				</div>
			{:else}
				<a
					href="/login"
					class="flex h-8 w-8 items-center justify-center rounded text-sub hover:bg-sub/10 hover:text-text"
				>
					<User size={18} />
				</a>
			{/if}
		</div>
	</header>

	<main class="w-full">
		<slot />
	</main>

	<CommandPalette bind:show={showPalette} />

	<div
		class="pointer-events-none fixed bottom-6 left-0 right-0 z-50 px-8 transition-opacity duration-300 {showZenUI
			? 'opacity-0'
			: 'opacity-100'}"
	>
		<div class="flex w-full select-none justify-between">
			<div
				class="flex flex-col gap-2 text-[10px] font-bold tracking-widest text-sub opacity-60"
			>
				<button
					class="pointer-events-auto flex cursor-pointer items-center gap-3 transition-opacity hover:opacity-100"
					on:click={() => ($page.url.pathname === '/' ? location.reload() : goto('/'))}
				>
					<kbd
						class="flex min-w-[36px] justify-center rounded bg-sub/20 px-1.5 py-0.5 font-mono text-text shadow-sm"
						>tab</kbd
					>
					<span class="h-[1px] w-3 bg-sub/30"></span>
					<span>restart</span>
				</button>

				<div class="flex items-center gap-3">
					<kbd
						class="flex min-w-[36px] justify-center rounded bg-sub/20 px-1.5 py-0.5 font-mono text-text shadow-sm"
						>spc</kbd
					>
					<span class="h-[1px] w-3 bg-sub/30"></span>
					<span>flag/chord</span>
				</div>

				<button
					class="pointer-events-auto flex cursor-pointer items-center gap-3 transition-opacity hover:opacity-100"
					on:click={() => (showPalette = !showPalette)}
				>
					<kbd
						class="flex min-w-[36px] justify-center rounded bg-sub/20 px-1.5 py-0.5 font-mono text-text shadow-sm"
						>esc</kbd
					>
					<span class="h-[1px] w-3 bg-sub/30"></span>
					<span>palette</span>
				</button>
			</div>

			<div
				class="flex flex-col justify-end text-right text-[10px] font-bold uppercase tracking-widest text-sub opacity-60"
			>
				<div class="flex items-center gap-2">
					<span>{$currentTheme?.label || 'default'}</span>
					<Palette size={10} />
				</div>
			</div>
		</div>
	</div>
</div>
