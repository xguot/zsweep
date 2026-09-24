import type { PostgrestError } from '@supabase/supabase-js';

export const PAGE_SIZE = 1000;

type PageResult<T> = { data: T[] | null; error: PostgrestError | null };

export async function fetchAllRows<T>(
	fetchPage: (from: number, to: number) => PromiseLike<PageResult<T>>,
	total?: number
): Promise<T[]> {
	if (total !== undefined) {
		const pages = Math.ceil(total / PAGE_SIZE);
		const results = await Promise.all(
			Array.from({ length: pages }, (_, i) => fetchPage(i * PAGE_SIZE, (i + 1) * PAGE_SIZE - 1))
		);
		const failed = results.find((r) => r.error);
		if (failed) throw failed.error;
		return results.flatMap((r) => r.data ?? []);
	}

	const rows: T[] = [];
	for (let from = 0; ; from += PAGE_SIZE) {
		const { data, error } = await fetchPage(from, from + PAGE_SIZE - 1);
		if (error) throw error;
		const page = data ?? [];
		rows.push(...page);
		if (page.length < PAGE_SIZE) return rows;
	}
}
