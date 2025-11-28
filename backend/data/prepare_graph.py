import sys
import csv
import json

def main():
    if len(sys.argv) != 5:
        print(
            "Usage: python prepare_graph.py <edges_csv> <pages_json> <edges_txt_out> <url_to_id_out_json>",
            file=sys.stderr,
        )
        sys.exit(1)

    edges_csv_path = sys.argv[1]      # from crawler (source URL, target_id)
    pages_json_path = sys.argv[2]     # from crawler (id, url, text)
    edges_txt_out = sys.argv[3]       # for CUDA (source_id target_id)
    url_to_id_out = sys.argv[4]       # mapping url -> id for later use

    # 1) Build url -> id mapping from pages.json
    with open(pages_json_path, "r", encoding="utf-8") as f:
        pages = json.load(f)

    url_to_id = {}
    for page in pages:
        url = page["url"]
        pid = int(page["id"])
        url_to_id[url] = pid

    # 2) Convert edges.csv (source URL, target_id) -> edges.txt (source_id target_id)
    total_rows = 0
    written_edges = 0
    skipped_missing_src = 0
    skipped_self = 0
    seen_edges = set()

    with open(edges_csv_path, "r", encoding="utf-8") as f_in, \
         open(edges_txt_out, "w", encoding="utf-8") as f_out:

        reader = csv.DictReader(f_in)

        if "source" not in reader.fieldnames or "target_id" not in reader.fieldnames:
            print(
                f"ERROR: edges CSV must have 'source' and 'target_id' columns. "
                f"Found: {reader.fieldnames}",
                file=sys.stderr,
            )
            sys.exit(1)

        for row in reader:
            total_rows += 1

            src_url = row["source"].strip()
            tgt_str = row["target_id"].strip()

            if not src_url or not tgt_str:
                continue

            try:
                target_id = int(tgt_str)
            except ValueError:
                continue

            if src_url not in url_to_id:
                skipped_missing_src += 1
                continue

            source_id = url_to_id[src_url]

            # optional: skip self-loops
            if source_id == target_id:
                skipped_self += 1
                continue

            edge = (source_id, target_id)
            if edge in seen_edges:
                continue
            seen_edges.add(edge)

            f_out.write(f"{source_id} {target_id}\n")
            written_edges += 1

    # 3) Save url->id mapping for later (parse_pagerank, TF-IDF, etc.)
    with open(url_to_id_out, "w", encoding="utf-8") as jf:
        json.dump(url_to_id, jf, ensure_ascii=False, indent=2)

    # 4) Summary
    print("Done converting graph.")
    print(f"  Input CSV rows         : {total_rows}")
    print(f"  Written edges          : {written_edges}")
    print(f"  Skipped missing source : {skipped_missing_src}")
    print(f"  Skipped self loops     : {skipped_self}")
    print(f"  Unique edges           : {len(seen_edges)}")
    print(f"  URLs in mapping        : {len(url_to_id)}")


if __name__ == "__main__":
    main()
