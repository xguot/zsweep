export interface RemoteGameResultPayload {
	id: string;
	created_at: string;
	user_id: string | null;
	mode: string;
	setting: string;
	win: boolean;
	time: number;
	grids: number;
	total_mines: number;
	accuracy: number;
	three_bv?: number;
	three_bv_per_sec?: number;
}

export interface LegacyRemoteGameResultPayload {
	id: string;
	created_at: string;
	user_id: string | null;
	mode: string;
	setting: string;
	win: boolean;
	time: number;
	grids: number;
	total_mines: number;
	accuracy: number;
}

export type GameResultInsertError = {
	code?: string | null;
	message?: string | null;
	details?: string | null;
	hint?: string | null;
} | null;

export interface GameResultsInsertClient {
	from(table: 'game_results'): {
		insert(
			row: RemoteGameResultPayload | LegacyRemoteGameResultPayload
		): PromiseLike<{ error: GameResultInsertError }>;
	};
}

let useLegacySchema = false;

export function resetGameResultsSchemaCache() {
	useLegacySchema = false;
}

export function toLegacyGameResultPayload(
	payload: RemoteGameResultPayload
): LegacyRemoteGameResultPayload {
	const roundedTime = Number.isFinite(payload.time) ? Math.max(1, Math.round(payload.time)) : 1;
	return {
		id: payload.id,
		created_at: payload.created_at,
		user_id: payload.user_id,
		mode: payload.mode,
		setting: payload.setting,
		win: payload.win,
		time: roundedTime,
		grids: payload.grids,
		total_mines: payload.total_mines,
		accuracy: payload.accuracy
	};
}

export function isLegacyMetricsSchemaError(error: GameResultInsertError): boolean {
	if (!error) return false;
	const code = error.code ?? '';
	const text = `${error.message ?? ''} ${error.details ?? ''} ${error.hint ?? ''}`.toLowerCase();

	if (code === 'PGRST204' || code === '42703') {
		return text.includes('three_bv') || text.includes('three_bv_per_sec');
	}
	if (code === '22P02') {
		return text.includes('integer');
	}
	return (
		text.includes('three_bv') ||
		text.includes('three_bv_per_sec') ||
		text.includes('invalid input syntax for type integer')
	);
}

export async function insertGameResult(
	client: GameResultsInsertClient,
	payload: RemoteGameResultPayload
): Promise<{ error: GameResultInsertError; usedLegacyFallback: boolean }> {
	if (useLegacySchema) {
		const { error } = await client.from('game_results').insert(toLegacyGameResultPayload(payload));
		return { error, usedLegacyFallback: true };
	}

	const { error } = await client.from('game_results').insert(payload);
	if (!error) {
		return { error: null, usedLegacyFallback: false };
	}
	if (!isLegacyMetricsSchemaError(error)) {
		return { error, usedLegacyFallback: false };
	}

	useLegacySchema = true;
	const { error: fallbackError } = await client
		.from('game_results')
		.insert(toLegacyGameResultPayload(payload));
	return { error: fallbackError, usedLegacyFallback: true };
}
