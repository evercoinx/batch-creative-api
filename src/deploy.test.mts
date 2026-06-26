import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// The deploy config is committed so the Render deployment is reproducible (PRD
// "operator wants a committed deploy config"). These checks pin the contract the
// author relies on without standing up a real deploy.
const root = (rel: string) => fileURLToPath(new URL(`../${rel}`, import.meta.url));

describe("Render deploy config", () => {
	it("render.yaml declares a web service that builds and starts the app", () => {
		const yaml = readFileSync(root("render.yaml"), "utf8");
		expect(yaml).toContain("type: web");
		// Runs the same scripts as local/CI so deploy can't drift from package.json.
		expect(yaml).toContain("npm ci");
		expect(yaml).toContain("npm start");
		// Provider keys are wired as env vars, set by the author in the dashboard.
		expect(yaml).toContain("GEMINI_API_KEY");
		expect(yaml).toContain("OPENAI_API_KEY");
	});

	it("render.yaml pins the project's standard Node 26 runtime", () => {
		const yaml = readFileSync(root("render.yaml"), "utf8");
		expect(yaml).toMatch(/NODE_VERSION[\s\S]*?value:\s*"26"/);
	});

	it("render.yaml supplies GEMINI_API_KEY as a non-synced dashboard secret", () => {
		const yaml = readFileSync(root("render.yaml"), "utf8");
		// The key must never be committed: it carries `sync: false` so Render
		// prompts for it in the dashboard rather than reading a committed value.
		expect(yaml).toMatch(/key:\s*GEMINI_API_KEY[\s\S]*?sync:\s*false/);
		expect(yaml).not.toMatch(/GEMINI_API_KEY[\s\S]*?value:/);
	});

	it("CI runs on Node 26 to match the deploy runtime", () => {
		const ci = readFileSync(root(".github/workflows/ci.yml"), "utf8");
		expect(ci).toMatch(/node-version:\s*26/);
	});

	it("README documents the deploy steps and required env vars", () => {
		const readme = readFileSync(root("README.md"), "utf8");
		expect(readme).toContain("render.yaml");
		expect(readme).toContain("GEMINI_API_KEY");
		expect(readme).toContain("OPENAI_API_KEY");
	});

	it("README documents the known limitations of the live demo", () => {
		const readme = readFileSync(root("README.md"), "utf8").toLowerCase();
		// Free-tier cold start, presets-only demo, and the unsupported url input
		// (PRD user story 20: the next person shouldn't re-derive these).
		expect(readme).toContain("cold start");
		expect(readme).toContain("preset");
		expect(readme).toContain("url");
	});
});
