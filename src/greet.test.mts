import { describe, expect, it } from "vitest";
import { greet } from "./greet.mts";

describe("greet", () => {
	it("returns a greeting for the given name", () => {
		expect(greet("World")).toBe("Hello, World!");
	});

	it("falls back to a generic greeting when no name is given", () => {
		expect(greet()).toBe("Hello, there!");
	});

	it("trims surrounding whitespace from the name", () => {
		expect(greet("  Ada  ")).toBe("Hello, Ada!");
	});
});
