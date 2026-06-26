import type { PlatformConfig } from "./platform-config.mts";
import type { ImageInput } from "./schema.mts";

// Fixed, per-platform generation params (aspect ratio, hashtag count, caption
// length). Reusing PlatformConfig keeps one source of truth for platform shape.
export type GenerateParams = PlatformConfig;

// What a provider returns for one product image: the raw image plus the text
// that accompanies it. The layer above turns imageBytes into a servable URL.
export type GeneratedImage = {
	imageBytes: Uint8Array;
	mimeType: string;
	caption: string;
	hashtags: string[];
};

// The single seam through which all image generation flows. Mock mode injects a
// stub implementation; the real Gemini/OpenAI providers implement the same shape
// so retry/failover logic above stays provider-agnostic.
export type ImageProvider = {
	readonly name: string;
	// Extract one text style spec for a batch from its reference images. Runs once
	// per batch (the result is reused for every product image), through the same
	// retry/failover path as generate. Zero references yields the neutral fallback.
	describeStyle(references: ImageInput[]): Promise<string>;
	generate(
		product: ImageInput,
		references: ImageInput[],
		styleSpec: string,
		params: GenerateParams,
	): Promise<GeneratedImage>;
};

// Node system error codes that indicate a transient network failure worth a retry.
const NETWORK_ERROR_CODES = new Set([
	"ECONNRESET",
	"ECONNREFUSED",
	"ETIMEDOUT",
	"ENOTFOUND",
	"EAI_AGAIN",
	"EPIPE",
	"ENETUNREACH",
]);

// A transient error is worth retrying: 5xx, 429/408, timeouts, and network
// errors. Any other 4xx is the caller's fault (bad request, auth) and must fail
// fast without retry. Unknown errors are treated as non-transient.
export function isTransientError(error: unknown): boolean {
	if (typeof error !== "object" || error === null) {
		return false;
	}
	const e = error as { name?: string; status?: number; code?: string };
	if (e.name === "AbortError" || e.name === "TimeoutError") {
		return true;
	}
	if (typeof e.status === "number") {
		return e.status === 408 || e.status === 429 || e.status >= 500;
	}
	if (typeof e.code === "string") {
		return NETWORK_ERROR_CODES.has(e.code);
	}
	return false;
}
