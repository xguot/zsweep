import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase } }) => {
	const { data: totalSeconds, error: totalSecondsError } =
		await supabase.rpc('get_total_sweeping_time');

	if (totalSecondsError) {
		console.error('Error fetching total sweeping time:', totalSecondsError);
	}

	const { count: started, error: startedError } = await supabase
		.from('game_results')
		.select('*', { count: 'exact', head: true });

	if (startedError) {
		console.error('Error fetching started count:', startedError);
	}

	const { count: completed, error: completedError } = await supabase
		.from('game_results')
		.select('*', { count: 'exact', head: true })
		.eq('win', true);

	if (completedError) {
		console.error('Error fetching completed count:', completedError);
	}

	return {
		stats: {
			started: started ?? 0,
			completed: completed ?? 0,
			seconds: totalSeconds ?? 0
		}
	};
};
