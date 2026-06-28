import OpenAI, { toFile } from "openai";
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
// image with gpt-image-1's subject-conditioning edit call (the product bytes are
// fed in per item so the real product is preserved) and the caption + hashtags
// with a chat model, behind the shared ImageProvider seam. OpenAI's APIError
// carries a numeric `status` that the resilience layer uses to classify transient
// vs. fatal failures.
export class OpenAIProvider implements ImageProvider {
	readonly name = "openai";
	readonly #client: OpenAI;

	constructor(apiKey: string) {
		this.#client = new OpenAI({ apiKey });
	}

	// Resolve each reference to bytes and ask the vision chat model for one style
	// spec. Zero references skips the model and returns the shared neutral fallback.
	async describeStyle(references: ImageInput[]): Promise<string> {
		if (references.length === 0) {
			return NEUTRAL_STYLE_SPEC;
		}
		const imageParts = await Promise.all(
			references.map(async (reference) => {
				const { bytes, mimeType } = await resolveImageInput(reference);
				return {
					type: "image_url" as const,
					image_url: {
						url: `data:${mimeType};base64,${bytes.toString("base64")}`,
					},
				};
			}),
		);
		const chat = await this.#client.chat.completions.create({
			model: TEXT_MODEL,
			messages: [
				{
					role: "user",
					content: [
						{ type: "text" as const, text: STYLE_DESCRIPTION_PROMPT },
						...imageParts,
					],
				},
			],
		});
		const styleSpec = chat.choices[0]?.message?.content?.trim();
		if (!styleSpec) {
			throw new Error("OpenAI returned no style description");
		}
		return styleSpec;
	}

	// Subject conditioning: the product bytes are fed to the image-edit model on
	// every item so the real product (label, shape) is preserved while the scene
	// is restyled to the shared styleSpec. input_fidelity "high" reinforces the
	// shared prompt's preservation wording on this leg. References are NOT fed per
	// item — they were consumed once by describeStyle, so `references` stays unused
	// here (ADR 0003).
	async generate(
		product: ImageInput,
		_references: ImageInput[],
		styleSpec: string,
		params: GenerateParams,
	): Promise<GeneratedImage> {
		const { bytes, mimeType: productMimeType } =
			await resolveImageInput(product);
		const productImage = await toFile(bytes, "product", {
			type: productMimeType,
		});
		const imageResponse = await this.#client.images.edit({
			model: IMAGE_MODEL,
			image: productImage,
			prompt: imagePrompt(product, styleSpec, params),
			input_fidelity: "high",
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
			messages: [
				{ role: "user", content: captionPrompt(product, styleSpec, params) },
			],
		});
		const text = chat.choices[0]?.message?.content ?? "";
		const { caption, hashtags } = parseCaptionResponse(text, params);

		return { imageBytes, mimeType: "image/png", caption, hashtags };
	}
}
