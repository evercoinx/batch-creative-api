import { createPartFromBase64, createPartFromText, createUserContent, GoogleGenAI } from "@google/genai";
import type { GenerateParams, GeneratedImage, ImageProvider } from "../provider.mts";
import { resolveImageInput } from "../resolve-input.mts";
import type { ImageInput } from "../schema.mts";
import { NEUTRAL_STYLE_SPEC } from "../style.mts";
import {
	captionPrompt,
	imagePrompt,
	parseCaptionResponse,
	STYLE_DESCRIPTION_PROMPT,
} from "./prompt.mts";

const IMAGE_MODEL = "imagen-4.0-generate-001";
const TEXT_MODEL = "gemini-2.5-flash";

// Primary provider. Generates the styled image with Imagen and the caption +
// hashtags with a Gemini text model, behind the shared ImageProvider seam. SDK
// errors carry a numeric `status` that the resilience layer uses to classify
// transient vs. fatal failures.
export class GeminiProvider implements ImageProvider {
	readonly name = "gemini";
	readonly #client: GoogleGenAI;

	constructor(apiKey: string) {
		this.#client = new GoogleGenAI({ apiKey });
	}

	// Resolve each reference to bytes and ask the vision model for one style spec
	// describing palette, lighting, mood, and composition. Zero references skips
	// the model entirely and returns the shared neutral fallback.
	async describeStyle(references: ImageInput[]): Promise<string> {
		if (references.length === 0) {
			return NEUTRAL_STYLE_SPEC;
		}
		const imageParts = await Promise.all(
			references.map(async (reference) => {
				const { bytes, mimeType } = await resolveImageInput(reference);
				return createPartFromBase64(bytes.toString("base64"), mimeType);
			}),
		);
		const response = await this.#client.models.generateContent({
			model: TEXT_MODEL,
			contents: createUserContent([createPartFromText(STYLE_DESCRIPTION_PROMPT), ...imageParts]),
		});
		const styleSpec = response.text?.trim();
		if (!styleSpec) {
			throw new Error("Gemini returned no style description");
		}
		return styleSpec;
	}

	// Imagen 4 is text-to-image only: references shape the output solely through
	// the shared styleSpec, so `references` is unused here. The image-to-image
	// upgrade path is recorded in ADR 0002.
	async generate(
		product: ImageInput,
		_references: ImageInput[],
		styleSpec: string,
		params: GenerateParams,
	): Promise<GeneratedImage> {
		const imageResponse = await this.#client.models.generateImages({
			model: IMAGE_MODEL,
			prompt: imagePrompt(product, styleSpec, params),
			config: { numberOfImages: 1, aspectRatio: params.aspectRatio },
		});
		const generated = imageResponse.generatedImages?.[0]?.image;
		if (!generated?.imageBytes) {
			throw new Error("Gemini returned no image");
		}
		const imageBytes = Buffer.from(generated.imageBytes, "base64");
		const mimeType = generated.mimeType ?? "image/png";

		const textResponse = await this.#client.models.generateContent({
			model: TEXT_MODEL,
			contents: captionPrompt(product, styleSpec, params),
		});
		const { caption, hashtags } = parseCaptionResponse(textResponse.text ?? "", params);

		return { imageBytes, mimeType, caption, hashtags };
	}
}
