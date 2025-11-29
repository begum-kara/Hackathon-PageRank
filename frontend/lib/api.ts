export interface PageRankNode {
  node: number;
  score: number;
}

export interface PageRankResponse {
  top: PageRankNode[];
}

const API_BASE = "https://burt-infracostal-kristy.ngrok-free.dev";
//const API_BASE = "http://localhost:8000";


export async function uploadGraph(file: File, topK: number): Promise<PageRankResponse> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("top_k", String(topK));

  //const res = await fetch("http://localhost:8000/api/pagerank/file", {
    const res = await fetch(`${API_BASE}/api/pagerank/file`, {

    method: "POST",
    body: formData,
    cache: "no-store",
    headers: {
      "ngrok-skip-browser-warning": "true",   
    },
  });

  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }

  return res.json();
}


export interface SearchResult {
  url: string;
  snippet: string;
  tfidf_score: number;
  pagerank_score: number;
  combined_score: number;
}

export interface SearchResponse {
  query: string;
  count: number;
  results: SearchResult[];
}

export async function searchTum(query: string, topK = 10): Promise<SearchResponse> {
  const url = `${API_BASE}/api/search?` +
    new URLSearchParams({
      query,
      top_k: String(topK),
    }).toString();

  const res = await fetch(url, {
    method: "GET",
    cache: "no-store",
    headers: {
      "ngrok-skip-browser-warning": "true",   
    },
  });

  if (!res.ok) {
    throw new Error(`Search API error: ${res.status}`);
  }

  return res.json();
}


//  URL PageRank demo 

export interface UrlPage {
  node_id: number;
  url: string;
  rank: number;
  score: number;
}

export interface UrlNode {
  id: number;
  url: string;
}

export interface UrlPagerankResponse {
  start_url: string;
  page_count: number;
  edge_count: number;
  pages: UrlPage[];
  nodes: UrlNode[];
  edges: { from: number; to: number }[];
}

export async function pagerankFromUrl(
  url: string,
  maxPages = 30,
  topK = 20
): Promise<UrlPagerankResponse> {
  const res = await fetch(`${API_BASE}/api/pagerank/url`, {
    method: "POST",
    headers: { "Content-Type": "application/json","ngrok-skip-browser-warning": "true" },
    body: JSON.stringify({
      url,
      max_pages: maxPages,
      top_k: topK,
    }),
    cache: "no-store",
    
  });

  if (!res.ok) {
    let message = `URL PageRank API error: ${res.status}`;
    try {
      const data = await res.json();
      if (data?.detail) {
        message = `URL PageRank API error ${res.status}: ${data.detail}`;
      }
    } catch {
      // ignore parse errors, keep default message
    }

    throw new Error(message);
  }

  return res.json();
}
