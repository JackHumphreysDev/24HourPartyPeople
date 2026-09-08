from datetime import datetime, timezone

import pytest
from fastapi import HTTPException

import scraper.app as app_module
from powerleague.models import ScrapeResult


def test_scrape_endpoint_requires_internal_credentials(monkeypatch) -> None:
    monkeypatch.setenv("SCRAPER_SERVICE_KEY", "service-secret")

    with pytest.raises(HTTPException) as error:
        app_module.require_service_key(None)

    assert error.value.status_code == 401


def test_scrape_endpoint_returns_the_validated_payload(monkeypatch) -> None:
    monkeypatch.setenv("SCRAPER_SERVICE_KEY", "service-secret")
    monkeypatch.setattr(
        app_module,
        "scrape_powerleague",
        lambda: ScrapeResult(
            scraped_at=datetime(2026, 9, 8, 8, 30, tzinfo=timezone.utc),
            standings=[],
            fixtures=[],
            results=[],
        ),
    )
    app_module.require_service_key("Bearer service-secret")
    response = app_module.scrape()

    assert response == {
        "scrapedAt": "2026-09-08T08:30:00Z",
        "standings": [],
        "fixtures": [],
        "results": [],
    }
