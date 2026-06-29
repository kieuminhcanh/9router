import { describe, it, expect } from "vitest";
import { handleComboChat } from "../../open-sse/services/combo.js";

// STT combos pass a FormData body (not JSON) through handleComboChat. Verify the
// fallback path tolerates FormData and forwards the same body to each model.
const noopLog = { info: () => {}, warn: () => {} };

describe("combo fallback with FormData body (STT)", () => {
  it("falls back to the next model and reuses the same FormData", async () => {
    const fd = new FormData();
    fd.append("file", new Blob([new Uint8Array([1, 2, 3])], { type: "audio/wav" }), "a.wav");

    const seen = [];
    const handleSingleModel = (body, modelStr) => {
      seen.push({ body, modelStr });
      // First model: 503 (transient → fallback); second: 200
      return modelStr === "p1/m1"
        ? new Response("busy", { status: 503 })
        : new Response(JSON.stringify({ text: "ok" }), { status: 200 });
    };

    const res = await handleComboChat({
      body: fd,
      models: ["p1/m1", "p2/m2"],
      handleSingleModel,
      log: noopLog,
      comboName: "stt-combo",
      comboStrategy: "fallback",
    });

    expect(res.status).toBe(200);
    expect(seen.map((s) => s.modelStr)).toEqual(["p1/m1", "p2/m2"]);
    // Same FormData object forwarded to every attempt (file reused across fallback)
    expect(seen[0].body).toBe(fd);
    expect(seen[1].body).toBe(fd);
  });
});
