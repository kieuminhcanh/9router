export default {
  id: "pexels",
  alias: "pexels",
  display: {
    name: "Pexels",
    icon: "image_search",
    color: "#05A081",
    textIcon: "PX",
    website: "https://www.pexels.com/api/",
    notice: {
      apiKeyUrl: "https://www.pexels.com/api/new/"
    }
  },
  category: "apikey",
  authType: "apikey",
  serviceKinds: [
    "webSearch"
  ],
  searchConfig: {
    baseUrl: "https://api.pexels.com",
    method: "GET",
    authType: "apikey",
    authHeader: "authorization-raw",
    costPerQuery: 0,
    freeMonthlyQuota: 20000,
    searchTypes: [
      "image",
      "video"
    ],
    defaultMaxResults: 10,
    maxMaxResults: 80,
    timeoutMs: 10000,
    cacheTTLMs: 300000
  }
};
