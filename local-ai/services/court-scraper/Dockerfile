# CRIM-SYS 2026 — court-scraper (Playwright, local-only)
# Headless Chromium to watch the Court of Cassation / Official Gazette sites
# for new rulings. Network egress is limited by docker-compose to these hosts.
FROM mcr.microsoft.com/playwright/python:v1.47.0-jammy

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY app.py /app/app.py

# Non-root runtime user (Playwright image provides a prepared browser cache).
RUN useradd --system --uid 10004 scraper \
    && chown -R scraper:scraper /app
USER scraper

EXPOSE 8400
# No healthcheck curl in this image family — python one-liner instead.
HEALTHCHECK --interval=60s --timeout=10s --retries=2 \
    CMD python -c "import urllib.request;urllib.request.urlopen('http://127.0.0.1:8400/health')" || exit 1

CMD ["uvicorn", "app:app", "--host", "127.0.0.1", "--port", "8400", "--workers", "1"]
