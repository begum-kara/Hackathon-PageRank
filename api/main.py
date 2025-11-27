from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware

import tempfile
import subprocess
import os
import re

from config import CLUSTER_USER, CLUSTER_HOST, REMOTE_WORKDIR, REMOTE_BIN

app = FastAPI(title="PageRank Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # or ["http://localhost:5173"] for stricter
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

TOP_LINE_RE = re.compile(r"^\s*node\s+(\d+)\s*:\s*([0-9\.Ee+-]+)\s*$")


def run_pagerank_on_cluster(local_input_path: str, top_k: int = 10):
    # 1) Upload file to cluster
    remote_input = f"{REMOTE_WORKDIR}/input.txt"
    subprocess.run(
        ["scp", local_input_path, f"{CLUSTER_USER}@{CLUSTER_HOST}:{remote_input}"],
        check=True,
    )

    # 2) Run pagerank_gpu on the cluster
    remote_output = f"{REMOTE_WORKDIR}/output.txt"
    cmd = f"cd {REMOTE_WORKDIR} && {REMOTE_BIN} input.txt output.txt 0.85 1e-8 100 {top_k}"
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
                    ranks.append({
                        "node": int(m.group(1)),
                        "score": float(m.group(2))
                    })

    os.remove(local_output)
    return ranks


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


@app.get("/health")
def health():
    return {"status": "ok"}
