import { describe, expect, it } from "vitest";
import { NEUTRAL_STYLE_SPEC } from "../style.mts";
import { GeminiProvider } from "./gemini.mts";

describe("GeminiProvider.describeStyle", () => {
	it("returns the neutral fallback for zero references without a model call", async () => {
		// A bogus key would make any real model call fail; resolving without error
		// proves zero references short-circuit before the client is touched.
		const provider = new GeminiProvider("test-key");
		expect(await provider.describeStyle([])).toBe(NEUTRAL_STYLE_SPEC);
	});
});
