// The style spec is the one text description of the reference look that every
// product image in a batch is generated against — extracted once per batch so
// the whole set stays visually consistent (CONTEXT.md glossary). Extraction now
// lives on the ImageProvider seam (describeStyle); this module only retains the
// shared fallback used when a batch has no reference images.
//
// With zero references there is nothing to describe, so providers return this
// neutral product-photography spec without a model call.
export const NEUTRAL_STYLE_SPEC =
	"Clean, bright commercial product photography on a neutral background.";
