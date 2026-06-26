import { fileURLToPath } from "node:url";
import express, {
	type ErrorRequestHandler,
	type Request,
	type Response,
} from "express";
import { OUTPUTS_DIR, OUTPUTS_URL_PREFIX } from "./batch/outputs.mts";
import { processBatch } from "./batch/processor.mts";
import type { ImageProvider } from "./batch/provider.mts";
import { createProviders } from "./batch/providers/index.mts";
import { createBatchSchema } from "./batch/schema.mts";
import { BatchStore } from "./batch/store.mts";
import { MAX_BODY_SIZE, MAX_CONCURRENT_BATCHES } from "./config.mts";

export type AppDeps = {
	store?: BatchStore;
	providers?: ImageProvider[];
};

const DATA_DIR = fileURLToPath(new URL("../data", import.meta.url));
const PUBLIC_DIR = fileURLToPath(new URL("../public", import.meta.url));

export function createApp(deps: AppDeps = {}): express.Express {
	const store = deps.store ?? new BatchStore();
	const providers = deps.providers ?? createProviders();

	const app = express();
	app.use(express.json({ limit: MAX_BODY_SIZE }));

	app.use("/data", express.static(DATA_DIR));
	app.use(OUTPUTS_URL_PREFIX, express.static(OUTPUTS_DIR));
	app.use(express.static(PUBLIC_DIR));

	app.post("/batches", (req: Request, res: Response) => {
		// Concurrent-batches cap: reject before parsing so a flood gets a fast 400.
		if (store.activeCount() >= MAX_CONCURRENT_BATCHES) {
			res.status(400).json({
				error: `Too many active batches (max ${MAX_CONCURRENT_BATCHES}); retry once some finish.`,
			});
			return;
		}

		const parsed = createBatchSchema.safeParse(req.body);
		if (!parsed.success) {
			res
				.status(400)
				.json({ error: "Invalid request", issues: parsed.error.issues });
			return;
		}

		const batch = store.create(parsed.data);
		// Fire-and-forget: the caller gets the id immediately and polls for progress.
		void processBatch(batch, providers);
		res.status(202).json({ batchId: batch.id });
	});

	app.get("/batches/:id", (req: Request, res: Response) => {
		const id = req.params.id;
		const batch = typeof id === "string" ? store.get(id) : undefined;
		if (!batch) {
			res.status(404).json({ error: "Batch not found" });
			return;
		}
		res.json(store.view(batch));
	});

	// Body-parser failures (malformed JSON, body over the size cap) surface here;
	// normalize them to 400 so all bad input is reported the same way.
	const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
		if (
			err instanceof Error &&
			"status" in err &&
			(err.status === 400 || err.status === 413)
		) {
			res.status(400).json({ error: `Invalid request body: ${err.message}` });
			return;
		}
		res.status(500).json({ error: "Internal server error" });
	};
	app.use(errorHandler);

	return app;
}
