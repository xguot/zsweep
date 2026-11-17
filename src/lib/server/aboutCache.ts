export function hasSupabaseSession(cookies: { name: string }[]) {
	return cookies.some(({ name }) => /^sb-.*-auth-token(?:\.\d+)?$/.test(name));
}

export function createAboutCache<T>(ttl: number, isValid: (value: T) => boolean, now = Date.now) {
	let cached: { value: T; expires: number } | undefined;
	let pending: Promise<T> | undefined;

	return (load: () => Promise<T>): Promise<T> => {
		if (cached && now() < cached.expires) return Promise.resolve(cached.value);
		if (pending) return pending;

		pending = load()
			.then((value) => {
				if (isValid(value)) cached = { value, expires: now() + ttl };
				return value;
			})
			.finally(() => {
				pending = undefined;
			});
		return pending;
	};
}
