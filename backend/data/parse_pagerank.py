import sys
import json
import re

# Matches lines like: "  node 157 : 0.0013602537"
PATTERN = re.compile(r"node\s+(\d+)\s*:\s*([0-9.eE+-]+)")


def main():
    if len(sys.argv) != 4:
        print(
            "Usage: python parse_pagerank.py <pagerank_output_txt> <pages_json> <output_json>",
            file=sys.stderr,
        )
        sys.exit(1)

    output_txt_path = sys.argv[1]
    pages_json_path = sys.argv[2]

    output_json_path = sys.argv[3]

    # 1) Load URL -> ID mapping and invert it to ID -> URL
    with open(pages_json_path, "r", encoding="utf-8") as f:
        pages = json.load(f)
    id_to_url = {int(p["id"]): p["url"] for p in pages}


    # 2) Parse pagerank output file
    raw_entries = []
    with open(output_txt_path, "r", encoding="utf-8") as f:
        for line in f:
            m = PATTERN.search(line)
            if not m:
                continue
            node_id = int(m.group(1))
            score = float(m.group(2))
            raw_entries.append((node_id, score))

    if not raw_entries:
        print("No PageRank entries found in output file.")
        sys.exit(1)

    # 3) Keep only nodes we have a URL for (i.e., present in pages/url_to_id)
    kept = []
    dropped = 0
    for node_id, score in raw_entries:
        url = id_to_url.get(node_id)
        if url is None:
            dropped += 1
            continue
        kept.append({"id": node_id, "url": url, "score": score})

    if not kept:
        print("All PageRank nodes were dropped (no URLs found). Check your mappings.")
        sys.exit(1)

    # 4) Renormalize scores over the kept nodes so they sum to ~1
    total_score = sum(item["score"] for item in kept)
    if total_score > 0.0:
        for item in kept:
            item["score"] /= total_score

    # Sort by score descending
    kept.sort(key=lambda x: x["score"], reverse=True)

    # 5) Write JSON
    with open(output_json_path, "w", encoding="utf-8") as f:
        json.dump(kept, f, ensure_ascii=False, indent=2)

    print(f"Parsed {len(raw_entries)} raw entries from {output_txt_path}")
    print(f"Kept   {len(kept)} nodes with URLs")
    print(f"Dropped {dropped} nodes without URLs")
    print(f"Renormalized total score over kept nodes to 1.0")


if __name__ == "__main__":
    main()
