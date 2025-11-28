export interface PageRankNode {
  node: number;
  score: number;
}

export interface PageRankResponse {
  top: PageRankNode[];
}

//const API_BASE = "http://172.17.255.190:8000";
const API_BASE = "http://localhost:8000";


export async function uploadGraph(file: File, topK: number): Promise<PageRankResponse> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("top_k", String(topK));

  //const res = await fetch("http://localhost:8000/api/pagerank/file", {
    const res = await fetch(`${API_BASE}/api/pagerank/file`, {

    method: "POST",
    body: formData,
    // 👇 VERY IMPORTANT: must be client-side
    cache: "no-store",
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
  });

  if (!res.ok) {
    throw new Error(`Search API error: ${res.status}`);
  }

  return res.json();
}
