import { ITEM_CONCURRENCY } from "../config.mts";
import type { ImageInput, Platform } from "./schema.mts";
import type { Batch, BatchItem, Post } from "./types.mts";

// The provider seam: one post per product image. Mock mode injects a stub; the
// real Gemini/OpenAI providers (a later slice) plug in here unchanged.
export type PostGenerator = (product: ImageInput, platform: Platform) => Promise<Post> | Post;

async function processItem(
	item: BatchItem,
	platform: Platform,
	generate: PostGenerator,
): Promise<void> {
	item.status = "running";
	try {
		item.post = await generate(item.product, platform);
		item.status = "done";
	} catch (error) {
		// One failed item must not sink the batch — record the error and move on.
		item.status = "failed";
		item.error = error instanceof Error ? error.message : String(error);
	}
}

// Drives a batch to completion: pending -> running, each item generated with
// bounded concurrency, then the batch settles to done. Resolves when every item
// is terminal; callers that want async behaviour invoke this without awaiting.
export async function processBatch(batch: Batch, generate: PostGenerator): Promise<void> {
	batch.status = "running";

	const queue = batch.items.values();
	const workers: Promise<void>[] = [];
	const workerCount = Math.min(ITEM_CONCURRENCY, batch.items.length);
	for (let i = 0; i < workerCount; i++) {
		workers.push(
			(async () => {
				for (const item of queue) {
					await processItem(item, batch.platform, generate);
				}
			})(),
		);
	}
	await Promise.all(workers);

	batch.status = "done";
}
