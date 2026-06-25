import { z } from "zod";
import { MAX_PRODUCTS_PER_BATCH } from "../config.mts";
import { PRESET_NAMES } from "../presets.mts";

// An ImageInput is exactly one of url / base64 / preset. `.strict()` on each
// member plus a discriminating key means a body mixing fields (e.g. both url and
// preset) is rejected rather than silently accepted.
const imageInputSchema = z.union([
	z.object({ url: z.string().url() }).strict(),
	z.object({ base64: z.string().min(1) }).strict(),
	z.object({ preset: z.enum(PRESET_NAMES) }).strict(),
]);

export type ImageInput = z.infer<typeof imageInputSchema>;

export const PLATFORMS = ["instagram", "x", "linkedin"] as const;
export type Platform = (typeof PLATFORMS)[number];

// References are accepted (and capped at 1–2); the batch derives one style spec
// from them and reuses it for every product image so the set stays consistent.
export const createBatchSchema = z
	.object({
		products: z.array(imageInputSchema).min(1).max(MAX_PRODUCTS_PER_BATCH),
		references: z.array(imageInputSchema).min(1).max(2).optional(),
		platform: z.enum(PLATFORMS).default("instagram"),
	})
	.strict();

export type CreateBatchRequest = z.infer<typeof createBatchSchema>;
