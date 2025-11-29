from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

import tempfile
import subprocess
import os
import re
import json
from pathlib import Path
from urllib.parse import urlparse, urlunparse
from config import CLUSTER_USER, CLUSTER_HOST, REMOTE_WORKDIR, REMOTE_BIN
from typing import Any
from tfidf_index import create_tfidf_index
from pydantic import BaseModel
import sys

API_DIR = Path(__file__).resolve().parent

ROOT_DIR = API_DIR.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.append(str(ROOT_DIR))

from crawler.core import crawl_graph

app = FastAPI(title="PageRank Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # or ["http://localhost:5173"] for stricter
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ROOT_DIR = API_DIR.parent
CRAWLER_PAGES_PATH = ROOT_DIR / "crawler" / "data" / "pages.json"
PAGERANK_PATH = ROOT_DIR / "backend" / "data" / "pagerank.json"

# Regex for cluster output 
TOP_LINE_RE = re.compile(r"^\s*node\s+(\d+)\s*:\s*([0-9\.Ee+-]+)\s*$")

# Global search state 
tfidf_index: Any | None = None
pages_by_url = {}           # url -> full page dict from crawler
pagerank_by_url = {}        # url -> raw pagerank score
pagerank_norm_by_url = {}   # url -> normalized pagerank score in [0, 1]


# Offline data loading & index building (runs at startup)


def _load_data_and_build_index():
    global tfidf_index, pages_by_url, pagerank_by_url, pagerank_norm_by_url

    #  Load crawler pages (text) 
    if not CRAWLER_PAGES_PATH.exists():
        raise RuntimeError(f"pages.json not found at {CRAWLER_PAGES_PATH}")

    with CRAWLER_PAGES_PATH.open("r", encoding="utf-8") as f:
        pages = json.load(f)

    # pages is like: [{ "id": ..., "url": "...", "text": "..." }, ...]
    pages_by_url = {}
    index = create_tfidf_index()
    print(f"[search] Using TF-IDF index implementation: {type(index).__name__}")
    
    for p in pages:
        raw_url = p["url"]
        url = normalize_url_backend(raw_url)
        text = p.get("text", "") or ""

        existing = pages_by_url.get(url)
        if existing:
            # simple heuristic: keep the one with longer text
            if len(text) <= len(existing.get("text", "") or ""):
                continue

        page_record = {
            **p,
            "url": url,   # store normalized URL in memory
            "text": text,
        }
        pages_by_url[url] = page_record

    # 2) build TF-IDF index on normalized, deduped URLs
    for url, page in pages_by_url.items():
        index.add_document(url, page.get("text", "") or "")

    index.finalize()
    tfidf_index = index


    #  Load PageRank (CUDA output) 
    pagerank_by_url = {}
    pagerank_norm_by_url = {}

    if not PAGERANK_PATH.exists():
        print(f"[search] Warning: pagerank.json not found at {PAGERANK_PATH}. PageRank scores will be zero.")
        return

    with PAGERANK_PATH.open("r", encoding="utf-8") as f:
        pr_data = json.load(f)

    # 3) normalize URLs and dedupe PageRank (keep max score if duplicates)
    for entry in pr_data:
        raw_url = entry["url"]
        url = normalize_url_backend(raw_url)
        score = float(entry.get("score", 0.0))

        existing_score = pagerank_by_url.get(url)
        if existing_score is not None and score <= existing_score:
            continue

        pagerank_by_url[url] = score

    #  Normalize PageRank to [0, 1] for combining 
    if pagerank_by_url:
        values = list(pagerank_by_url.values())
        pr_min = min(values)
        pr_max = max(values)
        span = pr_max - pr_min if pr_max > pr_min else 1.0

        pagerank_norm_by_url = {
            url: (score - pr_min) / span
            for url, score in pagerank_by_url.items()
        }

    print(f"[search] Loaded {len(pages_by_url)} pages, {len(pagerank_by_url)} PageRank scores.")

#removing duplicate urls 
def normalize_url_backend(url: str) -> str:
    """
    Normalize URLs so minor variants map to the same key:
    - lowercase host
    - remove fragment (#...)
    - normalize trailing slash (treat '/foo' and '/foo/' as same, except root '/')
    """
    parsed = urlparse(url)

    # lowercase host
    netloc = parsed.netloc.lower()

    # drop fragment
    parsed = parsed._replace(fragment="")

    # normalize path
    path = parsed.path or "/"
    if path != "/" and path.endswith("/"):
        path = path.rstrip("/")

    parsed = parsed._replace(netloc=netloc, path=path)
    return urlunparse(parsed)


@app.on_event("startup")
async def startup_event():
    # Build TF-IDF index and load PageRank when FastAPI starts
    try:
        _load_data_and_build_index()
    except Exception as e:
        # If this fails you'll see it in the server logs
        print(f"[startup] ERROR while building search index: {e}")


# Helper: call CUDA PageRank on cluster

def run_pagerank_on_cluster(local_input_path: str, top_k: int = 10):
    # 1) Upload file to cluster
    remote_input = f"{REMOTE_WORKDIR}/input.txt"
    subprocess.run(
        ["scp", local_input_path, f"{CLUSTER_USER}@{CLUSTER_HOST}:{remote_input}"],
        check=True,
    )

    # 2) Run pagerank_gpu on the cluster
    remote_output = f"{REMOTE_WORKDIR}/output.txt"
    cmd = (
        f"cd {REMOTE_WORKDIR} && "
        f"{REMOTE_BIN} input.txt output.txt 0.85 1e-8 100 {top_k}"
    )
    result = subprocess.run(
        ["ssh", f"{CLUSTER_USER}@{CLUSTER_HOST}", cmd],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        raise RuntimeError(result.stderr)

    # 3) Download results back to laptop
    with tempfile.NamedTemporaryFile(delete=False) as tmp_out:
        local_output = tmp_out.name

    subprocess.run(
        ["scp", f"{CLUSTER_USER}@{CLUSTER_HOST}:{remote_output}", local_output],
        check=True,
    )

    # 4) Parse "Top K PageRank" section
    ranks = []
    with open(local_output, "r") as f:
        in_top = False
        for line in f:
            line = line.rstrip("\n")
            if line.startswith("Top") and "nodes by PageRank" in line:
                in_top = True
                continue
            if in_top:
                m = TOP_LINE_RE.match(line.strip())
                if m:
                    ranks.append(
                        {
                            "node": int(m.group(1)),
                            "score": float(m.group(2)),
                        }
                    )

    os.remove(local_output)
    return ranks

#URL search
class UrlPageRankRequest(BaseModel):
    url: str
    max_pages: int = 30   
    top_k: int = 20      
    lang: str | None = None      # e.g. "en" or "de"
    workers: int = 5    
    
@app.post("/api/pagerank/url")
async def pagerank_from_url(payload: UrlPageRankRequest):
    start_url = payload.url.strip()
    if not start_url:
        raise HTTPException(status_code=400, detail="URL is required")

    parsed = urlparse(start_url)
    if not parsed.scheme.startswith("http"):
        raise HTTPException(status_code=400, detail="URL must start with http:// or https://")

    # 1) Crawl a small graph using the shared crawler core
    try:
        pages, edges_url, url_to_id, visited = crawl_graph(
            start_url,
            max_pages=payload.max_pages,
            target_lang=payload.lang,      
            workers=payload.workers,       
            verbose=False,                 
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Crawl failed: {e}")

    if not edges_url:
        raise HTTPException(status_code=400, detail="No crawlable links found from this URL.")

    # 2) Convert URL-edges -> ID-edges for CUDA
    edges_id = [
        (url_to_id[src], url_to_id[tgt])
        for (src, tgt) in edges_url
        if src in url_to_id and tgt in url_to_id
    ]

    if not edges_id:
        raise HTTPException(status_code=400, detail="Crawled pages but found no internal links to rank.")

    id_to_url = {node_id: url for url, node_id in url_to_id.items()}

    # 3) Write edges to a temporary file in "src dst" format
    with tempfile.NamedTemporaryFile(delete=False, mode="w") as tmp:
        for src_id, dst_id in edges_id:
            tmp.write(f"{src_id} {dst_id}\n")
        local_edges_path = tmp.name

    # 4) Run PageRank on the cluster using existing helper
    try:
        raw_ranks = run_pagerank_on_cluster(local_edges_path, top_k=payload.top_k)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Cluster PageRank failed: {e}")
    finally:
        os.remove(local_edges_path)

    # 5) Map node IDs back to URLs and shape response
    pages_out = []
    for i, entry in enumerate(raw_ranks):
        node_id = entry["node"]
        url = id_to_url.get(node_id, f"node-{node_id}")
        pages_out.append(
            {
                "node_id": node_id,
                "url": url,
                "rank": i + 1,
                "score": entry["score"],
            }
        )

    edges_out = [{"from": src, "to": dst} for (src, dst) in edges_id]

    # Also return a simple edge list with IDs, so frontend can visualize a graph if it wants
    nodes_out = [
        {"id": node_id, "url": url}
        for node_id, url in id_to_url.items()
    ]

    return {
        "start_url": start_url,
        "page_count": len(url_to_id),
        "edge_count": len(edges_id),
        "pages": pages_out,
        "nodes": nodes_out,
        "edges": edges_out,
    }


# Existing endpoint: run PageRank on uploaded graph

@app.post("/api/pagerank/file")
async def pagerank_file(file: UploadFile = File(...), top_k: int = Form(10)):
    # Save file locally on laptop
    with tempfile.NamedTemporaryFile(delete=False) as tmp:
        tmp.write(await file.read())
        local_path = tmp.name

    try:
        result = run_pagerank_on_cluster(local_path, top_k)
    except Exception as e:
        return {"error": str(e)}
    finally:
        os.remove(local_path)

    return {"top": result}


# Helper: snippet generator for search results

def _make_snippet(text: str, query: str, max_len: int = 220) -> str:
    """
    Very simple snippet: find first occurrence of any query term
    and return a window around it.
    """
    if not text:
        return ""

    lowered = text.lower()
    terms = [t for t in query.lower().split() if t]

    pos = None
    for term in terms:
        idx = lowered.find(term)
        if idx != -1:
            pos = idx if pos is None else min(pos, idx)

    # no term found → just return the beginning
    if pos is None:
        return (text[:max_len] + "…") if len(text) > max_len else text

    start = max(0, pos - max_len // 3)
    end = min(len(text), start + max_len)
    snippet = text[start:end].strip()

    if start > 0:
        snippet = "… " + snippet
    if end < len(text):
        snippet = snippet + " …"

    return snippet


# New endpoint: search over TUM pages (TF-IDF + PageRank)

@app.get("/api/search")
async def search_tum(
    q: str = Query(..., alias="query", min_length=1, description="Search query string"),
    top_k: int = Query(10, ge=1, le=50),
):
    """
    Search TUM pages using TF-IDF + PageRank.
    Returns:
      - url
      - snippet
      - tfidf_score
      - pagerank_score
      - combined_score
    """
    if tfidf_index is None:
        raise HTTPException(status_code=500, detail="Search index not initialized")

    # Get more candidates from pure TF-IDF, then re-rank with PageRank
    base_results = tfidf_index.search(q, top_k=top_k * 3)

    alpha = 0.8  # TF-IDF weight
    beta = 0.2   # PageRank weight

    combined = []
    for url, tf_score in base_results:  # url is the doc_id
        page = pages_by_url.get(url)
        if not page:
            continue

        pr_raw = pagerank_by_url.get(url, 0.0)
        pr_norm = pagerank_norm_by_url.get(url, 0.0)
        final_score = alpha * tf_score + beta * pr_norm

        snippet = _make_snippet(page.get("text", "") or "", q)

        combined.append(
            {
                "url": url,
                "snippet": snippet,
                "tfidf_score": tf_score,
                "pagerank_score": pr_raw,
                "combined_score": final_score,
            }
        )

    combined.sort(key=lambda r: r["combined_score"], reverse=True)
    combined = combined[:top_k]

    return {
        "query": q,
        "count": len(combined),
        "results": combined,
    }


# Health check

@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/debug/search-status")
def debug_search_status():
    return {
        "has_index": tfidf_index is not None,
        "num_pages": len(pages_by_url),
        "num_pagerank": len(pagerank_by_url),
    }