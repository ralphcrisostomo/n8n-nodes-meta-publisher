export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const jitter = (ms: number) => ms + Math.floor(Math.random() * 300);

export async function retry<T>(
	fn: () => Promise<T>,
	{
		tries = 6,
		delayMs = 1000,
		factor = 1.6,
	}: { tries?: number; delayMs?: number; factor?: number } = {},
): Promise<T> {
	let err: any;
	let wait = delayMs;
	for (let attempt = 1; attempt <= tries; attempt++) {
		try {
			console.log({ attempt, tries, wait });
			return await fn();
		} catch (e) {
			err = e;
			if (attempt === tries) break;
			await sleep(wait);
			wait = Math.ceil(wait * factor);
		}
	}
	throw err;
}
