"""Fetch the latest Medium articles into data/medium.json for the portfolio's Blog app.

Runs weekly from .github/workflows/medium.yml; can also be run by hand:
    python scripts/fetch_medium.py
Uses only the standard library. Creative-writing posts are skipped so the
portfolio stays focused on tech articles.
"""

import html
import json
import re
import sys
import urllib.request
import xml.etree.ElementTree as ET
from email.utils import parsedate_to_datetime
from pathlib import Path

FEED_URL = "https://medium.com/feed/@bichuamz"
OUT_FILE = Path(__file__).resolve().parent.parent / "data" / "medium.json"
MAX_ARTICLES = 9
SKIP_TAGS = {"fiction", "short-story", "creative-writing", "romance", "love", "poetry"}
CONTENT_NS = "{http://purl.org/rss/1.0/modules/content/}encoded"


def first_image(content: str) -> str:
    match = re.search(r'<img[^>]+src="([^"]+)"', content)
    return match.group(1) if match else ""


def summary(content: str, limit: int = 160) -> str:
    text = re.sub(r"<figcaption.*?</figcaption>", " ", content, flags=re.S)
    text = re.sub(r"<h[1-6].*?</h[1-6]>", " ", text, flags=re.S)  # skip the repeated title
    text = html.unescape(re.sub(r"<[^>]+>", " ", text))
    text = re.sub(r"\s+", " ", text).strip()
    if len(text) <= limit:
        return text
    return text[:limit].rsplit(" ", 1)[0].rstrip(",.;:") + "…"


def reading_minutes(content: str) -> int:
    words = len(re.sub(r"<[^>]+>", " ", content).split())
    return max(1, round(words / 230))


def main() -> int:
    request = urllib.request.Request(FEED_URL, headers={"User-Agent": "portfolio-feed-fetcher"})
    with urllib.request.urlopen(request, timeout=30) as response:
        root = ET.fromstring(response.read())

    articles = []
    for item in root.iter("item"):
        tags = [c.text.strip().lower() for c in item.findall("category") if c.text]
        if SKIP_TAGS & set(tags):
            continue
        content = item.findtext(CONTENT_NS) or ""
        link = (item.findtext("link") or "").split("?")[0]
        articles.append({
            "title": (item.findtext("title") or "").strip(),
            "url": link,
            "date": parsedate_to_datetime(item.findtext("pubDate")).date().isoformat(),
            "tags": tags[:3],
            "image": first_image(content),
            "summary": summary(content),
            "minutes": reading_minutes(content),
        })
        if len(articles) >= MAX_ARTICLES:
            break

    if not articles:
        print("No articles found; leaving the existing file untouched.", file=sys.stderr)
        return 1

    OUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    OUT_FILE.write_text(json.dumps({"articles": articles}, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {len(articles)} articles to {OUT_FILE}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
