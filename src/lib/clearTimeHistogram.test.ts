import { describe, it as test } from 'node:test';
import { strict as assert } from 'node:assert';
import { createClearTimeHistogram, formatClearDuration, getClearTimes } from './clearTimeHistogram';

describe('clear time histogram', () => {
	test('keeps long outliers without stretching the typical range', () => {
		const times = [...Array.from({ length: 100 }, (_, i) => i), 38_200];
		const histogram = createClearTimeHistogram(times);
		assert.equal(histogram.total, times.length);
		assert.equal(
			histogram.bins.reduce((total, bin) => total + bin.count, 0),
			times.length
		);
		assert.equal(histogram.bins.at(-1)?.end, null);
		assert.equal(histogram.bins.at(-1)?.count, 1);
		assert.ok(histogram.cutoff <= 100);
		assert.equal(histogram.median, 50);
	});

	test('keeps typical clears spread out with more than five percent long outliers', () => {
		for (const typical of [
			Array.from({ length: 94 }, (_, i) => i % 51),
			[5, 10, 15, 20, 25, 30, 35, 40, 45]
		]) {
			const outliers = typical.length === 94 ? 6 : 1;
			const histogram = createClearTimeHistogram([...typical, ...Array(outliers).fill(36_000)]);
			assert.ok(histogram.binSize <= 10);
			assert.ok(histogram.bins.filter((bin) => bin.end !== null && bin.count > 0).length > 1);
			assert.equal(histogram.bins.at(-1)?.end, null);
			assert.equal(histogram.bins.at(-1)?.count, outliers);
			assert.equal(
				histogram.bins.reduce((total, bin) => total + bin.count, 0),
				typical.length + outliers
			);
			assert.equal(histogram.maxTime, 36_000);
		}
	});

	test('includes exact boundaries and the maximum in one bin each', () => {
		const histogram = createClearTimeHistogram([0, 10, 20, 30]);
		for (const time of [0, 10, 20, 30]) {
			assert.equal(histogram.bins[Math.floor(time / histogram.binSize)].count, 1);
		}
		assert.equal(
			histogram.bins.reduce((sum, bin) => sum + bin.count, 0),
			4
		);
		assert.equal(histogram.median, 15);
	});

	test('handles empty, invalid, and identical durations', () => {
		assert.equal(createClearTimeHistogram([]).total, 0);
		assert.equal(createClearTimeHistogram([NaN, Infinity, -1]).total, 0);
		assert.deepEqual(createClearTimeHistogram([0, 0]).bins, [{ start: 0, end: 1, count: 2 }]);
	});

	test('shows useful detail for fast clears', () => {
		const times = Array.from({ length: 40 }, (_, i) => 2 + i / 5);
		const histogram = createClearTimeHistogram(times);
		assert.ok(histogram.bins.filter((bin) => bin.count > 0).length >= 5);
		assert.equal(
			histogram.bins.reduce((sum, bin) => sum + bin.count, 0),
			times.length
		);
	});
});

describe('difficulty filtering', () => {
	test('compares only winning standard boards with matching size and mines', () => {
		const base = { win: true, mode: 'standard', setting: '9x9', total_mines: 10, time: 15 };
		const games = [
			base,
			{ ...base, setting: '16x16', total_mines: 40, time: 60 },
			{ ...base, setting: '30x16', total_mines: 99, time: 120 },
			{ ...base, setting: 'Custom', time: 5 },
			{ ...base, total_mines: 20, time: 25 },
			{ ...base, mode: 'time', time: 30 },
			{ ...base, win: false, time: 2 }
		];
		assert.deepEqual(getClearTimes(games, '9x9'), [15]);
		assert.deepEqual(getClearTimes(games, '16x16'), [60]);
		assert.deepEqual(getClearTimes(games, '30x16'), [120]);
		assert.deepEqual(getClearTimes(games, 'Custom'), []);
	});

	test('recognizes legacy preset names and missing historical mine counts', () => {
		const base = { win: true, mode: 'standard', setting: 'beginner', total_mines: 0, time: 15 };
		assert.deepEqual(
			getClearTimes([base, { ...base, total_mines: null, time: 20 }], '9x9'),
			[15, 20]
		);
		assert.deepEqual(getClearTimes([], '9x9'), []);
	});
});

describe('exact clear time labels', () => {
	test('preserves seconds in minute and hour boundaries', () => {
		for (const [seconds, expected] of [
			[0, '0s'],
			[80, '1m 20s'],
			[400, '6m 40s'],
			[3600, '1h'],
			[3661, '1h 1m 1s'],
			[36_000, '10h'],
			[60.001, '1m 0.001s']
		] as const) {
			assert.equal(formatClearDuration(seconds), expected);
		}
	});
});
