import type { Platform } from "./schema.mts";

export type PlatformConfig = {
	aspectRatio: string;
	hashtagCount: number;
	captionMaxLength: number;
};

// Per-platform shape that drives caption length, image aspect ratio, and hashtag
// count. Mock mode uses these to make placeholder posts plausibly platform-shaped.
export const PLATFORM_CONFIG: Record<Platform, PlatformConfig> = {
	instagram: { aspectRatio: "1:1", hashtagCount: 5, captionMaxLength: 2200 },
	x: { aspectRatio: "16:9", hashtagCount: 2, captionMaxLength: 280 },
	linkedin: { aspectRatio: "1.91:1", hashtagCount: 3, captionMaxLength: 3000 },
};
