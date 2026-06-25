import { GoogleGenAI } from "@google/genai";
import type { GenerateParams, GeneratedImage, ImageProvider } from "../provider.mts";
import type { ImageInput } from "../schema.mts";
import { captionPrompt, imagePrompt, parseCaptionResponse } from "./prompt.mts";

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
