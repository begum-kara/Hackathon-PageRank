#!/usr/bin/env python
import argparse
import subprocess
import sys
from pathlib import Path
import json

from config import CLUSTER_USER, CLUSTER_HOST, REMOTE_WORKDIR, REMOTE_BIN

#  Paths & imports 

API_DIR = Path(__file__).resolve().parent
ROOT_DIR = API_DIR.parent

# Make project root importable so we can import crawler.core
if str(ROOT_DIR) not in sys.path:
    sys.path.append(str(ROOT_DIR))

from crawler.core import crawl_graph  # noqa: E402

BACKEND_DATA_DIR = ROOT_DIR / "backend" / "data"
CRAWLER_DATA_DIR = ROOT_DIR / "crawler" / "data"

# Scripts
PARSE_PAGERANK_PY = BACKEND_DATA_DIR / "parse_pagerank.py"
CHECK_SUM_PY = BACKEND_DATA_DIR / "check_pagerank_sum.py"  # optional

# Crawler outputs
CRAWLER_EDGES_TXT = CRAWLER_DATA_DIR / "edges.txt"     # CUDA-ready: "src_id dst_id"
CRAWLER_PAGES_JSON = CRAWLER_DATA_DIR / "pages.json"   # [{id, url, text}, ...]

# Backend data files
OUTPUT_TXT_LOCAL = BACKEND_DATA_DIR / "output.txt"     # raw CUDA output
PAGERANK_JSON = BACKEND_DATA_DIR / "pagerank.json"     # final PR used by API


def run_cmd(cmd, cwd=None):
    print(f"\n[run] {' '.join(str(c) for c in cmd)} (cwd={cwd or '.'})")
    subprocess.run(cmd, check=True, cwd=cwd)


#  Step 0: crawl + write pages.json & edges.txt 

def step_crawl(start_url: str, max_pages: int, lang: str | None, workers: int):
    """
    Use the shared crawler.core.crawl_graph to:
      - crawl from start_url
      - restrict to max_pages, optional language, and workers
    Then write:
      - crawler/data/pages.json
      - crawler/data/edges.txt  (src_id dst_id for CUDA)
    """
    print("\n=== Step 0: crawling ===")
    print(f"[crawl] start_url  = {start_url}")
    print(f"[crawl] max_pages  = {max_pages}")
    print(f"[crawl] lang       = {lang}")
    print(f"[crawl] workers    = {workers}")

    CRAWLER_DATA_DIR.mkdir(parents=True, exist_ok=True)

    pages, edges_url, url_to_id, visited = crawl_graph(
        start_url=start_url,
        max_pages=max_pages,
        target_lang=lang,
        workers=workers,
        verbose=True,
    )

    print(f"[crawl] Visited URLs: {len(visited)}")
    print(f"[crawl] Unique pages (url_to_id): {len(url_to_id)}")
    print(f"[crawl] Raw edges (url,url): {len(edges_url)}")

    #  write pages.json 
    with CRAWLER_PAGES_JSON.open("w", encoding="utf-8") as jf:
        json.dump(pages, jf, ensure_ascii=False, indent=2)
    print(f"[crawl] Wrote pages.json -> {CRAWLER_PAGES_JSON}")

    #  write edges.txt (src_id dst_id) for CUDA 
    # edges_url is (src_url, tgt_url); map via url_to_id
    num_edges_written = 0
    with CRAWLER_EDGES_TXT.open("w", encoding="utf-8") as f_txt:
        seen = set()
        for src_url, tgt_url in edges_url:
            if src_url not in url_to_id or tgt_url not in url_to_id:
                continue
            src_id = url_to_id[src_url]
            tgt_id = url_to_id[tgt_url]
            edge = (src_id, tgt_id)
            if edge in seen:
                continue
            seen.add(edge)
            f_txt.write(f"{src_id} {tgt_id}\n")
            num_edges_written += 1

    print(f"[crawl] Wrote {num_edges_written} unique edges -> {CRAWLER_EDGES_TXT}")


#  Step 1: CUDA on cluster 

def step_run_pagerank_on_cluster(
    damping: float = 0.85,
    tol: float = 1e-8,
    max_iter: int = 100,
    top_k: int = 100000,
):
    """
    Run PageRank on the GPU cluster.

    Uses:
      - crawler/data/edges.txt  (already in 'src_id dst_id' format)
    Produces:
      - backend/data/output.txt (raw PageRank text output)
    """
    print("\n=== Step 1: run PageRank on cluster ===")

    if not CRAWLER_EDGES_TXT.exists():
        raise SystemExit(
            f"edges.txt not found at {CRAWLER_EDGES_TXT}. "
            f"Did the crawl step run?"
        )

    remote_edges = f"{REMOTE_WORKDIR}/edges.txt"
    remote_output = f"{REMOTE_WORKDIR}/output.txt"

    # 1) upload edges.txt from crawler to cluster
    run_cmd([
        "scp",
        str(CRAWLER_EDGES_TXT),
        f"{CLUSTER_USER}@{CLUSTER_HOST}:{remote_edges}",
    ])

    # 2) run CUDA binary on cluster
    cmd = (
        f"cd {REMOTE_WORKDIR} && "
        f"{REMOTE_BIN} edges.txt output.txt {damping} {tol} {max_iter} {top_k}"
    )
    print(f"\n[ssh] {cmd}")
    result = subprocess.run(
        ["ssh", f"{CLUSTER_USER}@{CLUSTER_HOST}", cmd],
        text=True,
        capture_output=True,
    )
    if result.returncode != 0:
        print(result.stdout)
        print(result.stderr)
        raise SystemExit(f"Remote PageRank run failed with code {result.returncode}")

    # 3) download output.txt back to backend/data/output.txt
    BACKEND_DATA_DIR.mkdir(parents=True, exist_ok=True)
    run_cmd([
        "scp",
        f"{CLUSTER_USER}@{CLUSTER_HOST}:{remote_output}",
        str(OUTPUT_TXT_LOCAL),
    ])
    print(f"[pagerank] Downloaded cluster output -> {OUTPUT_TXT_LOCAL}")


#  Step 2: parse_pagerank.py 

def step_parse_pagerank():
    """
    Run parse_pagerank.py to convert CUDA output.txt + pages.json
    into backend/data/pagerank.json.
    """
    print("\n=== Step 2: parse_pagerank.py ===")

    if not PARSE_PAGERANK_PY.exists():
        raise SystemExit(f"parse_pagerank.py not found at {PARSE_PAGERANK_PY}")
    if not OUTPUT_TXT_LOCAL.exists():
        raise SystemExit(
            f"output.txt not found at {OUTPUT_TXT_LOCAL}. "
            f"Did the cluster run succeed?"
        )
    if not CRAWLER_PAGES_JSON.exists():
        raise SystemExit(
            f"pages.json not found at {CRAWLER_PAGES_JSON}. "
            f"Did the crawl step run?"
        )

    run_cmd([
        sys.executable,
        str(PARSE_PAGERANK_PY),
        str(OUTPUT_TXT_LOCAL),
        str(CRAWLER_PAGES_JSON),
        str(PAGERANK_JSON),
    ])

    print(f"\n[ok] Wrote {PAGERANK_JSON}")

    # Treat output.txt as temporary → can be safely removed
    try:
        OUTPUT_TXT_LOCAL.unlink()
        print(f"[info] Removed temporary {OUTPUT_TXT_LOCAL}")
    except FileNotFoundError:
        pass


#  Step 3: check_pagerank_sum.py (optional) 

def step_check_sum():
    """
    Optional: run check_pagerank_sum.py if present in backend/data.
    """
    print("\n=== Step 3 (optional): check_pagerank_sum.py ===")

    if not CHECK_SUM_PY.exists():
        print(f"[warn] {CHECK_SUM_PY} not found, skipping sum check.")
        return

    run_cmd([sys.executable, str(CHECK_SUM_PY)], cwd=BACKEND_DATA_DIR)


#  Main CLI 

def parse_args():
    parser = argparse.ArgumentParser(
        description="End-to-end pipeline: crawl -> PageRank (cluster) -> pagerank.json"
    )
    parser.add_argument(
        "start_url",
        help="Start URL for crawling (e.g. https://www.tum.de or a Wikipedia article)",
    )
    parser.add_argument(
        "--max-pages",
        type=int,
        default=200,
        help="Maximum number of pages to visit during crawl (default: 200)",
    )
    parser.add_argument(
        "--lang",
        type=str,
        default=None,
        help="Optional language code to restrict pages (e.g. 'en' or 'de')",
    )
    parser.add_argument(
        "--workers",
        type=int,
        default=5,
        help="Number of concurrent workers for crawling (default: 5)",
    )
    parser.add_argument(
        "--damping",
        type=float,
        default=0.85,
        help="PageRank damping factor alpha (default: 0.85)",
    )
    parser.add_argument(
        "--tol",
        type=float,
        default=1e-8,
        help="PageRank convergence tolerance (default: 1e-8)",
    )
    parser.add_argument(
        "--max-iter",
        type=int,
        default=100,
        help="Maximum PageRank iterations (default: 100)",
    )
    parser.add_argument(
        "--top-k",
        type=int,
        default=100000,
        help="Top-k nodes to print in CUDA output (default: 100000)",
    )
    return parser.parse_args()


def main():
    args = parse_args()

    print("=== Build corpus pipeline (crawl + PageRank + parse) ===")
    print(f"ROOT_DIR:         {ROOT_DIR}")
    print(f"BACKEND_DATA_DIR: {BACKEND_DATA_DIR}")
    print(f"CRAWLER_DATA_DIR: {CRAWLER_DATA_DIR}")

    # Step 0: crawl
    step_crawl(
        start_url=args.start_url,
        max_pages=args.max_pages,
        lang=args.lang,
        workers=args.workers,
    )

    # Step 1: run PageRank on cluster
    step_run_pagerank_on_cluster(
        damping=args.damping,
        tol=args.tol,
        max_iter=args.max_iter,
        top_k=args.top_k,
    )

    # Step 2: parse PageRank output -> pagerank.json
    step_parse_pagerank()

    # Step 3: optional sanity-check of sum
    step_check_sum()

    print("\nAll done ")
    print("Restart FastAPI to pick up the new backend/data/pagerank.json and crawler/data/pages.json.")


if __name__ == "__main__":
    main()
