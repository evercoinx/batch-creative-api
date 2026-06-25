import OpenAI from "openai";
import type { GenerateParams, GeneratedImage, ImageProvider } from "../provider.mts";
import type { ImageInput } from "../schema.mts";
import { captionPrompt, imagePrompt, parseCaptionResponse } from "./prompt.mts";

const IMAGE_MODEL = "gpt-image-1";
const TEXT_MODEL = "gpt-4o-mini";

// Map a platform aspect ratio to the nearest gpt-image-1 supported size.
function aspectToSize(aspectRatio: string): string {
	if (aspectRatio === "1:1") {
		return "1024x1024";
	}
	const [w = "1", h = "1"] = aspectRatio.split(":");
	return Number(w) >= Number(h) ? "1536x1024" : "1024x1536";
}

// Fallback provider, used when the primary exhausts its retries. Generates the
// image with gpt-image-1 and the caption + hashtags with a chat model, behind
// the shared ImageProvider seam. OpenAI's APIError carries a numeric `status`
// that the resilience layer uses to classify transient vs. fatal failures.
export class OpenAIProvider implements ImageProvider {
	readonly name = "openai";
	readonly #client: OpenAI;

	constructor(apiKey: string) {
		this.#client = new OpenAI({ apiKey });
	}

	async generate(
		product: ImageInput,
		_references: ImageInput[],
		styleSpec: string,
		params: GenerateParams,
	): Promise<GeneratedImage> {
		const imageResponse = await this.#client.images.generate({
			model: IMAGE_MODEL,
			prompt: imagePrompt(product, styleSpec, params),
			n: 1,
			size: aspectToSize(params.aspectRatio),
		});
		const b64 = imageResponse.data?.[0]?.b64_json;
		if (!b64) {
			throw new Error("OpenAI returned no image");
		}
		const imageBytes = Buffer.from(b64, "base64");

		const chat = await this.#client.chat.completions.create({
			model: TEXT_MODEL,
			messages: [{ role: "user", content: captionPrompt(product, styleSpec, params) }],
		});
		const text = chat.choices[0]?.message?.content ?? "";
		const { caption, hashtags } = parseCaptionResponse(text, params);

		return { imageBytes, mimeType: "image/png", caption, hashtags };
	}
}
