import { describe, expect, it } from "vitest";
import { MockProvider } from "./mock-provider.mts";
import { PLATFORM_CONFIG } from "./platform-config.mts";
import type { ImageInput, Platform } from "./schema.mts";

const PLATFORMS = Object.keys(PLATFORM_CONFIG) as Platform[];
const product: ImageInput = { preset: "lamp" };
const references: ImageInput[] = [];

describe("MockProvider", () => {
	it("returns exactly the platform's hashtagCount hashtags for every platform", async () => {
		const provider = new MockProvider();
		for (const platform of PLATFORMS) {
			const params = PLATFORM_CONFIG[platform];
			const image = await provider.generate(product, references, "style", params);
			expect(image.hashtags).toHaveLength(params.hashtagCount);
			// Hashtags carry no leading '#' and are non-empty.
			expect(image.hashtags.every((tag) => tag.length > 0 && !tag.startsWith("#"))).toBe(true);
		}
	});

	it("keeps the caption within the platform's captionMaxLength", async () => {
		const provider = new MockProvider();
		const params = PLATFORM_CONFIG.x; // tightest cap (280)
		const image = await provider.generate(product, references, "style", params);
		expect(image.caption.length).toBeLessThanOrEqual(params.captionMaxLength);
	});
});
