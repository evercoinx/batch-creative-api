import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// ADRs are committed so the architectural decisions behind the service are
// reproducible (PRD #10: "ADR 0002 ... is written and accompanies this PRD").
// These checks pin the contract the PRD relies on without prose drift.
const root = (rel: string) =>
	fileURLToPath(new URL(`../${rel}`, import.meta.url));

describe("ADR 0002 (style consistency via shared text spec)", () => {
	const adr = readFileSync(
		root("docs/adr/0002-style-consistency-via-shared-text-spec.md"),
		"utf8",
	).toLowerCase();

	it("records the text-to-image decision rather than per-image conditioning", () => {
		expect(adr).toContain("text-to-image");
		expect(adr).toContain("style spec");
	});

	it("explains the consistency guarantee comes from reusing one spec per batch", () => {
		expect(adr).toContain("once per batch");
	});

	it("notes the image-to-image upgrade path that is out of scope", () => {
		expect(adr).toContain("image-to-image");
	});
});
