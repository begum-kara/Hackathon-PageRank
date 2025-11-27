import requests
import os
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse
from collections import deque
import csv
import argparse
import json


def is_same_domain(url, base_netloc):
    """
    Simple same-host check:
    Only keep links that stay on the exact same host as the start URL.
    """
    try:
        return urlparse(url).netloc == base_netloc
    except Exception:
        return False


def normalize_url(url):
    # remove fragment part like #section
    parsed = urlparse(url)
    return parsed._replace(fragment="").geturl()


def extract_text(html: str) -> str:
    """
    Extract visible text from HTML and clean it up a bit.
    """
    soup = BeautifulSoup(html, "html.parser")
    text = soup.get_text(separator=" ", strip=True)
    text = " ".join(text.split())  # collapse spaces
    return text


def crawl(start_url, max_pages, output_file):
    start_url = normalize_url(start_url)
    base_netloc = urlparse(start_url).netloc

    visited = set()
    edges = []  # (source_url, target_id)
    pages = []  # {"id":..., "url":..., "text":...}
    queue = deque([start_url])

    url_to_id = {}
    next_id = 0

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

        html = resp.text

        # ----- assign ID to this page -----
        if url not in url_to_id:
            url_to_id[url] = next_id
            next_id += 1
        page_id = url_to_id[url]

        # ----- store page text -----
        page_text = extract_text(html)
        pages.append({"id": page_id, "url": url, "text": page_text})

        # ----- parse links -----
        soup = BeautifulSoup(html, "html.parser")

        for a in soup.find_all("a", href=True):
            href = a["href"]
            target = urljoin(url, href)
            target = normalize_url(target)

            if not is_same_domain(target, base_netloc):
                continue

            if target.startswith("mailto:") or target.startswith("javascript:"):
                continue

            # assign ID to target
            if target not in url_to_id:
                url_to_id[target] = next_id
                next_id += 1
            target_id = url_to_id[target]

            # --- CSV now has source URL string + target ID ---
            edges.append((url, target_id))

            if target not in visited:
                queue.append(target)

    # --- write edges.csv ---
    with open(output_file, "w", newline="", encoding="utf8") as f:
        writer = csv.writer(f)
        writer.writerow(["source", "target_id"])
        writer.writerows(edges)

    # --- write pages.json next to CSV ---
    pages_dir = os.path.dirname(output_file)
    pages_path = os.path.join(pages_dir, "pages.json")

    with open(pages_path, "w", encoding="utf8") as jf:
        json.dump(pages, jf, ensure_ascii=False, indent=2)

    print("\nDone.")
    print(f"Pages visited: {len(visited)}")
    print(f"Unique pages: {len(url_to_id)}")
    print(f"Edges collected: {len(edges)}")
    print(f"Saved edges to {output_file}")
    print(f"Saved pages to {pages_path}")


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
    os.makedirs(data_dir, exist_ok=True)
    output_path = os.path.join(data_dir, args.output)

    crawl(args.start_url, args.max_pages, output_path)


if __name__ == "__main__":
    main()
