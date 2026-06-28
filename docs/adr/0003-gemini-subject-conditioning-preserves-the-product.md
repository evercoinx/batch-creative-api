# Gemini subject conditioning preserves the real product

The Gemini leg now feeds the **product image bytes** to the image model on every
item, so the generated post shows the *real* product (its label, shape, and
proportions) rather than a text-described lookalike. This supersedes the
text-to-image decision in [ADR 0002](0002-style-consistency-via-shared-text-spec.md)
for the Gemini provider, and realizes the **upgrade path** that ADR recorded:
references already resolve to bytes via `resolveImageInput`, and the
`ImageProvider` seam passes the product bytes through unchanged.

The trigger was a model swap. The primary image model moves from Imagen 4
(`imagen-4.0-generate-001`, text-to-image only) to `gemini-2.5-flash-image`,
which accepts input image bytes and conditions the output on them. Per item,
`generate` resolves the product to bytes and sends them alongside the prompt via
`generateContent`; the prompt (`imagePrompt`) marks the supplied image as
**authoritative for product identity** and restyles only the surrounding scene
to the batch style spec.

Style consistency is unchanged: the single shared style spec from ADR 0002 is
still extracted once per batch in `describeStyle` and reused for every item.
Subject conditioning changes *what subject* each item depicts (the real product),
not *how the look is kept consistent* across the batch. Reference bytes are still
**not** fed per item — they are consumed once by `describeStyle`, so `generate`'s
`references` argument stays unused.

Reading the image out also changes shape: a subject-conditioning response
interleaves the image with optional text/thought parts, so `generate` scans the
candidate's parts for the one carrying `inlineData` rather than assuming a fixed
position.

## Considered options

- **Keep text-to-image (ADR 0002 as-is)** — rejected: it cannot preserve the
  real product, only describe a category, which the brief's "showcase the actual
  product" requirement does not accept.
- **Feed reference bytes per item too** — rejected: redundant with the
  once-per-batch style spec and risks the look drifting item to item, the failure
  mode ADR 0002 was built to avoid. References stay confined to `describeStyle`.
- **Switch the OpenAI fallback to image-to-image as well** — deferred: `gpt-image-1`
  conditioning lives behind a different API surface (`images.edit`, not
  `images.generate`); the fallback remains text-to-image for now.
