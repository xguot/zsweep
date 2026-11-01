import type { StoredGameResult } from '../supabase';

function legacyKey(result: StoredGameResult): string {
	return JSON.stringify([
		result.user_id,
		result.mode,
		result.setting,
		result.win,
		result.time,
		result.grids,
		result.total_mines,
		result.accuracy
	]);
}

export function mergeGameResults(
	remote: StoredGameResult[],
	local: StoredGameResult[],
	userId: string
): StoredGameResult[] {
	const results = new Map(
		local.filter((result) => result.user_id === userId).map((result) => [result.id, result])
	);
	const legacyRemote = new Map<string, StoredGameResult[]>();
	const sharedIds = new Set<string>();
	for (const result of remote) {
		if (results.has(result.id)) sharedIds.add(result.id);
		if (result.replay_id || sharedIds.has(result.id)) continue;
		const key = legacyKey(result);
		const group = legacyRemote.get(key) ?? [];
		group.push(result);
		legacyRemote.set(key, group);
	}
	const matches = new Map<string, StoredGameResult[]>();
	const matchCounts = new Map<string, number>();
	// older uploads used unrelated ids; only collapse unambiguous copies close in time
	for (const result of results.values()) {
		if (result.replay_version === 1 || sharedIds.has(result.id)) continue;
		const candidates = (legacyRemote.get(legacyKey(result)) ?? []).filter((candidate) => {
			const delay = Date.parse(candidate.created_at) - Date.parse(result.created_at);
			return delay >= 0 && delay <= 5000;
		});
		matches.set(result.id, candidates);
		for (const candidate of candidates) {
			matchCounts.set(candidate.id, (matchCounts.get(candidate.id) ?? 0) + 1);
		}
	}
	for (const [id, candidates] of matches) {
		if (candidates.length === 1 && matchCounts.get(candidates[0].id) === 1) results.delete(id);
	}
	for (const result of remote) results.set(result.id, result);
	return [...results.values()].sort((a, b) => b.created_at.localeCompare(a.created_at));
}
