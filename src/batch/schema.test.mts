import { describe, expect, it } from "vitest";
import { MAX_PRODUCTS_PER_BATCH } from "../config.mts";
import { createBatchSchema } from "./schema.mts";

describe("createBatchSchema", () => {
	it("accepts url, base64, and preset image inputs", () => {
		const result = createBatchSchema.safeParse({
			products: [
				{ url: "https://example.com/a.jpg" },
				{ base64: "aGVsbG8=" },
				{ preset: "lamp" },
			],
		});
		expect(result.success).toBe(true);
	});

	it("defaults platform to instagram when omitted", () => {
		const result = createBatchSchema.parse({ products: [{ preset: "phone" }] });
		expect(result.platform).toBe("instagram");
	});

	it("rejects an empty products array", () => {
		const result = createBatchSchema.safeParse({ products: [] });
		expect(result.success).toBe(false);
	});

	it("rejects more products than the per-batch cap", () => {
		const products = Array.from({ length: MAX_PRODUCTS_PER_BATCH + 1 }, () => ({
			preset: "lamp" as const,
		}));
		const result = createBatchSchema.safeParse({ products });
		expect(result.success).toBe(false);
	});

	it("rejects an unknown preset name", () => {
		const result = createBatchSchema.safeParse({ products: [{ preset: "nope" }] });
		expect(result.success).toBe(false);
	});

	it("rejects an image input that mixes input kinds", () => {
		const result = createBatchSchema.safeParse({
			products: [{ url: "https://example.com/a.jpg", preset: "lamp" }],
		});
		expect(result.success).toBe(false);
	});

	it("rejects an unknown platform", () => {
		const result = createBatchSchema.safeParse({
			products: [{ preset: "lamp" }],
			platform: "tiktok",
		});
		expect(result.success).toBe(false);
	});

	it("rejects more than two reference images", () => {
		const result = createBatchSchema.safeParse({
			products: [{ preset: "lamp" }],
			references: [{ preset: "forest" }, { preset: "mars" }, { preset: "skytower" }],
		});
		expect(result.success).toBe(false);
	});
});
