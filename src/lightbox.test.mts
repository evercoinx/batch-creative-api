import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// The demo UI is a single vanilla HTML/CSS/JS file with no DOM test harness
// (PRD #20: automated Playwright/Cypress is out of scope). These checks pin the
// lightbox contract against the file's text — the same static-contract posture
// the deploy/ADR tests use — so the acceptance criteria can't silently regress.
const html = readFileSync(
	fileURLToPath(new URL("../public/index.html", import.meta.url)),
	"utf8",
);

describe("post image lightbox", () => {
	it("injects a single hidden lightbox overlay with an image and a close button", () => {
		// One overlay, populated and shown on click; hidden by default.
		expect(html).toContain('id = "lightbox"');
		expect(html).toMatch(/#lightbox\s*\{[\s\S]*?display:\s*none/);
		// The enlarged <img> and the × close button live inside the overlay.
		expect(html).toContain("lightbox-close");
		expect(html).toContain("×");
	});

	it("backdrop is dark semi-transparent and fixed above all other elements", () => {
		expect(html).toMatch(
			/#lightbox\s*\{[\s\S]*?background:\s*rgba\(0,\s*0,\s*0,\s*0\.85\)/,
		);
		expect(html).toMatch(/#lightbox\s*\{[\s\S]*?position:\s*fixed/);
		expect(html).toMatch(/#lightbox\s*\{[\s\S]*?z-index:/);
	});

	it("enlarged image is sized to the viewport without cropping", () => {
		// 90vw/90vh + object-fit: contain handles square/portrait/landscape on
		// both desktop and mobile (390px) with no fixed pixel dimensions.
		expect(html).toMatch(/#lightbox img\s*\{[\s\S]*?max-width:\s*90vw/);
		expect(html).toMatch(/#lightbox img\s*\{[\s\S]*?max-height:\s*90vh/);
		expect(html).toMatch(/#lightbox img\s*\{[\s\S]*?object-fit:\s*contain/);
	});

	it("reuses the existing fade-in keyframe for the open transition", () => {
		expect(html).toMatch(/#lightbox\s*\{[\s\S]*?animation:\s*fade-in/);
	});

	it("signals clickability with a pointer cursor on result thumbnails", () => {
		expect(html).toMatch(/\.item img\s*\{[^}]*cursor:\s*pointer/);
	});

	it("opens the lightbox from a result image with the clicked src", () => {
		// Click handler attached to .item <img> elements; src copied verbatim.
		expect(html).toMatch(/\.item img/);
		expect(html).toMatch(/openLightbox\(/);
		expect(html).toMatch(/lightboxImg\.src\s*=/);
	});

	it("dismisses via close button, backdrop click, and Escape", () => {
		// Backdrop closes; the inner wrapper stops propagation so a click on the
		// image itself does not close the lightbox.
		expect(html).toMatch(/stopPropagation\(\)/);
		// Escape only while the lightbox is visible.
		expect(html).toMatch(/keydown/);
		expect(html).toContain('"Escape"');
		expect(html).toMatch(/closeLightbox\(/);
	});
});
