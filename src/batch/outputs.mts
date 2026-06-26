import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { GeneratedImage } from "./provider.mts";

// Generated images are written to outputs/ at the repo root and served as URLs
// (captions/hashtags/meta stay inline in the batch JSON). Disk is ephemeral —
// a fresh run regenerates everything (ADR 0001).
export const OUTPUTS_DIR = fileURLToPath(
	new URL("../../outputs", import.meta.url),
);

// URL prefix the static handler mounts OUTPUTS_DIR under; also the path embedded
// in each post's imageUrl.
export const OUTPUTS_URL_PREFIX = "/outputs";

const MIME_EXTENSIONS: Record<string, string> = {
	"image/jpeg": "jpg",
	"image/png": "png",
	"image/webp": "webp",
};

// Writes one generated image to outputs/<name>.<ext> and returns the URL path
// under which it is served. `name` is the caller's stable key (batch id + item
// index) so re-runs overwrite rather than accumulate.
export type OutputWriter = (
	image: GeneratedImage,
	name: string,
) => Promise<string>;

export const writeOutput: OutputWriter = async (image, name) => {
	await mkdir(OUTPUTS_DIR, { recursive: true });
	const ext = MIME_EXTENSIONS[image.mimeType] ?? "bin";
	const filename = `${name}.${ext}`;
	await writeFile(join(OUTPUTS_DIR, filename), image.imageBytes);
	return `${OUTPUTS_URL_PREFIX}/${filename}`;
};
