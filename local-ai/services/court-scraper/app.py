"""
CRIM-SYS 2026 — Egyptian court scraper (Playwright, local-only).

Contract:
  POST /scrape  {"keyword": "...", "limit": 10, "source": "cassation"|"gazette"}
            ->  {"results": [{"title", "url", "published_at", "text"}], "source": ...}
  GET  /health

Legal/polite scraping policy:
  * Public court publications only (محكمة النقض / الجريدة الرسمية portals).
  * Respects robots.txt disallow rules — checks and skips disallowed paths.
  * Rate-limited per run; identifies a custom User-Agent; no auth-walled or
    personal data is collected (rulings are anonymized by the courts).
  * Only the ai-internal network can call this service.

Source structure note: these portals are re-designed periodically. Selectors
are isolated in SOURCE_CONFIGS so updating them never touches logic.
"""

from __future__ import annotations

import hmac
import logging
import os
import re
import urllib.robotparser as robotparser
from datetime import datetime, timezone
from urllib.parse import urlparse

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

INTERNAL_API_KEY = os.environ.get("INTERNAL_API_KEY", "")
if not INTERNAL_API_KEY or len(INTERNAL_API_KEY) < 32:
    raise RuntimeError("INTERNAL_API_KEY missing — refusing to boot.")

USER_AGENT = "CRIM-SYS-local-monitor/1.0 (legal research; contact: firm-internal)"
MIN_DELAY_S = 3.0  # politeness delay between page fetches

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("court-scraper")

# ---------------------------------------------------------------------------
# Source configs — selectors live here and only here.
# ---------------------------------------------------------------------------
SOURCE_CONFIGS = {
    "cassation": {
        "name": "محكمة النقض",
        "search_url": "https://www.cc.gov.eg/search?q={keyword}",
        "robots_url": "https://www.cc.gov.eg/robots.txt",
        "result_links": "div.search-result a.result-title",
        "detail_text": "div.judgment-body, article.ruling-text",
        "published": "span.publish-date",
    },
    "gazette": {
        "name": "الجريدة الرسمية",
        "search_url": "https://www.egyptlgazette.com/search?q={keyword}",
        "robots_url": "https://www.egyptlgazette.com/robots.txt",
        "result_links": "li.gazette-item a",
        "detail_text": "div.issue-content",
        "published": "time.issue-date",
    },
}

ALLOWED_EGRESS_HOSTS = {
    urlparse(cfg["search_url"]).netloc for cfg in SOURCE_CONFIGS.values()
} | {"www.cc.gov.eg", "www.egyptlgazette.com"}

app = FastAPI(title="CRIM-SYS court-scraper", docs_url=None, redoc_url=None)


@app.middleware("http")
async def _auth(request, call_next):
    key = request.headers.get("X-Internal-Key", "")
    if not hmac.compare_digest(key, INTERNAL_API_KEY):
        raise HTTPException(status_code=401, detail="unauthorized")
    return await call_next(request)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


class ScrapeRequest(BaseModel):
    keyword: str = Field(..., min_length=2, max_length=120)
    limit: int = Field(10, ge=1, le=25)
    source: str = Field("cassation", pattern="^(cassation|gazette)$")


def _robots_allows(robots_url: str, url: str) -> bool:
    try:
        rp = robotparser.RobotFileParser()
        rp.set_url(robots_url)
        rp.read()
        return rp.can_fetch(USER_AGENT, url)
    except Exception:  # noqa: BLE001 — unreachable robots => be conservative
        return False


def _clean(text: str) -> str:
    return re.sub(r"\s+", " ", text or "").strip()


def scrape(req: ScrapeRequest) -> list[dict]:
    from playwright.sync_api import sync_playwright

    cfg = SOURCE_CONFIGS[req.source]
    results: list[dict] = []

    with sync_playwright() as p:
        #chromium with a hardened context: no third-party cookies, one tab.
        browser = p.chromium.launch(headless=True, args=["--disable-dev-shm-usage"])
        context = browser.new_context(user_agent=USER_AGENT)
        page = context.new_page()

        search_url = cfg["search_url"].format(keyword=req.keyword)
        if not _robots_allows(cfg["robots_url"], search_url):
            logger.warning("robots.txt disallows %s — aborting run", search_url)
            browser.close()
            return []

        page.goto(search_url, wait_until="domcontentloaded", timeout=45_000)
        links = page.locator(cfg["result_links"])
        count = min(links.count(), req.limit)

        for i in range(count):
            href = links.nth(i).get_attribute("href") or ""
            if not href:
                continue
            host = urlparse(href).netloc
            if href.startswith("/"):
                parsed = urlparse(search_url)
                href = f"{parsed.scheme}://{parsed.netloc}{href}"
                host = parsed.netloc
            if host not in ALLOWED_EGRESS_HOSTS:
                continue
            if not _robots_allows(cfg["robots_url"], href):
                continue

            try:
                page.goto(href, wait_until="domcontentloaded", timeout=45_000)
                text_el = page.locator(cfg["detail_text"]).first
                body = _clean(text_el.inner_text(timeout=10_000))[:20_000]
                date_el = page.locator(cfg["published"]).first
                published = _clean(date_el.inner_text(timeout=3_000))
            except Exception:  # noqa: BLE001 — skip malformed page, keep run
                logger.info("skipped unparsable page %s", href)
                continue

            title = _clean(links.nth(i).inner_text(timeout=3_000)) or href
            results.append(
                {
                    "title": title,
                    "url": href,
                    "published_at": published,
                    "text": body,
                }
            )
            import time as _t
            _t.sleep(MIN_DELAY_S)  # politeness rate limit between detail pages

        browser.close()
    return results


@app.post("/scrape")
def scrape_endpoint(req: ScrapeRequest, x_internal_key: str = Header(default="")) -> dict:
    if not hmac.compare_digest(x_internal_key, INTERNAL_API_KEY):
        raise HTTPException(status_code=401, detail="unauthorized")
    started = datetime.now(timezone.utc).isoformat()
    try:
        results = scrape(req)
    except Exception:  # noqa: BLE001
        logger.exception("scrape run failed")
        raise HTTPException(status_code=502, detail="scrape_failed")
    logger.info("scrape done: source=%s keyword=%r results=%d",
                req.source, req.keyword[:3] + "***", len(results))
    return {"source": req.source, "started_at": started, "results": results}
