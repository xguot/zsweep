import { randomBytes, randomInt, randomUUID } from 'node:crypto';
import {
	PRESETS,
	RULES_VERSION,
	applyMove,
	gameMetrics,
	newGame,
	parseAction,
	publicGame,
	replay,
	type Action,
	type Game,
	type Preset,
	type Variant
} from '../../game/anticheat/engine';

const TTL = 30 * 60_000;
const MAX_SESSIONS = 1_000;
type Session = {
	id: string;
	owner: string;
	variant: Variant;
	preset: Preset;
	seed: number;
	first: Action;
	started: number;
	finished?: number;
	game: Game;
	moves: Action[];
	submission?: string;
};

export class SessionError extends Error {
	constructor(
		public status: number,
		message: string
	) {
		super(message);
	}
}

// Deliberately local-dev only: production needs durable sessions and atomic writes.
export class Sessions {
	private sessions = new Map<string, Session>();

	start(owner: string, variant: unknown, preset: unknown, value: unknown, now = Date.now()) {
		for (const [id, session] of this.sessions) {
			if (now - session.started >= TTL) this.sessions.delete(id);
		}
		if (variant !== 'replay' && variant !== 'server')
			throw new SessionError(400, 'Invalid variant');
		if (typeof preset !== 'string' || !Object.hasOwn(PRESETS, preset)) {
			throw new SessionError(400, 'Invalid board size');
		}
		const recent = [...this.sessions.values()].filter(
			(s) => s.owner === owner && now - s.started < 60_000
		);
		if (recent.length >= 30 || this.sessions.size >= MAX_SESSIONS) {
			throw new SessionError(429, 'Too many test games. Try again in a minute.');
		}
		const first = parseAction(value);
		const seed = randomBytes(4).readUInt32LE();
		const session: Session = {
			id: randomUUID(),
			owner,
			variant,
			preset: preset as Preset,
			seed,
			first,
			started: now,
			game: newGame(
				preset as Preset,
				seed,
				first,
				variant === 'server' ? () => randomInt(0x100000000) / 0x100000000 : undefined
			),
			moves: []
		};
		if (session.game.status !== 'playing') session.finished = now;
		this.sessions.set(session.id, session);
		return { ...this.view(session), ...(variant === 'replay' ? { seed } : {}) };
	}

	private get(owner: string, id: string, now: number) {
		const session = this.sessions.get(id);
		if (!session || session.owner !== owner) throw new SessionError(404, 'Test game not found');
		if (now - session.started >= TTL) {
			this.sessions.delete(id);
			throw new SessionError(410, 'Test game expired. Start a new board.');
		}
		return session;
	}

	move(owner: string, id: string, revision: unknown, value: unknown, now = Date.now()) {
		const session = this.get(owner, id, now);
		if (session.variant !== 'server')
			throw new SessionError(409, 'This game uses replay validation');
		if (!Number.isInteger(revision) || (revision as number) < 0)
			throw new SessionError(400, 'Invalid revision');
		const action = parseAction(value);
		const index = revision as number;
		if (
			index < session.moves.length &&
			JSON.stringify(session.moves[index]) === JSON.stringify(action)
		) {
			return this.view(session);
		}
		if (index !== session.moves.length) throw new SessionError(409, 'Move revision does not match');
		applyMove(session.game, action);
		session.moves.push(action);
		if (session.game.status !== 'playing') session.finished = now;
		return this.view(session);
	}

	finish(owner: string, id: string, values: unknown, now = Date.now()) {
		const session = this.get(owner, id, now);
		if (session.variant !== 'replay')
			throw new SessionError(409, 'Server games finish automatically');
		if (!Array.isArray(values) || values.length > 9_999)
			throw new SessionError(400, 'Invalid replay length');
		const moves = values.map(parseAction);
		const submission = JSON.stringify(moves);
		if (session.submission !== undefined) {
			if (session.submission !== submission) throw new SessionError(409, 'Game already submitted');
			return this.view(session);
		}
		const game = replay(session.preset, session.seed, session.first, moves);
		session.game = game;
		session.moves = moves;
		session.submission = submission;
		session.finished ??= now;
		return this.view(session);
	}

	private view(session: Session) {
		return {
			id: session.id,
			variant: session.variant,
			rulesVersion: RULES_VERSION,
			revision: session.moves.length,
			game: publicGame(session.game),
			...(session.finished === undefined
				? {}
				: {
						result: { ...gameMetrics(session.game), elapsedMs: session.finished - session.started }
					})
		};
	}
}

export type SessionView = ReturnType<Sessions['start']>;
export const sessions = new Sessions();
