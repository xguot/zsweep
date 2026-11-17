import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { createAboutCache, hasSupabaseSession } from './aboutCache';

describe('about page cache', () => {
	it('identifies whole and chunked supabase session cookies', () => {
		assert.equal(hasSupabaseSession([{ name: 'theme' }]), false);
		assert.equal(hasSupabaseSession([{ name: 'sb-project-auth-token' }]), true);
		assert.equal(hasSupabaseSession([{ name: 'sb-project-auth-token.0' }]), true);
	});
	it('reuses successful loads, coalesces concurrent requests, and expires', async () => {
		let time = 0;
		let calls = 0;
		const get = createAboutCache(
			60,
			() => true,
			() => time
		);
		const load = async () => ++calls;
		assert.deepEqual(await Promise.all([get(load), get(load)]), [1, 1]);
		time = 59;
		assert.equal(await get(load), 1);
		time = 60;
		assert.equal(await get(load), 2);
	});

	it('does not cache failed or incomplete loads', async () => {
		const get = createAboutCache(60, (value: number) => value > 0);
		await assert.rejects(
			get(async () => {
				throw new Error('failed');
			})
		);
		assert.equal(await get(async () => 0), 0);
		assert.equal(await get(async () => 1), 1);
		assert.equal(await get(async () => 2), 1);
	});
});
