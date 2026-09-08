import logging
from collections.abc import Callable
from datetime import datetime, timezone

import requests

from .config import POWERLEAGUE_URL, REQUEST_HEADERS, REQUEST_TIMEOUT_SECONDS
from .models import ScrapeResult
from .parser import PowerleagueStructureError, parse_powerleague_html

LOGGER = logging.getLogger(__name__)


def scrape_powerleague(
    request_get: Callable[..., requests.Response] = requests.get,
) -> ScrapeResult | None:
    attempted_at = datetime.now(timezone.utc)
    try:
        response = request_get(
            POWERLEAGUE_URL,
            headers=REQUEST_HEADERS,
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        standings, fixtures, results = parse_powerleague_html(response.text)
        return ScrapeResult(
            scraped_at=attempted_at,
            standings=standings,
            fixtures=fixtures,
            results=results,
        )
    except (requests.RequestException, PowerleagueStructureError) as error:
        LOGGER.error(
            "Powerleague scrape failed at %s: %s",
            attempted_at.isoformat(),
            error,
        )
        return None

