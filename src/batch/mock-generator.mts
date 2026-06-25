import { presetUrl } from "../presets.mts";
import { PLATFORM_CONFIG } from "./platform-config.mts";
import type { ImageInput, Platform } from "./schema.mts";
import type { Post } from "./types.mts";

const FALLBACK_IMAGE_URL = "/data/product/product-lamp.jpg";

// Where a product image is shown from. Presets and URLs resolve directly; a
// base64 upload has no URL yet (real mode will persist it to outputs/), so in
// this mock slice it falls back to a bundled sample.
function resolveImageUrl(product: ImageInput): string {
	if ("preset" in product) {
		return presetUrl(product.preset);
	}
	if ("url" in product) {
		return product.url;
	}
	return FALLBACK_IMAGE_URL;
}

function describeProduct(product: ImageInput): string {
	if ("preset" in product) {
		return product.preset;
	}
	return "your product";
}

// Produces a placeholder post for one product image without calling any provider.
// Real providers will replace this behind the same (product, platform) -> Post shape.
export function generateMockPost(product: ImageInput, platform: Platform): Post {
	const config = PLATFORM_CONFIG[platform];
	const subject = describeProduct(product);
	const hashtags = ["batchcreative", "mock", platform, "post", subject].slice(
		0,
		config.hashtagCount,
	);
	return {
		imageUrl: resolveImageUrl(product),
		caption: `A ${platform} post for ${subject}. (mock)`.slice(0, config.captionMaxLength),
		hashtags,
		platform,
		meta: { mock: true, aspectRatio: config.aspectRatio },
	};
}
