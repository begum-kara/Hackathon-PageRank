import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse, urlunparse
from collections import deque
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


def crawl_graph(start_url: str, max_pages: int = 100):
    """
    Core crawling logic, reusable for:
      - offline TUM crawl (writing edges.csv + pages.json)
      - online URL-mode crawl in the API

    Returns:
      pages: list of dicts {id, url, text}
      edges_url: list of (source_url, target_url)
      url_to_id: dict url -> int
      visited: set of visited URLs
    """
    start_url = normalize_url(start_url)
    base_netloc = urlparse(start_url).netloc

    visited = set()
    pages = []                 # {"id":..., "url":..., "text":...}
    edges_url = []             # (source_url, target_url)
    queue = deque([start_url])

    url_to_id = {}
    next_id = 0

    session = requests.Session()

    while queue and len(visited) < max_pages:
        url = normalize_url(queue.popleft())

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

            # record edge as (source_url, target_url)
            edges_url.append((url, target))

            if target not in visited:
                queue.append(target)

    return pages, edges_url, url_to_id, visited
