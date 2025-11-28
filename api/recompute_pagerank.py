import subprocess
import sys
from pathlib import Path

from config import CLUSTER_USER, CLUSTER_HOST, REMOTE_WORKDIR, REMOTE_BIN

API_DIR = Path(__file__).resolve().parent
ROOT_DIR = API_DIR.parent

BACKEND_DATA_DIR = ROOT_DIR / "backend" / "data"
CRAWLER_DATA_DIR = ROOT_DIR / "crawler" / "data"

# Scripts
PREPARE_GRAPH_PY = BACKEND_DATA_DIR / "prepare_graph.py"
PARSE_PAGERANK_PY = BACKEND_DATA_DIR / "parse_pagerank.py"
CHECK_SUM_PY = BACKEND_DATA_DIR / "check_pagerank_sum.py"  # adjust if elsewhere

# Crawler outputs (👈 NOTE: edges.csv now)
CRAWLER_EDGES_CSV = CRAWLER_DATA_DIR / "edges.csv"
CRAWLER_PAGES_JSON = CRAWLER_DATA_DIR / "pages.json"

# Backend data files
EDGES_TXT_LOCAL = BACKEND_DATA_DIR / "edges.txt"
URL_TO_ID_JSON = BACKEND_DATA_DIR / "url_to_id.json"
OUTPUT_TXT_LOCAL = BACKEND_DATA_DIR / "output.txt"
PAGERANK_JSON = BACKEND_DATA_DIR / "pagerank.json"


def run_cmd(cmd, cwd=None):
    print(f"\n[run] {' '.join(str(c) for c in cmd)} (cwd={cwd or '.'})")
    subprocess.run(cmd, check=True, cwd=cwd)


# ----------------- Step 1: prepare_graph.py -----------------
def step_prepare_graph():
    """
    Equivalent of:

    python3 backend/data/prepare_graph.py \
        crawler/data/edges.csv \
        crawler/data/pages.json \
        backend/data/edges.txt \
        backend/data/url_to_id.json
    """
    if not PREPARE_GRAPH_PY.exists():
        raise SystemExit(f"prepare_graph.py not found at {PREPARE_GRAPH_PY}")

    if not CRAWLER_EDGES_CSV.exists():
        raise SystemExit(f"edges.csv not found at {CRAWLER_EDGES_CSV}")
    if not CRAWLER_PAGES_JSON.exists():
        raise SystemExit(f"pages.json not found at {CRAWLER_PAGES_JSON}")

    run_cmd([
        sys.executable,
        str(PREPARE_GRAPH_PY),
        str(CRAWLER_EDGES_CSV),
        str(CRAWLER_PAGES_JSON),
        str(EDGES_TXT_LOCAL),
        str(URL_TO_ID_JSON),
    ])


# ----------------- Step 2: CUDA on cluster -----------------
def step_run_pagerank_on_cluster(
    damping: float = 0.85,
    tol: float = 1e-8,
    max_iter: int = 100,
    top_k: int = 100000,
):
    """
    Equivalent of (but executed remotely on the cluster):

      ./cuda/pagerank_gpu data/edges.txt data/output.txt 0.85 1e-8 100 100000

    Here we:
      - scp backend/data/edges.txt -> $REMOTE_WORKDIR/edges.txt
      - ssh into cluster: $REMOTE_BIN edges.txt output.txt ...
      - scp $REMOTE_WORKDIR/output.txt -> backend/data/output.txt
    """
    if not EDGES_TXT_LOCAL.exists():
        raise SystemExit(f"edges.txt not found at {EDGES_TXT_LOCAL}. Did you run prepare_graph.py?")

    remote_edges = f"{REMOTE_WORKDIR}/edges.txt"
    remote_output = f"{REMOTE_WORKDIR}/output.txt"

    # 1) upload edges.txt
    run_cmd([
        "scp",
        str(EDGES_TXT_LOCAL),
        f"{CLUSTER_USER}@{CLUSTER_HOST}:{remote_edges}",
    ])

    # 2) run CUDA binary on cluster
    #    (REMOTE_BIN should already be set to something like 'cuda/pagerank_gpu'
    #     relative to REMOTE_WORKDIR, or an absolute path)
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
    run_cmd([
        "scp",
        f"{CLUSTER_USER}@{CLUSTER_HOST}:{remote_output}",
        str(OUTPUT_TXT_LOCAL),
    ])


# ----------------- Step 3: parse_pagerank.py -----------------
def step_parse_pagerank():
    """
    Equivalent of:

      python3 data/parse_pagerank.py data/output.txt data/url_to_id.json data/pagerank.json

    but using backend/data paths:

      python3 backend/data/parse_pagerank.py \
          backend/data/output.txt \
          backend/data/url_to_id.json \
          backend/data/pagerank.json
    """
    if not PARSE_PAGERANK_PY.exists():
        raise SystemExit(f"parse_pagerank.py not found at {PARSE_PAGERANK_PY}")
    if not OUTPUT_TXT_LOCAL.exists():
        raise SystemExit(f"output.txt not found at {OUTPUT_TXT_LOCAL}. Did the cluster run succeed?")
    if not URL_TO_ID_JSON.exists():
        raise SystemExit(f"url_to_id.json not found at {URL_TO_ID_JSON}. Did you run prepare_graph.py?")

    run_cmd([
        sys.executable,
        str(PARSE_PAGERANK_PY),
        str(OUTPUT_TXT_LOCAL),
        str(URL_TO_ID_JSON),
        str(PAGERANK_JSON),
    ])

    print(f"\n[ok] Wrote {PAGERANK_JSON}")


# ----------------- Step 4: check_pagerank_sum.py (optional) -----------------
def step_check_sum():
    """
    Optional: run check_pagerank_sum.py if present in backend/data.
    """
    if not CHECK_SUM_PY.exists():
        print(f"[warn] check_pagerank_sum.py not found at {CHECK_SUM_PY}, skipping sum check.")
        return

    run_cmd([sys.executable, str(CHECK_SUM_PY)], cwd=BACKEND_DATA_DIR)



def main():
    print("=== Recompute TUM PageRank pipeline ===")
    print(f"ROOT_DIR:         {ROOT_DIR}")
    print(f"BACKEND_DATA_DIR: {BACKEND_DATA_DIR}")
    print(f"CRAWLER_DATA_DIR: {CRAWLER_DATA_DIR}")

    print("\n[info] Step 0 (crawler) is manual if you want fresh edges/pages:")
    print(f"       cd {ROOT_DIR / 'crawler'}")
    print("       python crawl.py https://www.tum.de --max-pages 500")
    print("")

    print("\n=== Step 1: prepare_graph.py ===")
    step_prepare_graph()

    print("\n=== Step 2: run PageRank on cluster ===")
    step_run_pagerank_on_cluster()

    print("\n=== Step 3: parse_pagerank.py ===")
    step_parse_pagerank()

    print("\n=== Step 4 (optional): check_pagerank_sum.py ===")
    step_check_sum()

    print("\nAll done. Restart FastAPI to pick up the new backend/data/pagerank.json.")


if __name__ == "__main__":
    main()
