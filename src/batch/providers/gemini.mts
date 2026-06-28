import {
	createPartFromBase64,
	createPartFromText,
	createUserContent,
	GoogleGenAI,
} from "@google/genai";
import type {
	GeneratedImage,
	GenerateParams,
	ImageProvider,
} from "../provider.mts";
import { resolveImageInput } from "../resolve-input.mts";
import type { ImageInput } from "../schema.mts";
import { NEUTRAL_STYLE_SPEC } from "../style.mts";
import {
	captionPrompt,
	imagePrompt,
	parseCaptionResponse,
	STYLE_DESCRIPTION_PROMPT,
} from "./prompt.mts";

const IMAGE_MODEL = "gemini-2.5-flash-image";
const TEXT_MODEL = "gemini-2.5-flash";

// Primary provider. Generates the styled image with a subject-conditioning Gemini
// image model (the product bytes are fed in per item so the real product is
// preserved) and the caption + hashtags with a Gemini text model, behind the
// shared ImageProvider seam. SDK errors carry a numeric `status` that the
// resilience layer uses to classify transient vs. fatal failures.
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
			contents: createUserContent([
				createPartFromText(STYLE_DESCRIPTION_PROMPT),
				...imageParts,
			]),
		});
		const styleSpec = response.text?.trim();
		if (!styleSpec) {
			throw new Error("Gemini returned no style description");
		}
		return styleSpec;
	}

	// Subject conditioning: the product bytes are fed to the image model on every
	// item so the real product (label, shape) is preserved while the scene is
	// restyled to the shared styleSpec. References are NOT fed per item — they were
	// consumed once by describeStyle, so `references` stays unused here (ADR 0003).
	async generate(
		product: ImageInput,
		_references: ImageInput[],
		styleSpec: string,
		params: GenerateParams,
	): Promise<GeneratedImage> {
		const { bytes, mimeType: productMimeType } =
			await resolveImageInput(product);
		const imageResponse = await this.#client.models.generateContent({
			model: IMAGE_MODEL,
			contents: createUserContent([
				createPartFromBase64(bytes.toString("base64"), productMimeType),
				createPartFromText(imagePrompt(product, styleSpec, params)),
			]),
			config: {
				responseModalities: ["IMAGE"],
				imageConfig: { aspectRatio: params.aspectRatio },
			},
		});
		// Find the part carrying inline image data rather than assuming a position:
		// the model may emit text/thought parts alongside the image.
		const inlineImage = imageResponse.candidates?.[0]?.content?.parts?.find(
			(part) => part.inlineData?.data,
		)?.inlineData;
		if (!inlineImage?.data) {
			throw new Error("Gemini returned no image");
		}
		const imageBytes = Buffer.from(inlineImage.data, "base64");
		const mimeType = inlineImage.mimeType ?? "image/png";

		const textResponse = await this.#client.models.generateContent({
			model: TEXT_MODEL,
			contents: captionPrompt(product, styleSpec, params),
		});
		const { caption, hashtags } = parseCaptionResponse(
			textResponse.text ?? "",
			params,
		);

		return { imageBytes, mimeType, caption, hashtags };
	}
}
