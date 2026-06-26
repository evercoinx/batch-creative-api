import { describe, expect, it } from "vitest";
import { MockProvider } from "./mock-provider.mts";
import { PLATFORM_CONFIG } from "./platform-config.mts";
import type { ImageInput, Platform } from "./schema.mts";
import { NEUTRAL_STYLE_SPEC } from "./style.mts";

const PLATFORMS = Object.keys(PLATFORM_CONFIG) as Platform[];
const product: ImageInput = { preset: "lamp" };
const references: ImageInput[] = [];

describe("MockProvider", () => {
	const provider = new MockProvider();

	it("returns exactly the platform's hashtagCount hashtags for every platform", async () => {
		for (const platform of PLATFORMS) {
			const params = PLATFORM_CONFIG[platform];
			const image = await provider.generate(product, references, "style", params);
			expect(image.hashtags).toHaveLength(params.hashtagCount);
			expect(image.hashtags.every((tag) => tag.length > 0 && !tag.startsWith("#"))).toBe(true);
		}
	});

	it("keeps the caption within the platform's captionMaxLength", async () => {
		const params = PLATFORM_CONFIG.x; // tightest cap (280)
		const image = await provider.generate(product, references, "style", params);
		expect(image.caption.length).toBeLessThanOrEqual(params.captionMaxLength);
	});

	it("describes a canned style for references and the neutral fallback for none", async () => {
		expect(await provider.describeStyle([])).toBe(NEUTRAL_STYLE_SPEC);
		const spec = await provider.describeStyle([{ preset: "forest" }]);
		expect(spec).not.toBe(NEUTRAL_STYLE_SPEC);
		expect(spec.length).toBeGreaterThan(0);
	});
});
