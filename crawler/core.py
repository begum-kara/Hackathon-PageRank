# core.py
import re
import time
import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse, urlunparse
from collections import deque
from concurrent.futures import ThreadPoolExecutor, as_completed


#Domain + URL helpers

def get_base_domain(netloc: str) -> str:
    """
    Extracts 'wikipedia.org' from 'en.wikipedia.org' or 'www.wikipedia.org'.
    Assumes standard 'name.tld' structure.
    """
    if not netloc:
        return ""
    parts = netloc.split(".")
    if len(parts) >= 2:
        return ".".join(parts[-2:])
    return netloc


def is_same_domain(url: str, base_domain: str) -> bool:
    """
    Relaxed same-domain check:
    - base_domain is something like 'wikipedia.org'
    - url may be 'en.wikipedia.org', 'de.wikipedia.org', etc.
    """
    try:
        url_netloc = urlparse(url).netloc.lower()
        return get_base_domain(url_netloc) == base_domain
    except Exception:
        return False


def normalize_url(url: str) -> str:
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


#Language detection

def detect_page_language(soup: BeautifulSoup) -> str | None:
    """
    Try to detect page language from <html lang="..."> or meta tags.
    Returns a short language code like 'en', 'de', or None if unknown.
    """
    lang = None

    # <html lang="en-US">, <html lang="de">
    if soup.html and soup.html.has_attr("lang"):
        lang = soup.html["lang"]

    # <meta http-equiv="content-language" content="en">
    if not lang:
        meta = soup.find("meta", attrs={"http-equiv": re.compile("content-language", re.I)})
        if meta and meta.get("content"):
            lang = meta["content"]

    # <meta name="language" content="en">
    if not lang:
        meta = soup.find("meta", attrs={"name": re.compile("language", re.I)})
        if meta and meta.get("content"):
            lang = meta["content"]

    if not lang:
        return None

    # normalize 'en-US', 'DE-de' -> 'en', 'de'
    lang = lang.strip().lower()
    lang = lang.split(",")[0]  # in case of "en, fr"
    lang = lang.split("-")[0]
    return lang or None


#Text extraction (reuse soup)

def extract_text_from_soup(soup: BeautifulSoup) -> str:
    """
    Extract main visible text from HTML, trying to skip header/nav/footer.
    Uses an existing BeautifulSoup object (no double parsing).
    """
    # 1) Remove obviously non-content tags
    for tag in soup(["script", "style", "noscript", "svg", "img",
                     "picture", "video", "audio", "canvas",
                     "form", "button"]):
        tag.decompose()

    # 2) Remove typical boilerplate containers
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

    # 3) Find main-like content region
    main = soup.find("main")
    if not main:
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

    root = main or soup.body or soup
    text = root.get_text(" ", strip=True)

    # Normalize whitespace
    text = re.sub(r"\s+", " ", text).strip()
    return text


#Fetch helper (for threads)

def fetch_url(session: requests.Session, url: str, timeout: float = 2.0):
    """
    Fetch a URL with given session and timeout.
    Returns (url, response or None).
    """
    try:
        resp = session.get(url, timeout=timeout)
        return url, resp
    except Exception:
        return url, None


#Main concurrent crawler

def crawl_graph(
    start_url: str,
    max_pages: int = 100,
    target_lang: str | None = None,
    workers: int = 5,
    verbose: bool = True,
):
    """
    Concurrent crawling logic with optional progress display.

    Args:
      start_url: starting URL
      max_pages: max number of pages to VISIT (including skipped languages)
      target_lang: e.g. "en" or "de"
      workers: number of parallel fetches
      verbose: whether to print progress to stdout

    Returns:
      pages: list of dicts {id, url, text}
      edges_url: list of (source_url, target_url)
      url_to_id: dict url -> int
      visited: set of visited URLs
    """
    start_url = normalize_url(start_url)
    parsed_start = urlparse(start_url)
    base_domain = get_base_domain(parsed_start.netloc.lower())

    if verbose:
        print(f"Crawling base domain: {base_domain}")
        if target_lang:
            print(f"Restricting to language: {target_lang}")

    visited: set[str] = set()
    pages: list[dict] = []      # {"id", "url", "text"}
    edges_url: list[tuple] = [] # (source_url, target_url)
    queue = deque([start_url])

    url_to_id: dict[str, int] = {}
    next_id = 0

    session = requests.Session()
    session.headers.update({
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/120.0.0.0 Safari/537.36"
        )
    })

    def print_progress():
        if not verbose:
            return
        visited_count = len(visited)
        indexed_count = len(pages)
        # Overwrite the same line
        print(
            f"\rProgress: visited={visited_count}/{max_pages} | "
            f"indexed(lang-ok)={indexed_count}",
            end="",
            flush=True,
        )

    with ThreadPoolExecutor(max_workers=workers) as executor:
        while queue and len(visited) < max_pages:
            # Build a batch of URLs to fetch in parallel
            batch: list[str] = []
            while queue and len(batch) < workers and (len(visited) + len(batch)) < max_pages:
                url = normalize_url(queue.popleft())
                if url in visited:
                    continue
                visited.add(url)
                batch.append(url)

            if not batch:
                break

            future_to_url = {
                executor.submit(fetch_url, session, url): url for url in batch
            }

            for future in as_completed(future_to_url):
                url, resp = future.result()

                if resp is None:
                    continue

                content_type = resp.headers.get("Content-Type", "")
                if resp.status_code != 200 or "text/html" not in content_type:
                    continue

                # Optional: skip giant pages (> 2 MB)
                if len(resp.content) > 2_000_000:
                    continue

                html = resp.text
                soup = BeautifulSoup(html, "html.parser")

                #  language filter 
                page_lang = detect_page_language(soup)

                if target_lang:
                    target_lang_norm = target_lang.lower()
                    page_lang_norm = page_lang.lower() if page_lang else None

                    if page_lang_norm and not page_lang_norm.startswith(target_lang_norm):
                        # visited but not indexed or expanded
                        continue

                #  assign ID 
                if url not in url_to_id:
                    url_to_id[url] = next_id
                    next_id += 1
                page_id = url_to_id[url]

                #  store page text 
                page_text = extract_text_from_soup(soup)
                pages.append({"id": page_id, "url": url, "text": page_text})

                #  parse links 
                for a in soup.find_all("a", href=True):
                    href = a["href"]
                    target = urljoin(url, href)
                    target = normalize_url(target)

                    if not is_same_domain(target, base_domain):
                        continue
                    if target.startswith("mailto:") or target.startswith("javascript:"):
                        continue

                    if target not in url_to_id:
                        url_to_id[target] = next_id
                        next_id += 1

                    edges_url.append((url, target))

                    if target not in visited:
                        queue.append(target)

            # print batch-level progress
            print_progress()
            # small politeness delay
            time.sleep(0.1)

    if verbose:
        print()  # move to next line after \r output

    return pages, edges_url, url_to_id, visited
