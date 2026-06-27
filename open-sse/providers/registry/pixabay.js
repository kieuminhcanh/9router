export default {
  id: "pixabay",
  alias: "pixabay",
  display: {
    name: "Pixabay",
    icon: "image_search",
    color: "#2EC66D",
    textIcon: "PB",
    website: "https://pixabay.com/api/docs/",
    notice: {
      apiKeyUrl: "https://pixabay.com/api/docs/"
    }
  },
  category: "apikey",
  authType: "apikey",
  serviceKinds: [
    "webSearch"
  ],
  searchConfig: {
    baseUrl: "https://pixabay.com/api",
    method: "GET",
    authType: "apikey",
    authHeader: "query-key",
    costPerQuery: 0,
    searchTypes: [
      "image",
      "video"
    ],
    defaultMaxResults: 10,
    maxMaxResults: 200,
    timeoutMs: 10000,
    cacheTTLMs: 300000
  }
};
