# crawl.py
import csv
import json
import argparse
from pathlib import Path

from core import crawl_graph


def main():
    parser = argparse.ArgumentParser(
        description="Concurrent web crawler that outputs an edge list for PageRank."
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
        help="Output CSV file name (inside ./data)",
    )
    parser.add_argument(
        "--lang",
        type=str,
        default=None,
        help="Optional language code (e.g. 'en' or 'de') to restrict pages.",
    )
    parser.add_argument(
        "--workers",
        type=int,
        default=5,
        help="Number of concurrent workers (threads) for crawling.",
    )

    args = parser.parse_args()

    repo_root = Path(__file__).resolve().parent
    data_dir = repo_root / "data"
    data_dir.mkdir(parents=True, exist_ok=True)
    output_path = data_dir / args.output

    # ---- call core logic with concurrency + language filter ----
    pages, edges_url, url_to_id, visited = crawl_graph(
        args.start_url,
        max_pages=args.max_pages,
        target_lang=args.lang,
        workers=args.workers,
    )

    # Paths
    edges_csv_path = output_path  # keep your current CSV
    edges_txt_path = output_path.with_suffix(".txt")  # new CUDA-ready file

    # ---- write edges.csv (source URL string + target_id) ----
    with edges_csv_path.open("w", newline="", encoding="utf8") as f_csv, \
        edges_txt_path.open("w", encoding="utf8") as f_txt:
        
        writer = csv.writer(f_csv)
        writer.writerow(["source", "target_id"])

        for src_url, tgt_url in edges_url:
            src_id = url_to_id[src_url]
            tgt_id = url_to_id[tgt_url]

            # CSV version (for debugging)
            writer.writerow([src_url, tgt_id])

            # TXT version (for CUDA)
            # Format: "src_id target_id"
            f_txt.write(f"{src_id} {tgt_id}\n")


    # ---- write pages.json next to CSV ----
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
