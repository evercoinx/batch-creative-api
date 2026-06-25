# Async batch HTTP API with multi-provider image-generation failover

We replace the starter CLI with an Express HTTP service exposing an async batch
endpoint: `POST /batches` accepts N product images + 1–2 reference images
(URL or base64) and a platform, returns a `batchId`; `GET /batches/:id` polls
per-item status and results. Async (not sync) because per-image generation is
slow and we want one failed item not to fail the batch — the goal stated in the
brief is reliability and consistency at scale.

Image generation goes through a common `ImageProvider` interface with Gemini
primary and OpenAI fallback. Each call retries transient errors (3x, exp
backoff + jitter, no retry on 4xx); on exhaustion the batch fails over to the
secondary provider; if both fail the item is marked `failed` and the batch
continues. Visual consistency is enforced by extracting one style spec from the
reference once per batch and reusing it (plus fixed params) for every product
image.

Store is in-memory and generated images are written to local disk and served as
URLs — single-process, sufficient for a showcase demo. Upgrade path if this ever
needs multiple instances: Redis/Postgres for batch state, S3 for images.

When provider keys are absent the service runs in mock mode (placeholder images
+ canned captions) so the public demo and CI work without spending credits.

## Considered options

- **NestJS** — rejected: DI/module machinery is abstraction tax for a 2-endpoint
  in-memory service; revisit only if this grows many domains/guards.
- **Synchronous batch endpoint** — rejected: long generation times risk HTTP
  timeouts and couple whole-batch success to every item.
- **Vercel/Netlify serverless** — rejected: ephemeral disk + no long-running
  process fight the async-batch + disk-output design. Deploying to Render.
