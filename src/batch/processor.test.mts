import { describe, expect, it } from "vitest";
import { MockProvider } from "./mock-provider.mts";
import type { OutputWriter } from "./outputs.mts";
import { processBatch, type ProcessOptions } from "./processor.mts";
import type { GenerateParams, GeneratedImage, ImageProvider } from "./provider.mts";
import type { ImageInput, Platform } from "./schema.mts";
import { deriveStyleSpec } from "./style.mts";
import type { Batch } from "./types.mts";

// In-memory image sink: records what was written and returns a served-looking
// URL, so the lifecycle tests never touch disk. No real backoff waiting either.
const writeImage: OutputWriter = async (image, name) => `/outputs/${name}.${image.mimeType.split("/")[1]}`;
const FAST: ProcessOptions = { sleep: async () => {}, random: () => 0, writeImage };

function makeBatch(productCount: number, platform: Platform = "instagram"): Batch {
	const references: ImageInput[] = [];
	return {
		id: "test-batch",
		status: "pending",
		platform,
		references,
		styleSpec: deriveStyleSpec(references),
		items: Array.from({ length: productCount }, (_, i) => ({
			product: { preset: i % 2 === 0 ? "lamp" : "phone" } as ImageInput,
			status: "pending",
		})),
		createdAt: 0,
	};
}

function image(caption: string): GeneratedImage {
	return { imageBytes: new Uint8Array([1, 2, 3]), mimeType: "image/png", caption, hashtags: [] };
}

function httpError(status: number): Error {
	return Object.assign(new Error(`HTTP ${status}`), { status });
}

// A provider whose behaviour is decided per call by a function of the product.
class StubProvider implements ImageProvider {
	constructor(
		readonly name: string,
		private readonly handler: (product: ImageInput) => GeneratedImage,
	) {}

	async generate(product: ImageInput): Promise<GeneratedImage> {
		return this.handler(product);
	}
}

describe("processBatch", () => {
	it("transitions the batch pending -> running -> done", async () => {
		const batch = makeBatch(2);
		expect(batch.status).toBe("pending");
		await processBatch(batch, [new MockProvider()], FAST);
		expect(batch.status).toBe("done");
	});

	it("produces exactly one post per product image", async () => {
		const batch = makeBatch(3);
		await processBatch(batch, [new MockProvider()], FAST);
		const posts = batch.items.filter((item) => item.post !== undefined);
		expect(posts).toHaveLength(3);
		expect(batch.items.every((item) => item.status === "done")).toBe(true);
	});

	it("records the platform and producing provider in post meta", async () => {
		const batch = makeBatch(1, "x");
		await processBatch(batch, [new MockProvider()], FAST);
		const post = batch.items[0]?.post;
		expect(post?.platform).toBe("x");
		expect(post?.meta.provider).toBe("mock");
		// Image is persisted to outputs/ and surfaced as a served URL, keyed by
		// batch id + item index.
		expect(post?.imageUrl).toBe("/outputs/test-batch-0.jpeg");
	});

	it("reuses one style spec for every product image in the batch", async () => {
		const batch = makeBatch(3);
		batch.styleSpec = "shared batch style";
		const seenSpecs: string[] = [];
		const provider: ImageProvider = {
			name: "spec-probe",
			generate: async (_product, _references, styleSpec) => {
				seenSpecs.push(styleSpec);
				return image("ok");
			},
		};
		await processBatch(batch, [provider], FAST);
		expect(seenSpecs).toHaveLength(3);
		expect(seenSpecs.every((spec) => spec === "shared batch style")).toBe(true);
	});

	it("sets each item running before it is done", async () => {
		const batch = makeBatch(1);
		const seen: string[] = [];
		const provider = new StubProvider("probe", (product) => {
			seen.push(batch.items[0]!.status);
			return image(`for-${"preset" in product ? product.preset : "?"}`);
		});
		await processBatch(batch, [provider], FAST);
		expect(seen).toEqual(["running"]);
		expect(batch.items[0]!.status).toBe("done");
	});

	it("retries a transient provider error, then marks the item done", async () => {
		const batch = makeBatch(1);
		let calls = 0;
		const provider = new StubProvider("flaky", () => {
			calls++;
			if (calls === 1) {
				throw httpError(503);
			}
			return image("recovered");
		});
		await processBatch(batch, [provider], FAST);
		expect(batch.items[0]!.status).toBe("done");
		expect(batch.items[0]!.post?.caption).toBe("recovered");
		expect(calls).toBe(2);
	});

	it("fails an item fast on a 4xx without retrying", async () => {
		const batch = makeBatch(1);
		let calls = 0;
		const provider = new StubProvider("bad-request", () => {
			calls++;
			throw httpError(400);
		});
		await processBatch(batch, [provider], FAST);
		expect(batch.items[0]!.status).toBe("failed");
		expect(batch.items[0]!.error).toContain("HTTP 400");
		expect(calls).toBe(1);
	});

	it("fails over to the secondary provider when the primary is down", async () => {
		const batch = makeBatch(1);
		const primary = new StubProvider("primary", () => {
			throw httpError(503);
		});
		const secondary = new StubProvider("secondary", () => image("from-secondary"));
		await processBatch(batch, [primary, secondary], FAST);
		expect(batch.items[0]!.status).toBe("done");
		expect(batch.items[0]!.post?.caption).toBe("from-secondary");
		expect(batch.items[0]!.post?.meta.provider).toBe("secondary");
	});

	it("marks an item failed when both providers fail, without sinking the batch", async () => {
		const batch = makeBatch(3);
		// The middle item ("phone") fails on both providers; the others succeed.
		const fail = (product: ImageInput) => {
			if ("preset" in product && product.preset === "phone") {
				throw httpError(500);
			}
			return image("ok");
		};
		const primary = new StubProvider("primary", fail);
		const secondary = new StubProvider("secondary", fail);
		await processBatch(batch, [primary, secondary], FAST);

		expect(batch.status).toBe("done");
		expect(batch.items[1]!.status).toBe("failed");
		expect(batch.items[1]!.error).toContain("HTTP 500");
		expect(batch.items[0]!.status).toBe("done");
		expect(batch.items[2]!.status).toBe("done");
	});
});
