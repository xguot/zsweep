import type { SupabaseClient } from '@supabase/supabase-js';
import { isDeepStrictEqual } from 'node:util';
import { MAX_REPLAY_BYTES } from '../game/recording';
import { validateReplay } from './validateReplay';

function respond(status: number, body: object) {
	return Response.json(body, { status });
}

function isShallowJson(value: unknown, depth = 0): boolean {
	if (typeof value !== 'object' || value === null) return true;
	if (depth >= 32) return false;
	return Object.values(value).every((child) => isShallowJson(child, depth + 1));
}

export async function submitGame(request: Request, supabase: SupabaseClient): Promise<Response> {
	const authorization = request.headers.get('authorization');
	if (!authorization?.startsWith('Bearer '))
		return respond(401, { error: 'Sign in to submit a game.' });
	const { data, error } = await supabase.auth.getUser(authorization.slice(7));
	if (error || !data.user) return respond(401, { error: 'Invalid authorization.' });
	const userId = data.user.id;
	if (!request.headers.get('content-type')?.startsWith('application/json')) {
		return respond(415, { error: 'Expected application/json.' });
	}
	const reader = request.body?.getReader();
	if (!reader) return respond(400, { error: 'Missing submission.' });
	const chunks: Uint8Array[] = [];
	let size = 0;
	while (true) {
		const { value, done } = await reader.read();
		if (done) break;
		size += value.byteLength;
		if (size > MAX_REPLAY_BYTES) {
			await reader.cancel();
			return respond(413, { error: 'Replay is too large.' });
		}
		chunks.push(value);
	}
	const bytes = new Uint8Array(size);
	let offset = 0;
	for (const chunk of chunks) {
		bytes.set(chunk, offset);
		offset += chunk.byteLength;
	}
	let submission: unknown;
	try {
		submission = JSON.parse(new TextDecoder().decode(bytes));
	} catch {
		return respond(400, { error: 'Invalid JSON.' });
	}
	if (typeof submission !== 'object' || submission === null || Array.isArray(submission)) {
		return respond(400, { error: 'Expected a submission object.' });
	}
	if (!isShallowJson(submission))
		return respond(400, { error: 'Submission is nested too deeply.' });
	const id = (submission as { id?: unknown }).id;
	if (
		typeof id !== 'string' ||
		!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
	) {
		return respond(400, { error: 'A game UUID is required.' });
	}
	const validation = validateReplay(submission);
	const { error: replayError } = await supabase
		.from('game_replays')
		.insert({
			id,
			user_id: userId,
			submission,
			validation_error: validation.valid ? null : validation.error
		})
		.select('id')
		.single();
	if (replayError) {
		if (replayError.code !== '23505') {
			console.error('Error retaining replay:', replayError);
			return respond(500, { error: 'Could not retain replay.' });
		}
		const { data: existing, error: existingError } = await supabase
			.from('game_replays')
			.select('id, submission, validation_error')
			.eq('id', id)
			.eq('user_id', userId)
			.maybeSingle();
		if (existingError) return respond(500, { error: 'Could not read retained replay.' });
		if (
			!existing ||
			existing.validation_error !== null ||
			!validation.valid ||
			!isDeepStrictEqual(existing.submission, submission)
		) {
			return respond(409, { error: 'Game ID belongs to a different or rejected submission.' });
		}
	}
	if (!validation.valid) return respond(422, { error: validation.error, replay_id: id });
	const { data: result, error: resultError } = await supabase
		.from('game_results')
		.insert({ ...validation.result, id, user_id: userId, replay_id: id })
		.select('id')
		.single();
	if (resultError) {
		if (resultError.code === '23505') {
			const { data: existing, error: existingError } = await supabase
				.from('game_results')
				.select('id')
				.eq('id', id)
				.eq('user_id', userId)
				.eq('replay_id', id)
				.maybeSingle();
			if (existingError) return respond(500, { error: 'Could not read saved result.' });
			if (existing) return respond(200, { id: existing.id });
			return respond(409, { error: 'Game ID already exists.' });
		}
		console.error('Error saving validated result:', resultError);
		return respond(500, { error: 'Could not save result.' });
	}
	return respond(201, { id: result.id });
}
