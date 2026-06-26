import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { presetPath } from "../presets.mts";
import { resolveImageInput } from "./resolve-input.mts";

describe("resolveImageInput", () => {
	it("resolves a preset to non-empty bytes with a sensible mime type", async () => {
		const { bytes, mimeType } = await resolveImageInput({ preset: "lamp" });
		expect(bytes.length).toBeGreaterThan(0);
		expect(mimeType).toBe("image/jpeg");
	});

	it("round-trips an inline base64 input to the original bytes", async () => {
		const original = await readFile(presetPath("forest"));
		const { bytes } = await resolveImageInput({
			base64: original.toString("base64"),
		});
		expect(Buffer.compare(bytes, original)).toBe(0);
	});

	it("honours the mime type declared in a base64 data URL", async () => {
		const { bytes, mimeType } = await resolveImageInput({
			base64: `data:image/png;base64,${Buffer.from("abc").toString("base64")}`,
		});
		expect(mimeType).toBe("image/png");
		expect(bytes.toString()).toBe("abc");
	});

	it("throws a documented error for a url input", async () => {
		await expect(
			resolveImageInput({ url: "https://example.com/x.jpg" }),
		).rejects.toThrow("url inputs not yet supported");
	});
});
