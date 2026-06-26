import { readFile } from "node:fs/promises";
import { presetPath } from "../presets.mts";
import type { ImageInput } from "./schema.mts";

// The single place that knows how an image input becomes pixels: presets read
// from disk, inline base64 decodes, and `url` is explicitly unsupported. Every
// caller that needs reference (or product) bytes goes through here.
export type ResolvedImage = { bytes: Buffer; mimeType: string };

// data:[<mime>][;base64],<payload> — the mime and the ;base64 marker are both
// optional, so an inline input may arrive bare or as a full data URL.
const DATA_URL = /^data:([^;,]+)?(?:;base64)?,(.*)$/s;

// Best-effort mime from the leading magic bytes, so a bare base64 payload still
// resolves to a sensible content type. Unknown signatures fall back to the
// generic binary type rather than guessing.
function sniffMimeType(bytes: Buffer): string {
	if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
		return "image/jpeg";
	}
	if (bytes.length >= 4 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
		return "image/png";
	}
	if (bytes.length >= 4 && bytes.toString("ascii", 0, 3) === "GIF") {
		return "image/gif";
	}
	if (bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") {
		return "image/webp";
	}
	return "application/octet-stream";
}

export async function resolveImageInput(input: ImageInput): Promise<ResolvedImage> {
	if ("preset" in input) {
		const bytes = await readFile(presetPath(input.preset));
		return { bytes, mimeType: sniffMimeType(bytes) };
	}
	if ("base64" in input) {
		const match = DATA_URL.exec(input.base64);
		const declaredMime = match?.[1];
		const payload = match ? (match[2] ?? "") : input.base64;
		const bytes = Buffer.from(payload, "base64");
		return { bytes, mimeType: declaredMime ?? sniffMimeType(bytes) };
	}
	// `url` inputs are schema-accepted but resolution is deferred: fetching a
	// caller-supplied URL is an SSRF surface and there is no caller yet (PRD #10).
	throw new Error("url inputs not yet supported");
}
