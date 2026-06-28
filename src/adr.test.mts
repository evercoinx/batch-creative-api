import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// ADRs are committed so the architectural decisions behind the service are
// reproducible. These checks pin the contract the PRDs rely on without prose
// drift: ADR 0002 recorded the original text-to-image decision (PRD #10), and
// ADR 0003 supersedes it with per-image subject conditioning (PRD #16).
//
// Lowercased so the contract checks below match prose regardless of casing.
const readAdr = (file: string) =>
	readFileSync(
		fileURLToPath(new URL(`../docs/adr/${file}`, import.meta.url)),
		"utf8",
	).toLowerCase();

describe("ADR 0002 (style consistency via shared text spec)", () => {
	const adr = readAdr("0002-style-consistency-via-shared-text-spec.md");

	it("records the text-to-image decision rather than per-image conditioning", () => {
		expect(adr).toContain("text-to-image");
		expect(adr).toContain("style spec");
	});

	it("explains the consistency guarantee comes from reusing one spec per batch", () => {
		expect(adr).toContain("once per batch");
	});

	it("carries the superseded marker pointing at ADR 0003", () => {
		expect(adr).toContain("status: superseded by 0003");
	});
});

describe("ADR 0003 (subject conditioning preserves the product)", () => {
	const adr = readAdr(
		"0003-gemini-subject-conditioning-preserves-the-product.md",
	);

	it("records per-image product conditioning rather than text-to-image lookalikes", () => {
		expect(adr).toContain("product image bytes");
		expect(adr).toContain("real product");
	});

	it("declares it supersedes ADR 0002", () => {
		expect(adr).toContain("supersedes");
		expect(adr).toContain("0002");
	});

	it("keeps the single shared style spec as the batch consistency anchor", () => {
		expect(adr).toContain("once per batch");
	});
});
