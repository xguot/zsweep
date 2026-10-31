import { dev } from '$app/environment';
import { error, json } from '@sveltejs/kit';
import { SessionError, sessions } from '$lib/server/anticheat/sessions';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, cookies, url }) => {
	if (!dev) error(404, 'Not found');
	if (request.headers.get('origin') !== url.origin) error(403, 'Same-origin requests only');
	const text = await request.text();
	if (text.length > 600_000) error(413, 'Replay is too large');
	let body;
	try {
		body = JSON.parse(text);
	} catch {
		error(400, 'Invalid JSON');
	}
	if (!body || typeof body !== 'object') error(400, 'Invalid request');
	let owner = cookies.get('anticheat-test');
	if (!owner && body.operation === 'start') {
		owner = crypto.randomUUID();
	}
	if (!owner) error(401, 'Start a test game first');
	try {
		let result;
		switch (body.operation) {
			case 'start':
				result = sessions.start(owner, body.variant, body.preset, body.first);
				break;
			case 'move':
				result = sessions.move(owner, body.id, body.revision, body.action);
				break;
			case 'finish':
				result = sessions.finish(owner, body.id, body.moves);
				break;
			default:
				error(400, 'Invalid operation');
		}
		if (body.operation === 'start') {
			cookies.set('anticheat-test', owner, {
				path: '/api/anticheat',
				httpOnly: true,
				sameSite: 'strict',
				secure: url.protocol === 'https:',
				maxAge: 1800
			});
		}
		return json(result, { headers: { 'cache-control': 'no-store' } });
	} catch (cause) {
		if (cause instanceof SessionError) error(cause.status, cause.message);
		if (cause instanceof Error) error(400, cause.message);
		throw cause;
	}
};
