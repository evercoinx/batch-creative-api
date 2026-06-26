import { MOCK_MODE } from "./config.mts";
import { createApp } from "./server.mts";

const PORT = Number.parseInt(process.env.PORT ?? "3000", 10);

const app = createApp();
app.listen(PORT, () => {
	const mode = MOCK_MODE ? "mock mode (no provider keys set)" : "live mode";
	console.log(
		`Batch Creative API listening on http://localhost:${PORT} — ${mode}`,
	);
});
