import { describe, it, expect } from "vitest";
import { AntigravityExecutor } from "../../open-sse/executors/antigravity.js";

describe("antigravity image edit — inline image survives transformRequest", () => {
  const ag = new AntigravityExecutor();

  it("keeps inlineData parts (img2img) alongside text", () => {
    const out = ag.transformRequest(
      "gemini-3-pro-image-preview",
      {
        contents: [
          {
            role: "user",
            parts: [
              { inlineData: { mimeType: "image/png", data: "BASE64" } },
              { text: "make it blue" },
            ],
          },
        ],
      },
      false,
      {}
    );

    const parts = out.request.contents[0].parts;
    expect(parts).toContainEqual({ inlineData: { mimeType: "image/png", data: "BASE64" } });
    expect(parts).toContainEqual({ text: "make it blue" });
  });

  it("merges client imageConfig over model-suffix default", () => {
    const out = ag.transformRequest(
      "gemini-3-pro-image-preview",
      {
        contents: [{ role: "user", parts: [{ text: "a cat" }] }],
        imageConfig: { aspectRatio: "16:9", imageSize: "2K", personGeneration: "ALLOW_ADULT" },
      },
      false,
      {}
    );

    expect(out.request.generationConfig.imageConfig).toEqual({
      aspectRatio: "16:9",
      imageSize: "2K",
      personGeneration: "ALLOW_ADULT",
    });
  });

  it("falls back to model-name-suffix aspectRatio when client sends none", () => {
    const out = ag.transformRequest(
      "gemini-3-pro-image-16x9",
      { contents: [{ role: "user", parts: [{ text: "a dog" }] }] },
      false,
      {}
    );

    expect(out.request.generationConfig.imageConfig.aspectRatio).toBe("16:9");
  });
});
