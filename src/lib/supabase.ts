import { createClient, type User } from '@supabase/supabase-js';
import { browser } from '$app/environment';
import { env } from '$env/dynamic/public';

const DEFAULT_SUPABASE_URL = 'https://mtelmxyozxapwuchenjo.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY =
	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10ZWxteHlvenhhcHd1Y2hlbmpvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc1MDk1ODcsImV4cCI6MjA4MzA4NTU4N30.prcQ7cnpBXYICfIFMaGdcCRfA91VqBhPN-Dxn2EVr2Q';

export const supabaseUrl = env.PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL;
export const supabaseAnonKey = env.PUBLIC_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface StoredGameResult {
	id: string;
	user_id: string | null;
	mode: 'standard' | 'time' | string;
	setting: string;
	win: boolean;
	time: number;
	grids: number;
	total_mines: number;
	accuracy: number;
	three_bv?: number;
	three_bv_per_sec?: number;
	replay_version?: number;
	replay_id?: string | null;
	created_at: string;
}

const LOCAL_RESULTS_KEY = 'zsweep_game_history';

export function getLocalGameResults(): StoredGameResult[] {
	if (!browser) return [];
	try {
		const raw = localStorage.getItem(LOCAL_RESULTS_KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw);
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}

export function saveLocalGameResult(
	result: Omit<StoredGameResult, 'id' | 'created_at'>
): StoredGameResult {
	const entry: StoredGameResult = {
		...result,
		id:
			typeof crypto !== 'undefined' && 'randomUUID' in crypto
				? crypto.randomUUID()
				: 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
						const random = Math.floor(Math.random() * 16);
						return (char === 'x' ? random : (random & 3) | 8).toString(16);
					}),
		created_at: new Date().toISOString()
	};

	if (browser) {
		try {
			const existing = getLocalGameResults();
			const updated = [entry, ...existing].slice(0, 500);
			localStorage.setItem(LOCAL_RESULTS_KEY, JSON.stringify(updated));
		} catch (e) {
			console.error('Failed to save local game result:', e);
		}
	}

	return entry;
}

export function setLocalGameResultUser(id: string, userId: string | null) {
	if (!browser) return;
	try {
		const results = getLocalGameResults().map((result) =>
			result.id === id ? { ...result, user_id: userId } : result
		);
		localStorage.setItem(LOCAL_RESULTS_KEY, JSON.stringify(results));
	} catch (error) {
		console.error('Failed to update local game result:', error);
	}
}

/**
 * Ensures a row exists in `public.profiles` for the authenticated Supabase user
 * so foreign-key inserts to `public.game_results` and profile queries never fail.
 */
export async function ensureUserProfile(user: User) {
	const fallbackUsername =
		user.user_metadata?.full_name ||
		user.user_metadata?.username ||
		user.user_metadata?.user_name ||
		user.email?.split('@')[0] ||
		'sweeper';
	const avatarUrl = user.user_metadata?.avatar_url || '';

	const { data: existing, error: selectErr } = await supabase
		.from('profiles')
		.select('*')
		.eq('id', user.id)
		.maybeSingle();

	if (!selectErr && existing) {
		return existing;
	}

	const newProfile = {
		id: user.id,
		username: fallbackUsername,
		avatar_url: avatarUrl,
		updated_at: new Date().toISOString()
	};

	const { data: inserted, error: upsertErr } = await supabase
		.from('profiles')
		.upsert(newProfile, { onConflict: 'id' })
		.select('*')
		.maybeSingle();

	if (upsertErr) {
		// Return a synthesized profile object so the UI can still render seamlessly
		return {
			...newProfile,
			created_at: user.created_at || new Date().toISOString()
		};
	}

	return (
		inserted || {
			...newProfile,
			created_at: user.created_at || new Date().toISOString()
		}
	);
}
