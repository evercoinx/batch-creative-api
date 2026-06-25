import type { ImageInput } from "./schema.mts";

// The style spec is the one text description of the reference look that every
// product image in a batch is generated against — extracted once per batch so
// the whole set stays visually consistent (CONTEXT.md glossary).
//
// A full implementation would call a vision model to describe the reference
// image(s); for now we derive a deterministic spec from how many references were
// supplied. Providers receive this string as the styleSpec param.
export function deriveStyleSpec(references: ImageInput[]): string {
	if (references.length === 0) {
		return "Clean, bright commercial product photography on a neutral background.";
	}
	const count = references.length === 1 ? "reference image" : "reference images";
	return `Match the palette, lighting, mood, and composition of the supplied ${count}.`;
}
