---
name: 9router-image
description: Generate images via 9Router /v1/images/generations using OpenAI / Gemini (nano-banana) / Antigravity / DALL-E / FLUX / MiniMax / SDWebUI / ComfyUI / Codex models. Use when the user wants to create, generate, draw, or render an image, picture, or text-to-image (txt2img).
---

# 9Router — Image Generation

Requires `NINEROUTER_URL` (and `NINEROUTER_KEY` if auth enabled). See https://raw.githubusercontent.com/decolua/9router/refs/heads/master/skills/9router/SKILL.md for setup.

## Discover

```bash
curl $NINEROUTER_URL/v1/models/image | jq '.data[].id'
# Per-model params/options (size enum, quality enum, capabilities like edit)
curl "$NINEROUTER_URL/v1/models/info?id=openai/dall-e-3"
```

## Endpoint

`POST $NINEROUTER_URL/v1/images/generations`

| Field | Required | Notes |
|---|---|---|
| `model` | yes | from `/v1/models/image` |
| `prompt` | yes | image description |
| `n` | no | count (provider-dependent; Gemini/Antigravity ignore it) |
| `size` | no | `1024x1024`, `1920x1080`, ... → auto-mapped to `aspect_ratio` for Gemini/Antigravity |
| `aspect_ratio` | no | Gemini/Antigravity: `1:1` `2:3` `3:2` `3:4` `4:3` `9:16` `16:9` `21:9` (overrides `size`) |
| `image_size` | no | Gemini/Antigravity resolution tier: `1K` (default) / `2K` / `4K` |
| `person_generation` | no | Gemini/Antigravity: `ALLOW_ALL` / `ALLOW_ADULT` / `ALLOW_NONE` |
| `quality` | no | `standard` / `hd` (OpenAI) |
| `response_format` | no | OpenAI-family only (`url` / `b64_json`); native providers ignore it — see Response shape |

Add query `?response_format=binary` to receive raw image bytes (handy for saving file; works for any provider).

## Examples

Save to file (binary):

```bash
curl -X POST "$NINEROUTER_URL/v1/images/generations?response_format=binary" \
  -H "Authorization: Bearer $NINEROUTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"gemini/gemini-3-pro-image-preview","prompt":"watercolor mountains at sunrise","size":"1024x1024"}' \
  --output out.png
```

16:9 widescreen at 2K, with person policy (Gemini / Antigravity):

```bash
curl -X POST "$NINEROUTER_URL/v1/images/generations?response_format=binary" \
  -H "Authorization: Bearer $NINEROUTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"gemini/gemini-3-pro-image-preview","prompt":"a smiling chef in a kitchen","aspect_ratio":"16:9","image_size":"2K","person_generation":"ALLOW_ADULT"}' \
  --output out_169.jpg
```

JS (JSON response — read `url` or `b64_json` per provider):

```js
const r = await fetch(`${process.env.NINEROUTER_URL}/v1/images/generations`, {
  method: "POST",
  headers: { "Authorization": `Bearer ${process.env.NINEROUTER_KEY}`, "Content-Type": "application/json" },
  body: JSON.stringify({ model: "gemini/gemini-3-pro-image-preview", prompt: "neon city", size: "1024x1024" }),
});
const { data } = await r.json();
console.log(data[0].url || data[0].b64_json.slice(0, 40));
```

## Response shape

`{ created, data: [...] }`. Each item is `url` OR `b64_json` — **decided by the provider, not the `response_format` field**:

- Returns `url`: `fal-ai`, `black-forest-labs`, `runwayml`, `nanobanana`, OpenAI DALL·E
- Returns `b64_json`: `gemini`, `ag` (antigravity), `huggingface`, `stability-ai`, `sdwebui`, `codex`
- OpenAI-family (`openai` / `minimax` / `openrouter` / `recraft`): forwards `response_format` upstream, so `url` / `b64_json` both work

```json
{ "created": 1735000000, "data": [{ "url": "https://..." }] }
{ "created": 1735000000, "data": [{ "b64_json": "iVBORw0KGgo..." }] }
```

Query `?response_format=binary` returns raw image bytes (Content-Type `image/png` or `image/jpeg`) — works for any provider, including the `b64_json`-only ones above.

## Provider quirks

Common fields above work everywhere. These add/override:

| Provider | Extra/changed fields | Notes |
|---|---|---|
| `openai`, `minimax`, `openrouter`, `recraft` | all OpenAI fields forwarded (`quality`, `style`, `response_format`, `background`, `moderation`, `output_format`, `user`, ...) | Standard OpenAI shape |
| `gemini` (nano-banana) | `aspect_ratio`, `image_size`, `person_generation` | `size`→ratio; ignores `n`; returns `b64_json` |
| `ag` (antigravity) | `image` (edit), `aspect_ratio`, `image_size`, `person_generation` | `size`→ratio (or bake into model id, e.g. `...-16x9`); returns `b64_json` |
| `codex` (gpt-5.4-image) | `image`, `images[]`, `image_detail`, `output_format`, `background` | SSE stream; **ChatGPT Plus/Pro required** |
| `huggingface` | — | Only `prompt`; returns single image |
| `nanobanana` | `image`, `images[]` (edit mode) | `size` → aspect ratio; async polling |
| `fal-ai` | `image` (img2img) | `n` → `num_images`; `size` → ratio; async |
| `stability-ai` | `style` (preset), `output_format` | `size` → `aspect_ratio` |
| `black-forest-labs` (FLUX) | `image` (ref) | `size` → exact `width`/`height`; async |
| `runwayml` | `image` (ref) | `size` → ratio; async; video models exist |
| `sdwebui`, `comfyui` | — | Localhost noAuth (`:7860` / `:8188`) |

## Combos

Pass a combo name as `model` to auto-fall-back across its image models (create on the dashboard Image page → "Create Combo"): `{"model":"image-combo","prompt":"..."}`. Works with `?response_format=binary` too.
