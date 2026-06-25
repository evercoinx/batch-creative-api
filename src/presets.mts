import { fileURLToPath } from "node:url";

// Preset name -> bundled sample image under data/. Presets let a caller (and the
// demo page) submit a batch without uploading anything. Product and reference
// presets share one namespace; the request schema validates names against it.
const PRESET_FILES = {
	lamp: "data/product/product-lamp.jpg",
	phone: "data/product/product-phone.jpg",
	shampoo: "data/product/product-shampoo.jpg",
	forest: "data/reference/context-forest.jpg",
	mars: "data/reference/context-mars.jpg",
	skytower: "data/reference/context-skytower.jpg",
} as const;

export type PresetName = keyof typeof PRESET_FILES;

export const PRESET_NAMES = Object.keys(PRESET_FILES) as [PresetName, ...PresetName[]];

export function isPresetName(value: string): value is PresetName {
	return Object.hasOwn(PRESET_FILES, value);
}

// Absolute path on disk for a preset, resolved relative to the repo root (two
// levels up from this file in src/).
export function presetPath(name: PresetName): string {
	return fileURLToPath(new URL(`../${PRESET_FILES[name]}`, import.meta.url));
}

// The URL a client uses to fetch a preset's image; data/ is served statically.
export function presetUrl(name: PresetName): string {
	return `/${PRESET_FILES[name]}`;
}
