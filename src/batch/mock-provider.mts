import { readFile } from "node:fs/promises";
import { presetPath } from "../presets.mts";
import type { GenerateParams, GeneratedImage, ImageProvider } from "./provider.mts";
import type { ImageInput } from "./schema.mts";
import { NEUTRAL_STYLE_SPEC } from "./style.mts";

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

	// Canned spec so mock mode and existing tests keep working without a vision
	// model; empty references fall back to the shared neutral spec.
	async describeStyle(references: ImageInput[]): Promise<string> {
		if (references.length === 0) {
			return NEUTRAL_STYLE_SPEC;
		}
		return "Match the palette, lighting, mood, and composition of the supplied reference image(s).";
	}

	async generate(
		product: ImageInput,
		references: ImageInput[],
		_styleSpec: string,
		params: GenerateParams,
	): Promise<GeneratedImage> {
		const preset = "preset" in product ? product.preset : FALLBACK_PRESET;
		const imageBytes = await readFile(presetPath(preset));
		const subject = describeProduct(product);
		// Reflect the reference styling in the caption so the demo visibly shows
		// references taking effect (otherwise mock output is identical with/without).
		const styled = references.length > 0 ? " styled from references" : "";
		// Base pool plus numbered fillers, so the mock can satisfy any platform's
		// hashtagCount (instagram asks for 5) rather than capping at the pool size.
		const pool = ["batchcreative", "mock", "post", subject];
		while (pool.length < params.hashtagCount) {
			pool.push(`tag${pool.length + 1}`);
		}
		const hashtags = pool.slice(0, params.hashtagCount);
		return {
			imageBytes,
			mimeType: "image/jpeg",
			caption: `A mock post for ${subject}${styled}.`.slice(0, params.captionMaxLength),
			hashtags,
		};
	}
}
