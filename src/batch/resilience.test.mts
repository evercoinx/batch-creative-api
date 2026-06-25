import { describe, expect, it } from "vitest";
import type { GenerateParams, GeneratedImage, ImageProvider } from "./provider.mts";
import { generateWithFailover, type ResilienceOptions } from "./resilience.mts";
import type { ImageInput } from "./schema.mts";

const PRODUCT: ImageInput = { preset: "lamp" };
const PARAMS: GenerateParams = { aspectRatio: "1:1", hashtagCount: 5, captionMaxLength: 2200 };

// No real waiting and deterministic jitter, so the tests are fast and stable.
const FAST: ResilienceOptions = { sleep: async () => {}, random: () => 0 };

function image(caption: string): GeneratedImage {
	return { imageBytes: new Uint8Array([1]), mimeType: "image/png", caption, hashtags: [] };
}

function httpError(status: number): Error {
	return Object.assign(new Error(`HTTP ${status}`), { status });
}

// A provider driven by a script of outcomes, one per call. Each entry is either
// an error to throw or a GeneratedImage to return; it records how many times it
// was called so tests can prove retry/failover happened.
class ScriptedProvider implements ImageProvider {
	calls = 0;
	constructor(
		readonly name: string,
		private readonly script: Array<Error | GeneratedImage>,
	) {}

	async generate(): Promise<GeneratedImage> {
		const outcome = this.script[this.calls] ?? this.script[this.script.length - 1];
		this.calls++;
		if (outcome instanceof Error) {
			throw outcome;
		}
		return outcome as GeneratedImage;
	}
}

function run(providers: ImageProvider[]) {
	return generateWithFailover(providers, PRODUCT, [], "style", PARAMS, FAST);
}

describe("generateWithFailover", () => {
	it("retries a transient error then succeeds on the same provider", async () => {
		const provider = new ScriptedProvider("primary", [httpError(503), image("ok")]);
		const result = await run([provider]);
		expect(result.image.caption).toBe("ok");
		expect(result.provider).toBe("primary");
		expect(provider.calls).toBe(2);
	});

	it("does not retry a 4xx error — fails fast", async () => {
		const provider = new ScriptedProvider("primary", [httpError(400), image("never")]);
		await expect(run([provider])).rejects.toThrow("HTTP 400");
		expect(provider.calls).toBe(1);
	});

	it("gives up after the retry budget on persistent transient errors", async () => {
		const provider = new ScriptedProvider("primary", [httpError(500)]);
		await expect(run([provider])).rejects.toThrow("HTTP 500");
		expect(provider.calls).toBe(3);
	});

	it("fails over to the secondary when the primary exhausts its retries", async () => {
		const primary = new ScriptedProvider("primary", [httpError(503)]);
		const secondary = new ScriptedProvider("secondary", [image("from-fallback")]);
		const result = await run([primary, secondary]);
		expect(result.provider).toBe("secondary");
		expect(result.image.caption).toBe("from-fallback");
		expect(primary.calls).toBe(3);
		expect(secondary.calls).toBe(1);
	});

	it("fails over to the secondary on a non-transient primary error without retrying it", async () => {
		// A 4xx fails fast on the primary (no retry), but the fallback still gets a
		// shot — a bad key/quota on one provider shouldn't sink the batch.
		const primary = new ScriptedProvider("primary", [httpError(401)]);
		const secondary = new ScriptedProvider("secondary", [image("from-fallback")]);
		const result = await run([primary, secondary]);
		expect(result.provider).toBe("secondary");
		expect(primary.calls).toBe(1);
		expect(secondary.calls).toBe(1);
	});

	it("propagates the last error when every provider fails", async () => {
		const primary = new ScriptedProvider("primary", [httpError(503)]);
		const secondary = new ScriptedProvider("secondary", [httpError(502)]);
		await expect(run([primary, secondary])).rejects.toThrow("HTTP 502");
		expect(primary.calls).toBe(3);
		expect(secondary.calls).toBe(3);
	});

	it("retries on a per-call timeout", async () => {
		let calls = 0;
		const provider: ImageProvider = {
			name: "slow",
			async generate() {
				calls++;
				if (calls === 1) {
					// Never settles within the budget on the first attempt.
					return new Promise<GeneratedImage>(() => {});
				}
				return image("after-timeout");
			},
		};
		const result = await generateWithFailover(provider ? [provider] : [], PRODUCT, [], "s", PARAMS, {
			...FAST,
			timeoutMs: 10,
		});
		expect(result.image.caption).toBe("after-timeout");
		expect(calls).toBe(2);
	});

	it("retries network errors identified by code", async () => {
		const netError = Object.assign(new Error("socket hang up"), { code: "ECONNRESET" });
		const provider = new ScriptedProvider("primary", [netError, image("recovered")]);
		const result = await run([provider]);
		expect(result.image.caption).toBe("recovered");
		expect(provider.calls).toBe(2);
	});

	it("throws when no providers are configured", async () => {
		await expect(run([])).rejects.toThrow("no image providers configured");
	});
});
