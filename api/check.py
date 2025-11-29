import json
from pathlib import Path

root = Path("/Users/hodaanis/Hackathon-PageRank")

pages_path = root / "crawler" / "data" / "pages.json"
pr_path = root / "backend" / "data" / "pagerank.json"

with pages_path.open() as f:
    pages = json.load(f)

with pr_path.open() as f:
    pr = json.load(f)

print("Pages:", len(pages))
print("Pagerank entries:", len(pr))

ids_pages = {int(p["id"]) for p in pages}
ids_pr = {int(x["id"]) for x in pr}

print("IDs in PR but not in pages:", ids_pr - ids_pages)
print("IDs in pages but not in PR:", ids_pages - ids_pr)

print("Top 5 PR:")
for item in pr[:5]:
    print(item["id"], item["url"], item["score"])
