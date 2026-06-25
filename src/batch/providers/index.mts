import { MockProvider } from "../mock-provider.mts";
import type { ImageProvider } from "../provider.mts";
import { GeminiProvider } from "./gemini.mts";
import { OpenAIProvider } from "./openai.mts";

// Provider selection from the environment. Gemini is primary, OpenAI the
// fallback; the order of this array is the failover order. Keys are read only
// from env vars (GEMINI_API_KEY, OPENAI_API_KEY). With neither key present the
// service runs entirely in mock mode, so the demo and CI work without credits.
export function createProviders(env: NodeJS.ProcessEnv = process.env): ImageProvider[] {
	const providers: ImageProvider[] = [];
	if (env.GEMINI_API_KEY) {
		providers.push(new GeminiProvider(env.GEMINI_API_KEY));
	}
	if (env.OPENAI_API_KEY) {
		providers.push(new OpenAIProvider(env.OPENAI_API_KEY));
	}
	if (providers.length === 0) {
		providers.push(new MockProvider());
	}
	return providers;
}
