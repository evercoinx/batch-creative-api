import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "./server.mts";

let baseUrl: string;
let close: () => Promise<void>;

beforeAll(async () => {
	const server = createApp().listen(0);
	await new Promise<void>((resolve) =>
		server.once("listening", () => resolve()),
	);
	const { port } = server.address() as AddressInfo;
	baseUrl = `http://127.0.0.1:${port}`;
	close = () =>
		new Promise<void>((resolve, reject) =>
			server.close((err) => (err ? reject(err) : resolve())),
		);
});

afterAll(async () => {
	await close();
});

async function pollUntilDone(id: string): Promise<{
	status: string;
	items: Array<{ status: string; post?: unknown }>;
}> {
	for (let i = 0; i < 50; i++) {
		const res = await fetch(`${baseUrl}/batches/${id}`);
		const body = await res.json();
		if (body.status === "done") {
			return body;
		}
		await new Promise((r) => setTimeout(r, 20));
	}
	throw new Error("batch did not finish in time");
}

describe("HTTP service", () => {
	it("accepts a batch and processes it to done with one post per product", async () => {
		const res = await fetch(`${baseUrl}/batches`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				products: [{ preset: "lamp" }, { preset: "phone" }],
			}),
		});
		expect(res.status).toBe(202);
		const { batchId } = await res.json();
		expect(typeof batchId).toBe("string");

		const batch = await pollUntilDone(batchId);
		expect(batch.status).toBe("done");
		expect(batch.items).toHaveLength(2);
		expect(
			batch.items.every((item) => item.status === "done" && item.post),
		).toBe(true);

		// Each post's image was written to outputs/ and is served as a fetchable URL.
		const post = batch.items[0]?.post as { imageUrl: string } | undefined;
		expect(post?.imageUrl.startsWith("/outputs/")).toBe(true);
		const imageRes = await fetch(`${baseUrl}${post?.imageUrl}`);
		expect(imageRes.status).toBe(200);
	});

	it("rejects a malformed body with 400", async () => {
		const res = await fetch(`${baseUrl}/batches`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ products: [] }),
		});
		expect(res.status).toBe(400);
	});

	it("returns 404 for an unknown batch id", async () => {
		const res = await fetch(`${baseUrl}/batches/does-not-exist`);
		expect(res.status).toBe(404);
	});

	it("serves the demo page at /", async () => {
		const res = await fetch(`${baseUrl}/`);
		expect(res.status).toBe(200);
		const html = await res.text();
		expect(html).toContain("Batch Creative API");
	});

	it("demo page has all three sections and a public repo link", async () => {
		const res = await fetch(`${baseUrl}/`);
		const html = await res.text();
		// Section 1 — interactive demo preloads both product and reference thumbnails.
		expect(html).toContain("/data/product/");
		expect(html).toContain("/data/reference/");
		// Section 2 — the "how it was built" write-up.
		expect(html.toLowerCase()).toContain("how it was built");
		// Section 3 — link to the public GitHub repo.
		expect(html).toContain("github.com/evercoinx/batch-creative-api");
	});

	it("presents the three sections as an ARIA tablist with three tabs", async () => {
		const res = await fetch(`${baseUrl}/`);
		const html = await res.text();
		// A tab bar wires the ARIA tab pattern at baseline.
		expect(html).toContain('role="tablist"');
		expect((html.match(/role="tab"/g) ?? []).length).toBe(3);
		expect((html.match(/role="tabpanel"/g) ?? []).length).toBe(3);
		// The page opens on the Demo tab.
		expect(html).toMatch(/role="tab"[^>]*aria-selected="true"/);
		// Numeric prefixes are dropped from the section headings now the tabs convey order.
		expect(html).not.toContain("1 · The product");
	});
});
