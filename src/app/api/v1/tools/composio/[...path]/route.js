import { getProviderCredentials } from "@/sse/services/auth.js";

// Transparent reverse-proxy for the Composio REST API.
// Client hits /v1/tools/composio/<path> -> forwarded to backend.composio.dev/api/v3.1/<path>
// with a stored Composio key injected. One base URL, one place to hold the secrets.
//
// Multi-account: keys live in providerConnections (provider "composio"), managed in
// dashboard > Media Providers > Tools. Account selection reuses getProviderCredentials:
//   - default: fill-first (highest-priority connection)
//   - pin one: client sends header x-connection-id: <connectionId>
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
  const preferredConnectionId = request.headers.get("x-connection-id") || null;
  const credentials = await getProviderCredentials("composio", null, null, { preferredConnectionId });
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
