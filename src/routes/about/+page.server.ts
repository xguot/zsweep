import type { PageServerLoad } from './$types';
import { fetchAllRows } from '$lib/fetchAllRows';
import { createAboutCache, hasSupabaseSession } from '$lib/server/aboutCache';
import {
	CLEAR_TIME_DIFFICULTIES,
	createClearTimeHistogram,
	getClearTimes
} from '$lib/clearTimeHistogram';

type LoadEvent = Parameters<PageServerLoad>[0];

async function loadAbout({ locals: { supabase }, fetch }: LoadEvent) {
	let contributorsUnavailable = false;
	const contributorsPromise = fetch('https://api.github.com/repos/xguot/zsweep/contributors')
		.then((res) => {
			if (res.ok) return res.json();
			contributorsUnavailable = true;
			return [];
		})
		.catch((error) => {
			console.error('Failed to fetch contributors', error);
			contributorsUnavailable = true;
			return [];
		});
	const [startedResult, completedResult, timeResult] = await Promise.all([
		supabase.from('game_results').select('*', { count: 'exact', head: true }),
		supabase.from('game_results').select('*', { count: 'exact', head: true }).eq('win', true),
		supabase.rpc('get_total_sweeping_time')
	]);
	const { count: started } = startedResult;
	const { count: completed } = completedResult;
	const { data: totalSeconds, error: rpcError } = timeResult;

	if (rpcError) {
		console.error('RPC Error:', rpcError);
	}

	let history: {
		time: number;
		win: boolean;
		mode: string;
		setting: string;
		total_mines: number | null;
	}[] = [];
	let historyUnavailable = false;
	try {
		history = await fetchAllRows(
			(from, to) =>
				supabase
					.from('game_results')
					.select('time, win, mode, setting, total_mines')
					.eq('win', true)
					.eq('mode', 'standard')
					.in(
						'setting',
						CLEAR_TIME_DIFFICULTIES.flatMap(({ setting, legacySetting }) => [
							setting,
							legacySetting
						])
					)
					.order('created_at', { ascending: false })
					.order('id', { ascending: false })
					.range(from, to),
			completed ?? undefined
		);
	} catch (e) {
		console.error('Failed to fetch game results', e);
		historyUnavailable = true;
	}

	const clearTimeHistograms = Object.fromEntries(
		CLEAR_TIME_DIFFICULTIES.map(({ setting }) => [
			setting,
			createClearTimeHistogram(getClearTimes(history, setting))
		])
	);

	const contributors = (await contributorsPromise) || [];
	return {
		cacheable:
			!historyUnavailable &&
			!startedResult.error &&
			!completedResult.error &&
			!rpcError &&
			!contributorsUnavailable,
		stats: {
			started: started || 0,
			completed: completed || 0,
			seconds: totalSeconds || 0,
			clearTimeHistograms,
			historyUnavailable
		},
		contributors
	};
}

const getCachedAbout = createAboutCache(
	60_000,
	(result: Awaited<ReturnType<typeof loadAbout>>) => result.cacheable
);

export const load: PageServerLoad = async (event) => {
	const hasSession = hasSupabaseSession(event.cookies.getAll());
	const result = hasSession ? await loadAbout(event) : await getCachedAbout(() => loadAbout(event));
	return { stats: result.stats, contributors: result.contributors };
};
