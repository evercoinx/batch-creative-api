import { readFile } from "node:fs/promises";
import { presetPath } from "../presets.mts";
import type { GenerateParams, GeneratedImage, ImageProvider } from "./provider.mts";
import type { ImageInput } from "./schema.mts";

// A base64 product (or a bare URL we can't fetch in mock mode) has no bundled
// bytes, so it falls back to this sample image.
const FALLBACK_PRESET = "lamp";

function describeProduct(product: ImageInput): string {
	if ("preset" in product) {
		return product.preset;
	}
	return "your product";
}

// Mock implementation of the ImageProvider seam: returns a bundled sample image's
// bytes plus a canned, platform-shaped caption and hashtags. Selected when no
// provider keys are set, so the demo and CI run without spending credits.
export class MockProvider implements ImageProvider {
	readonly name = "mock";

	async generate(
		product: ImageInput,
		_references: ImageInput[],
		_styleSpec: string,
		params: GenerateParams,
	): Promise<GeneratedImage> {
		const preset = "preset" in product ? product.preset : FALLBACK_PRESET;
		const imageBytes = await readFile(presetPath(preset));
		const subject = describeProduct(product);
		const hashtags = ["batchcreative", "mock", "post", subject].slice(0, params.hashtagCount);
		return {
			imageBytes,
			mimeType: "image/jpeg",
			caption: `A mock post for ${subject}.`.slice(0, params.captionMaxLength),
			hashtags,
		};
	}
}
