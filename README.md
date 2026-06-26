# Batch Creative API

One on-brand social post per product image, generated as a reliable, async
batch. Submit N **product images** plus 1–2 **reference images** and a target
**platform**; the service returns, for each product, a **post** — a styled image
matched to the reference, with a caption, hashtags, and platform metadata.

The batch runs asynchronously and resiliently: per-call retries, multi-provider
failover (Gemini → OpenAI), and a single style spec extracted once from the
references keep every output consistent, while one failed item never sinks the
whole batch. Content is generated only, never published to a real network.

See `CONTEXT.md` for the domain glossary and `docs/adr/` for the architecture
decisions (`0001` async batch API + failover, `0002` style consistency via a
shared text spec).

## Quick start

```bash
npm ci
npm start        # http://localhost:3000 — open it for the interactive demo
```

With no provider keys the service runs in **mock mode** (placeholder images,
canned captions), so the demo and CI work without spending credits.

### API

- `POST /batches` — body `{ products: ImageInput[], references?: ImageInput[] (1–2), platform?: "instagram" | "x" | "linkedin" }`, where `ImageInput` is `{ url }` | `{ base64 }` | `{ preset }`. Returns `{ batchId }` (202). Over-cap / malformed → 400.
- `GET /batches/:id` — batch status plus, per item, `{ status, post?, error? }` where `post = { imageUrl, caption, hashtags, platform, meta }`.
- `GET /` — the demo web page.

```bash
curl -s -XPOST localhost:3000/batches -H 'content-type: application/json' \
  -d '{"products":[{"preset":"lamp"},{"preset":"phone"}],"references":[{"preset":"forest"}],"platform":"instagram"}'
# -> {"batchId":"..."}  then poll GET /batches/<id>
```

### Scripts

- `npm run typecheck` — `tsc --noEmit`
- `npm test` — vitest (retry/failover/lifecycle covered with a scripted mock provider, no network)
- `npm run lint` / `npm run format` — Biome lint / format (`npm run check` for both; `check:write` to fix)

## Configuration

Provider keys are read **only** from the environment — never commit real keys.
Copy `.env.example` to `.env` for local live mode.

| Variable | Purpose |
| --- | --- |
| `GEMINI_API_KEY` | Primary provider (Gemini). |
| `OPENAI_API_KEY` | Fallback provider (OpenAI). |
| `PORT` | HTTP port (default `3000`). |
| `MAX_PRODUCTS_PER_BATCH` | Cap on products per batch (default `10`). |
| `MAX_CONCURRENT_BATCHES` | Cap on in-flight batches (default `5`). |
| `MAX_BODY_SIZE` | Express body limit (default `2mb`). |
| `ITEM_CONCURRENCY` | Bounded fan-out per batch (default `4`). |

With **both** keys present the service uses the real providers (Gemini primary,
OpenAI fallback). With **one** key it uses that single provider (no failover).
With **neither** it runs in mock mode.

## Deploy (Render)

The repo ships a committed `render.yaml` describing a single Render web service,
so the deployment is reproducible. Ephemeral disk is acceptable — `outputs/`
regenerates and the in-memory batch store starts fresh on restart.

1. Push this repo to GitHub.
2. In the Render dashboard, **New → Blueprint** and point it at the repo; Render
   reads `render.yaml` and provisions the `batch-creative-api` web service
   (build `npm ci`, start `npm start`, health check `/`).
3. Set the provider keys as service **environment variables** (marked
   `sync: false` in `render.yaml`, so they are entered in the dashboard, never
   committed):
   - `GEMINI_API_KEY`
   - `OPENAI_API_KEY`

   Leave both unset to deploy the live demo in mock mode.
4. Deploy. The service is reachable at its Render URL; `GET /` serves the demo
   page.

Provisioning the service and entering the keys in the dashboard is a one-time
manual operator step.

### Known limitations of the live demo

- **Free-tier cold start.** The service runs on Render's free plan, which spins
  down after inactivity. The first request after an idle period waits for a cold
  start (tens of seconds) before the demo responds; subsequent requests are fast.
- **Presets only.** The demo page submits bundled **preset** products and
  reference styles — there is no upload. To try your own images, call
  `POST /batches` directly with `{ base64 }` inputs.
- **`url` inputs are unsupported.** An `ImageInput` of `{ url }` is rejected with
  a clear "not yet supported" error; use `{ preset }` or `{ base64 }` instead.
