export async function pollUntil<T>({
	check,
	isDone,
	intervalMs = 2000,
	maxMs = 180000,
	backoffJitter = true,
}: {
	check: () => Promise<T>;
	isDone: (r: T) => boolean;
	intervalMs?: number;
	maxMs?: number;
	backoffJitter?: boolean;
}): Promise<T> {
	const start = Date.now();
	let attempt = 0;
	let res: T;

	while (true) {
		attempt++;
		res = await check();
		if (isDone(res)) return res;

		if (Date.now() - start >= maxMs) return res;
		const jitter = backoffJitter ? Math.min(300, attempt * 30) : 0;
		await new Promise((r) => setTimeout(r, intervalMs + jitter));
	}
}
