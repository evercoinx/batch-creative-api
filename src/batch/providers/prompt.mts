import type { GenerateParams } from "../provider.mts";
import type { ImageInput } from "../schema.mts";

// Shared prompt construction + response parsing for the real providers, so
// Gemini and OpenAI ask for images and captions the same way.

function describe(product: ImageInput): string {
	if ("preset" in product) {
		return product.preset;
	}
	if ("url" in product) {
		return "the product shown in the supplied image";
	}
	return "the supplied product";
}

// The image model now receives the product image bytes directly, so its identity
// comes from pixels, not words. A preset name is at best a weak category label and
// must stay subordinate to the bytes; an uploaded product has no useful name hint.
function categoryHint(product: ImageInput): string {
	if ("preset" in product) {
		return ` It may be a ${product.preset}; treat that name only as a weak category hint, subordinate to the supplied image.`;
	}
	return "";
}

// Instruction paired with the reference image bytes when a real provider extracts
// a batch's style spec via its vision model.
export const STYLE_DESCRIPTION_PROMPT =
	"Describe the palette, lighting, mood, and composition of the supplied reference image(s) as one concise visual style spec for guiding product photography. Respond with only the description, no preamble.";

// Built for subject-conditioning image models: the supplied product image bytes
// are authoritative for product identity (preserve the real product, not a
// lookalike), and only the surrounding scene is restyled to the batch style spec.
export function imagePrompt(
	product: ImageInput,
	styleSpec: string,
	params: GenerateParams,
): string {
	return `Create a polished social-media product photo. The supplied product image is authoritative for product identity: preserve the real product exactly — its label, shape, and proportions must match the supplied image, never a lookalike.${categoryHint(product)} Restyle only the surrounding scene to this visual style: ${styleSpec} Target aspect ratio ${params.aspectRatio}.`;
}

export function captionPrompt(
	product: ImageInput,
	styleSpec: string,
	params: GenerateParams,
): string {
	return [
		`Write a social-media caption for a post featuring ${describe(product)}.`,
		`Match this style and mood: ${styleSpec}`,
		`The caption must be at most ${params.captionMaxLength} characters.`,
		`Then provide exactly ${params.hashtagCount} relevant hashtags (no leading #).`,
		`Respond with only JSON of the form {"caption": string, "hashtags": string[]}.`,
	].join(" ");
}

// Pull the first JSON object out of a model response that may wrap it in prose
// or code fences.
function extractJson(text: string): string {
	const start = text.indexOf("{");
	const end = text.lastIndexOf("}");
	return start !== -1 && end > start ? text.slice(start, end + 1) : text;
}

// Best-effort parse of the caption/hashtags JSON; if the model didn't comply,
// fall back to using the raw text as the caption so the item still succeeds.
export function parseCaptionResponse(
	text: string,
	params: GenerateParams,
): { caption: string; hashtags: string[] } {
	try {
		const parsed = JSON.parse(extractJson(text)) as {
			caption?: unknown;
			hashtags?: unknown;
		};
		const caption = String(parsed.caption ?? "").slice(
			0,
			params.captionMaxLength,
		);
		const hashtags = Array.isArray(parsed.hashtags)
			? parsed.hashtags.map((tag) => String(tag)).slice(0, params.hashtagCount)
			: [];
		return { caption, hashtags };
	} catch {
		return { caption: text.slice(0, params.captionMaxLength), hashtags: [] };
	}
}
