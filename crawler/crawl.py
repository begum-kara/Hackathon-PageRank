import os
import csv
import argparse
import json
from pathlib import Path

from core import crawl_graph  # 👈 new import from core.py


def main():
    parser = argparse.ArgumentParser(
        description="Simple web crawler that outputs an edge list for PageRank."
    )
    parser.add_argument("start_url", help="Start URL for crawling")
    parser.add_argument(
        "--max-pages",
        type=int,
        default=100,
        help="Maximum number of pages to visit",
    )
    parser.add_argument(
        "--output",
        type=str,
        default="edges.csv",
        help="Output CSV file",
    )

    args = parser.parse_args()

    repo_root = Path(__file__).resolve().parent
    data_dir = repo_root / "data"
    data_dir.mkdir(parents=True, exist_ok=True)
    output_path = data_dir / args.output

    # ---- call shared core logic ----
    pages, edges_url, url_to_id, visited = crawl_graph(
        args.start_url,
        max_pages=args.max_pages,
    )

    # ---- write edges.csv (same format as before) ----
    with output_path.open("w", newline="", encoding="utf8") as f:
        writer = csv.writer(f)
        writer.writerow(["source", "target_id"])
        for src_url, tgt_url in edges_url:
            target_id = url_to_id[tgt_url]
            writer.writerow([src_url, target_id])

    # ---- write pages.json next to CSV (same as before) ----
    pages_path = data_dir / "pages.json"
    with pages_path.open("w", encoding="utf8") as jf:
        json.dump(pages, jf, ensure_ascii=False, indent=2)

    print("\nDone.")
    print(f"Pages visited: {len(visited)}")
    print(f"Unique pages: {len(url_to_id)}")
    print(f"Edges collected: {len(edges_url)}")
    print(f"Saved edges to {output_path}")
    print(f"Saved pages to {pages_path}")


if __name__ == "__main__":
    main()
