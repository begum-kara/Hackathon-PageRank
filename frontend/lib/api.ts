export interface PageRankNode {
  node: number;
  score: number;
}

export interface PageRankResponse {
  top: PageRankNode[];
}

export async function uploadGraph(file: File, topK: number): Promise<PageRankResponse> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("top_k", String(topK));

  const res = await fetch("http://localhost:8000/api/pagerank/file", {
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
