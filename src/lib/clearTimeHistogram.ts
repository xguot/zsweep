export const CLEAR_TIME_DIFFICULTIES = [
	{ setting: '9x9', legacySetting: 'beginner', label: 'Beginner · 9×9 · 10 mines', mines: 10 },
	{
		setting: '16x16',
		legacySetting: 'intermediate',
		label: 'Intermediate · 16×16 · 40 mines',
		mines: 40
	},
	{ setting: '30x16', legacySetting: 'expert', label: 'Expert · 30×16 · 99 mines', mines: 99 }
];

export function getClearTimes(
	games: {
		win: boolean;
		mode: string;
		setting: string;
		total_mines: number | null;
		time: number;
	}[],
	setting: string
) {
	const difficulty = CLEAR_TIME_DIFFICULTIES.find((difficulty) => difficulty.setting === setting);
	if (!difficulty) return [];
	return games
		.filter(
			(game) =>
				game.win &&
				game.mode === 'standard' &&
				(game.setting === difficulty.setting || game.setting === difficulty.legacySetting) &&
				(!game.total_mines || game.total_mines === difficulty.mines)
		)
		.map((game) => game.time);
}

export function createClearTimeHistogram(dataPoints: number[]) {
	const times = dataPoints
		.filter((time) => Number.isFinite(time) && time >= 0)
		.sort((a, b) => a - b);
	if (!times.length) return { bins: [], total: 0, median: 0, binSize: 10, cutoff: 0, maxTime: 0 };

	const middle = Math.floor(times.length / 2);
	const median = times.length % 2 ? times[middle] : (times[middle - 1] + times[middle]) / 2;
	const percentile = times[Math.ceil(times.length * 0.95) - 1];
	// Keep a minority of idle games from setting the range, even in small samples.
	const visibleLimit = Math.min(percentile, Math.max(100, median * 6));
	const targetSize = Math.max(1, visibleLimit / 20);
	const magnitude = 10 ** Math.floor(Math.log10(targetSize));
	const binSize = [1, 2, 5, 10].map((step) => step * magnitude).find((size) => size >= targetSize)!;
	const cutoff = (Math.floor(visibleLimit / binSize) + 1) * binSize;
	const hasOverflow = times[times.length - 1] >= cutoff;
	const bins = Array.from({ length: cutoff / binSize + Number(hasOverflow) }, (_, index) => ({
		start: index * binSize,
		end: hasOverflow && index === cutoff / binSize ? null : (index + 1) * binSize,
		count: 0
	}));
	for (const time of times) bins[Math.min(Math.floor(time / binSize), bins.length - 1)].count++;

	return { bins, total: times.length, median, binSize, cutoff, maxTime: times[times.length - 1] };
}

export function formatClearDuration(seconds: number) {
	const milliseconds = Math.round(seconds * 1000);
	const hours = Math.floor(milliseconds / 3_600_000);
	const minutes = Math.floor((milliseconds % 3_600_000) / 60_000);
	const remainder = (milliseconds % 60_000) / 1000;
	const parts = [];
	if (hours) parts.push(`${hours}h`);
	if (minutes) parts.push(`${minutes}m`);
	if (remainder || !parts.length) parts.push(`${remainder}s`);
	return parts.join(' ');
}
