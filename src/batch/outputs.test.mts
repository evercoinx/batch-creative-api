import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { OUTPUTS_DIR, OUTPUTS_URL_PREFIX, writeOutput } from "./outputs.mts";
import type { GeneratedImage } from "./provider.mts";

function image(bytes: number[], mimeType: string): GeneratedImage {
	return { imageBytes: new Uint8Array(bytes), mimeType, caption: "", hashtags: [] };
}

describe("writeOutput", () => {
	const written: string[] = [];

	afterAll(async () => {
		await Promise.all(
			written.map((url) => rm(join(OUTPUTS_DIR, url.slice(OUTPUTS_URL_PREFIX.length + 1)), { force: true })),
		);
	});

	it("writes the image bytes to outputs/ and returns a served URL", async () => {
		const url = await writeOutput(image([1, 2, 3, 4], "image/png"), "test-write-png");
		written.push(url);
		expect(url).toBe(`${OUTPUTS_URL_PREFIX}/test-write-png.png`);
		const onDisk = await readFile(join(OUTPUTS_DIR, "test-write-png.png"));
		expect([...onDisk]).toEqual([1, 2, 3, 4]);
	});

	it("maps the mime type to a file extension", async () => {
		const url = await writeOutput(image([9], "image/jpeg"), "test-write-jpg");
		written.push(url);
		expect(url.endsWith(".jpg")).toBe(true);
	});
});
