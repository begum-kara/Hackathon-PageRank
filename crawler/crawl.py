import requests
import os
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse
from collections import deque
import csv
import argparse


def is_same_domain(url, base_netloc):
    try:
        return urlparse(url).netloc == base_netloc
    except Exception:
        return False


def normalize_url(url):
    # remove fragment part like #section
    parsed = urlparse(url)
    return parsed._replace(fragment="").geturl()


def crawl(start_url, max_pages, output_file):
    start_url = normalize_url(start_url)
    base_netloc = urlparse(start_url).netloc

    visited = set()
    edges = []
    queue = deque([start_url])

    session = requests.Session()

    while queue and len(visited) < max_pages:
        url = queue.popleft()
        url = normalize_url(url)

        if url in visited:
            continue
        visited.add(url)

        print(f"Visiting {url} ({len(visited)}/{max_pages})")

        try:
            resp = session.get(url, timeout=5)
        except Exception as e:
            print(f"Request failed for {url}: {e}")
            continue

        content_type = resp.headers.get("Content-Type", "")
        if resp.status_code != 200 or "text/html" not in content_type:
            continue

        soup = BeautifulSoup(resp.text, "html.parser")

        for a in soup.find_all("a", href=True):
            href = a["href"]
            target = urljoin(url, href)
            target = normalize_url(target)

            # only stay inside same domain
            if not is_same_domain(target, base_netloc):
                continue

            # ignore mailto and similar
            if target.startswith("mailto:") or target.startswith("javascript:"):
                continue

            edges.append((url, target))

            if target not in visited:
                queue.append(target)

    # write edge list
    with open(output_file, "w", newline="", encoding="utf8") as f:
        writer = csv.writer(f)
        writer.writerow(["source", "target"])
        writer.writerows(edges)

    print(f"\nDone.")
    print(f"Pages visited: {len(visited)}")
    print(f"Edges collected: {len(edges)}")
    print(f"Saved to {output_file}")


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

    repo_root = os.path.dirname(__file__)
    data_dir = os.path.join(repo_root, "data")
    output_path = os.path.join(data_dir, args.output)

    crawl(args.start_url, args.max_pages, output_path)


if __name__ == "__main__":
    main()
