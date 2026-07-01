export const viewerApi = {
  overview(wiki) {
    return getJson(withQuery("/api/overview", { wiki }));
  },

  page(slug, wiki) {
    return getJson(withQuery(`/api/page/${encodeURIComponent(slug)}`, { wiki }));
  },

  search(query, wiki) {
    return getJson(withQuery("/api/search", { q: query, wiki }));
  },

  topic(slug, wiki) {
    return getJson(withQuery(`/api/topic/${encodeURIComponent(slug)}`, { wiki }));
  },

  file(path, wiki) {
    return getJson(withQuery("/api/file", { path, wiki }));
  },

  jobs(wiki) {
    return getJson(withQuery("/api/jobs", { wiki }));
  },

  job(runId, wiki) {
    return getJson(withQuery(`/api/jobs/${encodeURIComponent(runId)}`, { wiki }));
  },
};

function withQuery(path, params) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      query.set(key, value);
    }
  }
  const suffix = query.toString();
  return suffix ? `${path}?${suffix}` : path;
}

async function getJson(url) {
  const response = await fetch(url);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.detail?.message || `Request failed: ${response.status}`);
  }
  return data;
}
