// Caps that bound the service so a single request or a flood of batches can't
// exhaust memory or stall the demo. Env-overridable so deploy can tune them
// without a code change; defaults are sized for the bundled showcase.

function intFromEnv(name: string, fallback: number): number {
	const raw = process.env[name];
	if (raw === undefined) {
		return fallback;
	}
	const parsed = Number.parseInt(raw, 10);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const MAX_PRODUCTS_PER_BATCH = intFromEnv("MAX_PRODUCTS_PER_BATCH", 10);

export const MAX_CONCURRENT_BATCHES = intFromEnv("MAX_CONCURRENT_BATCHES", 5);

// Express body-parser limit. Base64 images inflate ~33%, so a handful of small
// sample images fits comfortably under this.
export const MAX_BODY_SIZE = process.env.MAX_BODY_SIZE ?? "2mb";

// Bounded fan-out when generating posts for the product images in one batch.
export const ITEM_CONCURRENCY = intFromEnv("ITEM_CONCURRENCY", 4);

// Mock mode is the default until provider keys are supplied. This slice only
// implements mock mode; the keys are read here so the seam exists.
export const MOCK_MODE = !process.env.GEMINI_API_KEY && !process.env.OPENAI_API_KEY;
