// Shared helpers for image provider adapters

export const POLL_INTERVAL_MS = 1500;
export const POLL_TIMEOUT_MS = 120000;

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Map OpenAI size to provider-specific aspect ratio
export function sizeToAspectRatio(size) {
  if (!size || typeof size !== "string") return "1:1";
  const map = {
    "1024x1024": "1:1",
    "1024x1792": "9:16",
    "1792x1024": "16:9",
    "1024x1536": "2:3",
    "1536x1024": "3:2",
  };
  return map[size] || "1:1";
}

// Gemini generateContent imageConfig (aspectRatio/imageSize/personGeneration)
const GEMINI_ASPECT_RATIOS = new Set(["1:1", "2:3", "3:2", "3:4", "4:3", "9:16", "16:9", "21:9"]);

// Reduce "1920x1080" → "16:9"; returns null if not a supported Gemini ratio
function sizeToGeminiAspect(size) {
  if (typeof size !== "string") return null;
  const m = /^(\d+)x(\d+)$/.exec(size);
  if (!m) return null;
  const gcd = (a, b) => (b ? gcd(b, a % b) : a);
  const [w, h] = [Number(m[1]), Number(m[2])];
  const d = gcd(w, h) || 1;
  const ratio = `${w / d}:${h / d}`;
  return GEMINI_ASPECT_RATIOS.has(ratio) ? ratio : null;
}

// Build generationConfig.imageConfig from OpenAI-style body. Returns null if nothing set.
export function buildGeminiImageConfig(body) {
  const cfg = {};
  const aspect = body.aspect_ratio || sizeToGeminiAspect(body.size);
  if (aspect) cfg.aspectRatio = aspect;
  if (body.image_size) cfg.imageSize = body.image_size; // 1K | 2K | 4K
  if (body.person_generation) cfg.personGeneration = body.person_generation; // ALLOW_ALL | ALLOW_ADULT | ALLOW_NONE
  return Object.keys(cfg).length ? cfg : null;
}

// Fetch URL → base64 (for providers returning image URLs)
export async function urlToBase64(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`);
  const buf = await res.arrayBuffer();
  return Buffer.from(buf).toString("base64");
}

export function nowSec() {
  return Math.floor(Date.now() / 1000);
}
