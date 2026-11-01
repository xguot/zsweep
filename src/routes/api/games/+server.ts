import { createClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private';
import { supabaseUrl } from '$lib/supabase';
import { submitGame } from '$lib/server/submitGame';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	if (!env.SUPABASE_SERVICE_ROLE_KEY) {
		return Response.json({ error: 'Result submission is unavailable.' }, { status: 503 });
	}
	const supabase = createClient(supabaseUrl, env.SUPABASE_SERVICE_ROLE_KEY, {
		auth: { persistSession: false, autoRefreshToken: false }
	});
	return submitGame(request, supabase);
};
