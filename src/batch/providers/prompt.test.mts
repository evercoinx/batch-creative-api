import { describe, expect, it } from "vitest";
import type { GenerateParams } from "../provider.mts";
import type { ImageInput } from "../schema.mts";
import { imagePrompt } from "./prompt.mts";

const params: GenerateParams = {
	aspectRatio: "1:1",
	hashtagCount: 5,
	captionMaxLength: 2200,
};

describe("imagePrompt", () => {
	const styleSpec = "warm pastel palette, soft daylight, minimal composition";

	it("marks the supplied product image authoritative for product identity", () => {
		const product: ImageInput = { base64: "data:image/png;base64,AAA" };
		const prompt = imagePrompt(product, styleSpec, params);
		// The product bytes — not the words — must drive identity, so the prompt
		// names the supplied image as authoritative and forbids a lookalike.
		expect(prompt.toLowerCase()).toContain("supplied product image");
		expect(prompt.toLowerCase()).toContain("authoritative");
		expect(prompt.toLowerCase()).toContain("lookalike");
	});

	it("restyles only the surrounding scene to the style spec", () => {
		const product: ImageInput = { base64: "data:image/png;base64,AAA" };
		const prompt = imagePrompt(product, styleSpec, params);
		expect(prompt).toContain(styleSpec);
		expect(prompt.toLowerCase()).toContain("scene");
		expect(prompt).toContain(params.aspectRatio);
	});

	it("keeps a preset name only as a weak category hint subordinate to the bytes", () => {
		const product: ImageInput = { preset: "shampoo" };
		const prompt = imagePrompt(product, styleSpec, params);
		expect(prompt).toContain("shampoo");
		expect(prompt.toLowerCase()).toContain("hint");
	});

	it("omits any category hint when there is no preset name", () => {
		const product: ImageInput = { base64: "data:image/png;base64,AAA" };
		const prompt = imagePrompt(product, styleSpec, params);
		expect(prompt.toLowerCase()).not.toContain("hint");
	});
});
