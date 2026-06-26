import { randomUUID } from "node:crypto";
import type { CreateBatchRequest } from "./schema.mts";
import type { Batch, BatchView } from "./types.mts";

// In-memory, single-process batch store. Sufficient for a showcase demo; the
// upgrade path (Redis/Postgres) is recorded in ADR 0001.
export class BatchStore {
	readonly #batches = new Map<string, Batch>();

	create(request: CreateBatchRequest): Batch {
		const references = request.references ?? [];
		const batch: Batch = {
			id: randomUUID(),
			status: "pending",
			platform: request.platform,
			references,
			// No synchronous derivation: the processor extracts the real per-batch
			// style spec (describeStyle on the provider seam) once before item
			// fan-out, so the HTTP create response is never blocked on it (PRD #10).
			styleSpec: "",
			items: request.products.map((product) => ({ product, status: "pending" })),
			createdAt: Date.now(),
		};
		this.#batches.set(batch.id, batch);
		return batch;
	}

	get(id: string): Batch | undefined {
		return this.#batches.get(id);
	}

	// Batches still pending or running. Used to enforce the concurrent-batches cap.
	// "done" and "failed" are both terminal and don't count toward the cap.
	activeCount(): number {
		let count = 0;
		for (const batch of this.#batches.values()) {
			if (batch.status !== "done" && batch.status !== "failed") {
				count++;
			}
		}
		return count;
	}

	view(batch: Batch): BatchView {
		return {
			id: batch.id,
			status: batch.status,
			platform: batch.platform,
			error: batch.error,
			items: batch.items.map(({ status, post, error }) => ({ status, post, error })),
		};
	}
}
