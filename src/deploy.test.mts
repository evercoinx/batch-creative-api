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

	it("README documents the deploy steps and required env vars", () => {
		const readme = readFileSync(root("README.md"), "utf8");
		expect(readme).toContain("render.yaml");
		expect(readme).toContain("GEMINI_API_KEY");
		expect(readme).toContain("OPENAI_API_KEY");
	});
});
