import { getProviderCredentials, extractApiKey } from "@/sse/services/auth.js";
import { getSettings, getProviderConnections, getApiKeyByValue } from "@/lib/localDb";

// Transparent reverse-proxy for the Composio REST API.
// Client hits /v1/tools/composio/<path> -> forwarded to backend.composio.dev/api/v3.1/<path>
// with a stored Composio key injected. One base URL, no Composio key on the client.
//
// Access control (when settings.requireApiKey is on): the request must carry a valid
// 9router API key (Authorization: Bearer ...). Only Composio connections bound to that
// key (providerSpecificData.allowedApiKeyId) are usable, and they round-robin among
// themselves. No bound connection -> 403. This is how multiple Composio projects stay
// isolated per API key. x-connection-id can still pin one connection within that set.
// ponytail: plain fetch; swap to proxyAwareFetch if Composio ever IP-blocks us.

const COMPOSIO_BASE = "https://backend.composio.dev/api/v3.1";

/**
 * Handle CORS preflight
 */
export async function OPTIONS() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "*"
    }
  });
}

async function proxy(request, { params }) {
  let restrictConnectionIds = null;

  const settings = await getSettings();
  if (settings.requireApiKey) {
    const key = extractApiKey(request);
    if (!key) return Response.json({ error: "Missing API key" }, { status: 401 });
    const keyRecord = await getApiKeyByValue(key);
    if (!keyRecord || !keyRecord.isActive) return Response.json({ error: "Invalid API key" }, { status: 401 });

    const conns = await getProviderConnections({ provider: "composio", isActive: true });
    const allowed = conns.filter((c) => c.providerSpecificData?.allowedApiKeyId === keyRecord.id).map((c) => c.id);
    if (allowed.length === 0) {
      return Response.json({ error: "No Composio connection is authorized for this API key" }, { status: 403 });
    }
    restrictConnectionIds = new Set(allowed);
  }

  const preferredConnectionId = request.headers.get("x-connection-id") || null;
  const credentials = await getProviderCredentials("composio", null, null, { preferredConnectionId, restrictConnectionIds });
  if (!credentials?.apiKey) {
    return Response.json({ error: "No Composio API key configured" }, { status: 502 });
  }

  const { path } = await params;
  const upstream = `${COMPOSIO_BASE}/${(path || []).join("/")}${new URL(request.url).search}`;

  const init = {
    method: request.method,
    headers: {
      "x-api-key": credentials.apiKey, // Composio v3 auth header (not Bearer)
      "Content-Type": request.headers.get("content-type") || "application/json"
    }
  };
  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = await request.arrayBuffer();
  }

  const res = await fetch(upstream, init);
  return new Response(res.body, {
    status: res.status,
    headers: {
      "Content-Type": res.headers.get("content-type") || "application/json",
      "Access-Control-Allow-Origin": "*"
    }
  });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
