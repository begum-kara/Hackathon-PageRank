import requests
import os
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse
from collections import deque
import csv
import argparse
import json
import re


def is_same_domain(url, base_netloc):
    """
    Simple same-host check:
    Only keep links that stay on the exact same host as the start URL.
    """
    try:
        return urlparse(url).netloc == base_netloc
    except Exception:
        return False


from urllib.parse import urlparse, urlunparse

def normalize_url(url):
    """
    Normalize URLs early in the crawl:
    - remove fragment
    - lowercase host
    - normalize trailing slash
    """
    parsed = urlparse(url)

    # remove fragment
    parsed = parsed._replace(fragment="")

    # lowercase host
    netloc = parsed.netloc.lower()

    # normalize path: treat /foo and /foo/ as same (except root)
    path = parsed.path or "/"
    if path != "/" and path.endswith("/"):
        path = path.rstrip("/")

    parsed = parsed._replace(netloc=netloc, path=path)
    return urlunparse(parsed)


'''

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
'''
def extract_text(html: str) -> str:
    """
    Extract main visible text from HTML, trying to skip header/nav/footer
    and other boilerplate. Designed to be generic and work across sites,
    not just TUM.
    """
    soup = BeautifulSoup(html, "html.parser")

    # 1) Remove obviously non-content tags (scripts, styles, forms, etc.)
    for tag in soup(["script", "style", "noscript", "svg", "img", "picture", "video", "audio", "canvas", "form", "button"]):
        tag.decompose()

    # 2) Remove typical boilerplate containers (navbars, headers, footers, cookie banners, etc.)
    boilerplate_selectors = [
        "header",
        "footer",
        "nav",
        "aside",
        ".navbar",
        ".nav",
        ".navigation",
        ".site-header",
        ".site-footer",
        ".footer",
        "#header",
        "#footer",
        "#nav",
        "#navbar",
        ".cookie",
        ".cookie-banner",
        "#cookie-banner",
        ".banner",
    ]
    for selector in boilerplate_selectors:
        for el in soup.select(selector):
            el.decompose()

    # 3) Try to find a "main content" container if present
    main = soup.find("main")
    if not main:
        # common generic candidates across many sites
        for cand in [
            "article",
            "#main",
            ".main",
            ".main-content",
            "#content",
            ".content",
            ".page-content",
            ".layout__content",
        ]:
            main = soup.select_one(cand)
            if main:
                break

    # Fallback: use <body>, or entire document if no better choice
    root = main or soup.body or soup

    # 4) Extract text from chosen root
    text = root.get_text(" ", strip=True)

    # 5) Normalize whitespace (collapse multiple spaces/newlines)
    text = re.sub(r"\s+", " ", text).strip()

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
