import { beforeEach, describe, it as test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
	insertGameResult,
	isLegacyMetricsSchemaError,
	resetGameResultsSchemaCache,
	toLegacyGameResultPayload,
	type GameResultInsertError,
	type GameResultsInsertClient,
	type LegacyRemoteGameResultPayload,
	type RemoteGameResultPayload
} from './gameResultInsert';

const samplePayload: RemoteGameResultPayload = {
	id: '134b1299-adcd-4d96-8d36-a301f0826ee9',
	created_at: '2026-11-24T19:00:00.000Z',
	user_id: null,
	mode: 'standard',
	setting: '9x9',
	win: true,
	time: 3.42,
	grids: 1,
	total_mines: 10,
	accuracy: 100,
	three_bv: 12,
	three_bv_per_sec: 3.51
};

function makeClient(responses: GameResultInsertError[]) {
	const inserted: Array<RemoteGameResultPayload | LegacyRemoteGameResultPayload> = [];
	const client: GameResultsInsertClient = {
		from() {
			return {
				async insert(row) {
					inserted.push(row);
					return { error: responses.shift() ?? null };
				}
			};
		}
	};
	return { client, inserted };
}

describe('gameResultInsert', () => {
	beforeEach(() => {
		resetGameResultsSchemaCache();
	});

	test('strips metrics columns and rounds time to >= 1s for legacy payload', () => {
		assert.deepEqual(toLegacyGameResultPayload(samplePayload), {
			id: samplePayload.id,
			created_at: samplePayload.created_at,
			user_id: null,
			mode: 'standard',
			setting: '9x9',
			win: true,
			time: 3,
			grids: 1,
			total_mines: 10,
			accuracy: 100
		});
		assert.equal(toLegacyGameResultPayload({ ...samplePayload, time: 0.2 }).time, 1);
	});

	test('inserts full payload when remote schema supports metrics', async () => {
		const { client, inserted } = makeClient([null]);
		const res = await insertGameResult(client, samplePayload);
		assert.equal(res.error, null);
		assert.equal(res.usedLegacyFallback, false);
		assert.equal(inserted.length, 1);
		assert.deepEqual(inserted[0], samplePayload);
	});

	test('falls back on missing three_bv column and caches legacy mode', async () => {
		const { client, inserted } = makeClient([
			{
				code: 'PGRST204',
				message: "Could not find the 'three_bv' column of 'game_results' in the schema cache"
			},
			null,
			null
		]);

		const first = await insertGameResult(client, samplePayload);
		assert.equal(first.error, null);
		assert.equal(first.usedLegacyFallback, true);
		assert.equal(inserted.length, 2);
		assert.equal('three_bv' in inserted[1], false);
		assert.equal(inserted[1].time, 3);

		const second = await insertGameResult(client, { ...samplePayload, time: 11.6 });
		assert.equal(second.error, null);
		assert.equal(second.usedLegacyFallback, true);
		assert.equal(inserted.length, 3);
		assert.equal(inserted[2].time, 12);
	});

	test('falls back on integer syntax error for fractional time', async () => {
		const { client, inserted } = makeClient([
			{ code: '22P02', message: 'invalid input syntax for type integer: "3.42"' },
			null
		]);

		const res = await insertGameResult(client, samplePayload);
		assert.equal(res.error, null);
		assert.equal(res.usedLegacyFallback, true);
		assert.equal(inserted.length, 2);
		assert.equal(inserted[1].time, 3);
	});

	test('does not fall back on unrelated errors', async () => {
		const authError = { code: '42501', message: 'new row violates row-level security policy' };
		const { client, inserted } = makeClient([authError]);

		const res = await insertGameResult(client, samplePayload);
		assert.deepEqual(res.error, authError);
		assert.equal(res.usedLegacyFallback, false);
		assert.equal(inserted.length, 1);
		assert.equal(
			isLegacyMetricsSchemaError({ code: '22P02', message: 'invalid input syntax for type uuid' }),
			false
		);
	});
});
