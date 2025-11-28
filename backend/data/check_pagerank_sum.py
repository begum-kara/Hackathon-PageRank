import json

with open("pagerank.json", "r") as f:
    entries = json.load(f)

total = sum(item["score"] for item in entries)
print(f"Sum of PageRank scores: {total}")
