// Composio: not an LLM/media provider — a tool/integration gateway proxied at
// /v1/tools/composio/*. Registered as an apikey provider only to reuse 9router's
// multi-key storage + UI (Media Providers > Tools). serviceKinds ["tools"] keeps
// it out of the LLM tab and chat/combo pickers.
export default {
  id: "composio",
  alias: "composio",
  display: {
    name: "Composio",
    icon: "extension",
    color: "#6366F1",
    textIcon: "CO",
    website: "https://composio.dev",
    notice: {
      apiKeyUrl: "https://app.composio.dev/developers"
    }
  },
  category: "apikey",
  authType: "apikey",
  serviceKinds: ["tools"]
};
