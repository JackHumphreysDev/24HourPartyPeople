import logging

import requests

from powerleague.service import scrape_powerleague


class FakeResponse:
    text = "<html><body><p>Unexpected page</p></body></html>"

    def raise_for_status(self) -> None:
        return None


def test_structural_failure_is_logged_and_returns_no_replacement(
    caplog,
) -> None:
    caplog.set_level(logging.ERROR)

    result = scrape_powerleague(request_get=lambda *args, **kwargs: FakeResponse())

    assert result is None
    assert "Powerleague scrape failed" in caplog.text
    assert "current standings" in caplog.text


def test_network_failure_without_cache_is_logged_and_returns_none(caplog) -> None:
    caplog.set_level(logging.ERROR)

    def fail_request(*args, **kwargs):
        raise requests.ConnectionError("Powerleague is unavailable")

    result = scrape_powerleague(request_get=fail_request)

    assert result is None
    assert "Powerleague is unavailable" in caplog.text

