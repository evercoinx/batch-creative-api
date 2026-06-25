import { describe, expect, it } from "vitest";
import { generateMockPost } from "./mock-generator.mts";
import { processBatch } from "./processor.mts";
import type { ImageInput, Platform } from "./schema.mts";
import type { Batch } from "./types.mts";

function makeBatch(productCount: number, platform: Platform = "instagram"): Batch {
	return {
		id: "test-batch",
		status: "pending",
		platform,
		items: Array.from({ length: productCount }, (_, i) => ({
			product: { preset: i % 2 === 0 ? "lamp" : "phone" } as ImageInput,
			status: "pending",
		})),
		createdAt: 0,
	};
}

describe("processBatch", () => {
	it("transitions the batch pending -> running -> done", async () => {
		const batch = makeBatch(2);
		expect(batch.status).toBe("pending");
		await processBatch(batch, generateMockPost);
		expect(batch.status).toBe("done");
	});

	it("produces exactly one post per product image", async () => {
		const batch = makeBatch(3);
		await processBatch(batch, generateMockPost);
		const posts = batch.items.filter((item) => item.post !== undefined);
		expect(posts).toHaveLength(3);
		expect(batch.items.every((item) => item.status === "done")).toBe(true);
	});

	it("sets each item running before it is done", async () => {
		const batch = makeBatch(1);
		const seen: string[] = [];
		await processBatch(batch, (product, platform) => {
			seen.push(batch.items[0]!.status);
			return generateMockPost(product, platform);
		});
		expect(seen).toEqual(["running"]);
		expect(batch.items[0]!.status).toBe("done");
	});

	it("marks a failed item without sinking the rest of the batch", async () => {
		const batch = makeBatch(3);
		const generate = (product: ImageInput, platform: Platform) => {
			if ("preset" in product && product.preset === "phone") {
				throw new Error("provider exploded");
			}
			return generateMockPost(product, platform);
		};
		await processBatch(batch, generate);

		expect(batch.status).toBe("done");
		expect(batch.items[1]!.status).toBe("failed");
		expect(batch.items[1]!.error).toBe("provider exploded");
		expect(batch.items[0]!.status).toBe("done");
		expect(batch.items[2]!.status).toBe("done");
	});
});
