import {
	type GenerateParams,
	type GeneratedImage,
	type ImageProvider,
	isTransientError,
} from "./provider.mts";
import type { ImageInput } from "./schema.mts";

// Tunables for the resilience policy. sleep/random are injectable so tests run
// without real delays and with deterministic jitter.
export type ResilienceOptions = {
	maxAttempts?: number;
	baseDelayMs?: number;
	maxDelayMs?: number;
	timeoutMs?: number;
	sleep?: (ms: number) => Promise<void>;
	random?: () => number;
};

type ResolvedOptions = Required<ResilienceOptions>;

const DEFAULT_OPTIONS: ResolvedOptions = {
	maxAttempts: 3,
	baseDelayMs: 500,
	maxDelayMs: 8000,
	timeoutMs: 60_000,
	sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
	random: Math.random,
};

export type FailoverResult = {
	image: GeneratedImage;
	provider: string;
};

function resolveOptions(options: ResilienceOptions): ResolvedOptions {
	return { ...DEFAULT_OPTIONS, ...options };
}

// Exponential backoff with full jitter: each retry waits a random amount in
// [0, base * 2^(attempt-1)], capped at maxDelayMs, so concurrent retries spread.
function backoffDelay(attempt: number, opts: ResolvedOptions): number {
	const ceiling = Math.min(opts.maxDelayMs, opts.baseDelayMs * 2 ** (attempt - 1));
	return Math.floor(ceiling * opts.random());
}

// Reject if the call outruns the per-call budget. A timeout is transient, so it
// feeds back into the retry loop like any other transient failure.
function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
	let timer: ReturnType<typeof setTimeout>;
	const timeout = new Promise<never>((_resolve, reject) => {
		timer = setTimeout(() => {
			const error = new Error(`provider call timed out after ${timeoutMs}ms`);
			error.name = "TimeoutError";
			reject(error);
		}, timeoutMs);
	});
	return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

type GenerateArgs = [ImageInput, ImageInput[], string, GenerateParams];

// One provider, up to maxAttempts: retry transient failures with backoff, fail
// fast on anything non-transient, and give up once the attempt budget is spent.
async function callWithRetry(
	provider: ImageProvider,
	args: GenerateArgs,
	opts: ResolvedOptions,
): Promise<GeneratedImage> {
	let lastError: unknown;
	for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
		try {
			return await withTimeout(provider.generate(...args), opts.timeoutMs);
		} catch (error) {
			lastError = error;
			if (!isTransientError(error) || attempt === opts.maxAttempts) {
				throw error;
			}
			await opts.sleep(backoffDelay(attempt, opts));
		}
	}
	// Unreachable: the loop either returns or throws, but satisfies the type.
	throw lastError;
}

// Try each provider in order with its own retry budget. The first to succeed
// wins; if the primary exhausts its retries we fail over to the next. If every
// provider fails, the last error propagates so the item records why.
export async function generateWithFailover(
	providers: ImageProvider[],
	product: ImageInput,
	references: ImageInput[],
	styleSpec: string,
	params: GenerateParams,
	options: ResilienceOptions = {},
): Promise<FailoverResult> {
	if (providers.length === 0) {
		throw new Error("no image providers configured");
	}
	const opts = resolveOptions(options);
	const args: GenerateArgs = [product, references, styleSpec, params];
	let lastError: unknown;
	for (const provider of providers) {
		try {
			const image = await callWithRetry(provider, args, opts);
			return { image, provider: provider.name };
		} catch (error) {
			lastError = error;
		}
	}
	throw lastError;
}
