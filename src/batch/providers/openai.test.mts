import { describe, expect, it } from "vitest";
import { isTransientError } from "../provider.mts";
import type { ImageInput } from "../schema.mts";
import { OpenAIProvider } from "./openai.mts";

const params = {
	aspectRatio: "1:1",
	hashtagCount: 5,
	captionMaxLength: 2200,
};

describe("OpenAIProvider.generate", () => {
	it("resolves the product to bytes first and fails fast on an unsupported input", async () => {
		// A bogus key would make any real model call fail with a network/auth error;
		// resolving the product inside generate() means an unsupported `url` input
		// throws the real cause before the client is ever touched. The thrown error
		// is a plain Error, so the resilience layer classifies it non-transient.
		const provider = new OpenAIProvider("test-key");
		const product: ImageInput = { url: "https://example.com/p.png" };

		let error: unknown;
		try {
			await provider.generate(product, [], "style", params);
		} catch (caught) {
			error = caught;
		}

		expect(error).toBeInstanceOf(Error);
		if (error instanceof Error) {
			expect(error.message).toContain("url inputs not yet supported");
		}
		expect(isTransientError(error)).toBe(false);
	});
});
