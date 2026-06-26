# Style consistency via a shared text spec, not per-image conditioning

A batch must produce a social post per product image with a **consistent visual
style across every output** (the challenge's headline requirement). We guarantee
that consistency by extracting one text **style spec** from the reference
image(s) once per batch and reusing that single spec — plus fixed per-platform
params — for every product image, generating each post **text-to-image**.

The reference images shape the output *only* through this shared style spec: a
vision model reads the references into the spec (`describeStyle` on the
`ImageProvider` seam, run once per batch in the processor before item fan-out),
and the image model is then prompted with the product subject plus that spec.
Product and reference bytes are **not** fed to the image model.

This is a deliberate constraint of the primary image model. Imagen 4
(`imagen-4.0-generate-001`) is text-to-image only and cannot be conditioned on
input image bytes, so per-image **image-to-image** / subject-driven conditioning
is not available to us. Reusing one spec across the batch makes consistency a
property of the prompt rather than of model conditioning, which both satisfies
the requirement and keeps the vision model called once rather than N times.

## Considered options

- **Per-image image-to-image conditioning** (feed reference and/or product bytes
  to the image model for each item) — rejected: the primary model does not
  support it, and per-image conditioning would not by itself guarantee a single
  shared look across the batch. This is the recorded **upgrade path**: if a
  conditioning-capable model is adopted later, the references already resolve to
  bytes (`resolveImageInput`) and the seam can pass them through.
- **Re-extracting the style per item** — rejected: redundant vision calls (N per
  batch instead of 1) and risks the look drifting item to item, defeating the
  consistency goal.
- **No style spec, prompt the references inline per call** — rejected: couples
  every generation to image inputs the text-to-image model can't use and loses
  the one-place, once-per-batch invariant the glossary defines.
