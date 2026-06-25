# Batch Creative API

An HTTP service that takes product images and reference images and returns,
for each product image, a social post styled to match the reference — built
for reliability and consistent visual style at batch scale.

## Language

**Product image**:
An input image of the item being marketed. A batch has N of them; one post is
generated per product image.
_Avoid_: subject, asset, source image

**Reference image**:
An input image (1–2 per batch) that defines the target visual style. Every
product image in the batch is styled to match it.
_Avoid_: context image, mood image, template

**Style spec**:
A text description of the reference's visual style (palette, mood, lighting,
composition), extracted once per batch from the reference image(s) and reused
for every product image to keep the batch visually consistent.
_Avoid_: prompt, style guide, theme

**Post**:
The unit of output for one product image: a styled image plus a caption,
hashtags, and platform metadata. One post per product image.
_Avoid_: creative, ad, output

**Platform**:
The target social network (instagram | x | linkedin) chosen per request. Sets
caption length, image aspect ratio, and hashtag conventions. Content is
generated only — never published to the real network.
_Avoid_: channel, network, destination

**Batch**:
One request to generate posts for N product images against the reference(s).
Processed asynchronously; identified by a batch id; tracks per-item status so
one failed item does not fail the whole batch.
_Avoid_: job, run, task

**Provider**:
An external image-generation service (Gemini primary, OpenAI fallback) behind
a common interface. On failure the batch fails over from primary to secondary.
_Avoid_: backend, vendor, engine

**Mock mode**:
Behaviour when no provider API keys are present: the service returns
placeholder images and canned captions so the demo and CI work without
spending credits.
_Avoid_: stub mode, fake mode, offline mode
