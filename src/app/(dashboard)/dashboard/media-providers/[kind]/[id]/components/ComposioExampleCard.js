"use client";

import { useState, useEffect } from "react";
import { Card } from "@/shared/components";
import { useCopyToClipboard } from "@/shared/hooks/useCopyToClipboard";
import { Row } from "./exampleShared";

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];
const FIELD_CLS = "w-full px-3 py-1.5 text-sm border border-border rounded-lg bg-background focus:outline-none focus:border-primary";

// Common Composio v3 endpoints (docs.composio.dev/api-reference) — quick-fill for testing.
const PRESETS = [
  { label: "List toolkits", method: "GET", path: "toolkits", body: "" },
  { label: "Get toolkit (gmail)", method: "GET", path: "toolkits/gmail", body: "" },
  { label: "List tools", method: "GET", path: "tools", body: "" },
  { label: "List tools by toolkit", method: "GET", path: "tools?toolkit_slug=gmail", body: "" },
  { label: "Get tool by slug", method: "GET", path: "tools/GMAIL_SEND_EMAIL", body: "" },
  { label: "Execute tool", method: "POST", path: "tools/execute/GMAIL_SEND_EMAIL", body: '{\n  "user_id": "default",\n  "input": {}\n}' },
  { label: "List connected accounts", method: "GET", path: "connected-accounts", body: "" },
  { label: "List auth configs", method: "GET", path: "auth-configs", body: "" },
  { label: "List triggers", method: "GET", path: "triggers", body: "" },
];

const DEFAULT_RESPONSE = `{\n  "items": [ ... ]\n}`;

// Composio is a multi-endpoint REST proxy, not a single fixed call like search/tts.
// So the example is a tiny API explorer: pick a preset (or method + sub-path + JSON body),
// optionally pin an account, hit /v1/tools/composio/<path>, show the response.
export function ComposioExampleCard({ providerId }) {
  const [method, setMethod] = useState("GET");
  const [path, setPath] = useState("toolkits");
  const [body, setBody] = useState("");
  const [connections, setConnections] = useState([]);
  const [pinnedConnectionId, setPinnedConnectionId] = useState("");
  const [origin, setOrigin] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);
  const { copied: copiedCurl, copy: copyCurl } = useCopyToClipboard();
  const { copied: copiedRes, copy: copyRes } = useCopyToClipboard();

  useEffect(() => {
    setOrigin(window.location.origin);
    fetch("/api/providers/client")
      .then((r) => r.json())
      .then((d) => setConnections((d.connections || []).filter((c) => c.provider === providerId && c.isActive !== false)))
      .catch(() => {});
  }, [providerId]);

  const applyPreset = (idx) => {
    const p = PRESETS[idx];
    if (!p) return;
    setMethod(p.method);
    setPath(p.path);
    setBody(p.body);
  };

  const cleanPath = path.trim().replace(/^\/+/, "");
  const sendBody = method !== "GET" && body.trim() !== "";
  const apiPath = `/v1/tools/composio/${cleanPath}`;

  const curlSnippet = [
    `curl -X ${method} ${origin}${apiPath}`,
    pinnedConnectionId ? `  -H "x-connection-id: ${pinnedConnectionId}"` : null,
    sendBody ? `  -H "Content-Type: application/json"` : null,
    sendBody ? `  -d '${body.trim()}'` : null,
  ].filter(Boolean).join(" \\\n");

  const handleRun = async () => {
    if (!cleanPath) return;
    setRunning(true);
    setError("");
    setResult(null);
    const start = Date.now();
    try {
      const headers = {};
      if (pinnedConnectionId) headers["x-connection-id"] = pinnedConnectionId;
      const init = { method, headers };
      if (sendBody) {
        headers["Content-Type"] = "application/json";
        init.body = body;
      }
      const res = await fetch(`/api${apiPath}`, init);
      const text = await res.text();
      let data;
      try { data = JSON.parse(text); } catch { data = text; }
      const latencyMs = Date.now() - start;
      if (!res.ok) {
        setError(typeof data === "object" ? (data?.error || `HTTP ${res.status}`) : `HTTP ${res.status}`);
      }
      setResult({ status: res.status, data, latencyMs });
    } catch (e) {
      setError(e.message || "Network error");
    } finally {
      setRunning(false);
    }
  };

  const resultJson = result ? (typeof result.data === "string" ? result.data : JSON.stringify(result.data, null, 2)) : "";

  return (
    <Card>
      <h2 className="text-lg font-semibold mb-4">Example</h2>
      <div className="flex flex-col gap-2.5">
        {/* Preset */}
        <Row label="Preset">
          <select defaultValue="" onChange={(e) => { applyPreset(Number(e.target.value)); e.target.value = ""; }} className={FIELD_CLS}>
            <option value="" disabled>Choose an endpoint…</option>
            {PRESETS.map((p, i) => <option key={p.label} value={i}>{p.label}</option>)}
          </select>
        </Row>

        {/* Method */}
        <Row label="Method">
          <select value={method} onChange={(e) => setMethod(e.target.value)} className={FIELD_CLS}>
            {METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </Row>

        {/* Path */}
        <Row label="Path">
          <div className="relative">
            <input
              value={path}
              onChange={(e) => setPath(e.target.value)}
              placeholder="toolkits"
              className="w-full px-3 py-1.5 pr-7 text-sm font-mono border border-border rounded-lg bg-background focus:outline-none focus:border-primary"
            />
            {path && (
              <button
                type="button"
                onClick={() => setPath("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-primary transition-colors"
              >
                <span className="material-symbols-outlined text-[14px]">close</span>
              </button>
            )}
          </div>
        </Row>

        {/* Body — only for non-GET */}
        {method !== "GET" && (
          <Row label="Body">
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder='{"user_id": "default", "input": {}}'
              rows={4}
              className={`${FIELD_CLS} font-mono resize-y`}
            />
          </Row>
        )}

        {/* Connection picker */}
        {connections.length > 0 && (
          <Row label="Connection">
            <select value={pinnedConnectionId} onChange={(e) => setPinnedConnectionId(e.target.value)} className={FIELD_CLS}>
              <option value="">Auto (by priority)</option>
              {connections.map((c) => (
                <option key={c.id} value={c.id}>{c.name || c.email || c.id.slice(0, 8)}</option>
              ))}
            </select>
          </Row>
        )}

        {/* Endpoint (computed, read-only) */}
        <Row label="Endpoint">
          <span className="px-3 py-1.5 text-sm font-mono text-text-main bg-sidebar rounded-lg truncate block">
            {origin}{apiPath}
          </span>
        </Row>

        {/* Curl + Run */}
        <div className="mt-1">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-1.5">
            <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Request</span>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
              <button
                onClick={() => copyCurl(curlSnippet)}
                className="inline-flex items-center gap-1 text-xs text-text-muted hover:text-primary transition-colors"
              >
                <span className="material-symbols-outlined text-[14px]">{copiedCurl ? "check" : "content_copy"}</span>
                {copiedCurl ? "Copied" : "Copy"}
              </button>
              <button
                onClick={handleRun}
                disabled={running || !cleanPath}
                className="flex w-full sm:w-auto items-center justify-center gap-1.5 px-3 py-1 rounded-lg bg-primary text-white text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="material-symbols-outlined text-[14px]" style={running ? { animation: "spin 1s linear infinite" } : undefined}>
                  play_arrow
                </span>
                {running ? "Running..." : "Run"}
              </button>
            </div>
          </div>
          <pre className="bg-sidebar rounded-lg px-3 py-2.5 text-xs font-mono text-text-main overflow-x-auto whitespace-pre-wrap break-all">{curlSnippet}</pre>
        </div>

        {/* Error */}
        {error && <p className="text-xs text-red-500 break-words">{error}</p>}

        {/* Response */}
        <div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-1.5">
            <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
              Response {result && <span className="font-normal normal-case">{result.status} &#9889; {result.latencyMs}ms</span>}
            </span>
            {result && (
              <button
                onClick={() => copyRes(resultJson)}
                className="inline-flex items-center gap-1 text-xs text-text-muted hover:text-primary transition-colors"
              >
                <span className="material-symbols-outlined text-[14px]">{copiedRes ? "check" : "content_copy"}</span>
                {copiedRes ? "Copied" : "Copy"}
              </button>
            )}
          </div>
          <pre className="bg-sidebar rounded-lg px-3 py-2.5 text-xs font-mono text-text-main overflow-x-auto whitespace-pre-wrap break-all opacity-70 max-h-96">
            {result ? resultJson : DEFAULT_RESPONSE}
          </pre>
        </div>
      </div>
    </Card>
  );
}
