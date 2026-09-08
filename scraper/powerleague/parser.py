import re
from datetime import datetime

from bs4 import BeautifulSoup, Tag

from .config import (
    DATE_ROW_SELECTOR,
    DESKTOP_TABLE_SELECTOR,
    FIXTURES_CONTAINER_SELECTOR,
    RESULTS_CONTAINER_SELECTOR,
    SCORE_SELECTOR,
    STANDINGS_ROWS_SELECTOR,
    TEAM_LINK_SELECTOR,
    TEAM_NAME,
)
from .models import ScrapedFixture, ScrapedResult, StandingRow


class PowerleagueStructureError(ValueError):
    """Raised when required Powerleague markup is absent or malformed."""


def _clean_text(element: Tag) -> str:
    return " ".join(element.get_text(" ", strip=True).split())


def _iso_date(value: str) -> str:
    try:
        return datetime.strptime(value.strip(), "%d/%m/%Y").date().isoformat()
    except ValueError as error:
        raise PowerleagueStructureError(
            f"Unexpected Powerleague date: {value!r}."
        ) from error


def parse_standings(soup: BeautifulSoup) -> list[StandingRow]:
    rows: list[StandingRow] = []
    for row in soup.select(STANDINGS_ROWS_SELECTOR):
        cells = row.find_all("td", recursive=False)
        if len(cells) != 10:
            raise PowerleagueStructureError(
                "A standings row did not contain the expected ten columns."
            )

        values = [_clean_text(cell) for cell in cells]
        try:
            rows.append(
                StandingRow(
                    position=int(values[0]),
                    club_name=values[1],
                    played=int(values[2]),
                    won=int(values[3]),
                    drawn=int(values[4]),
                    lost=int(values[5]),
                    gf=int(values[6]),
                    ga=int(values[7]),
                    gd=int(values[8]),
                    points=int(values[9]),
                )
            )
        except ValueError as error:
            raise PowerleagueStructureError(
                "A standings row contained a non-numeric statistic."
            ) from error

    if not rows or not any(row.club_name.casefold() == TEAM_NAME.casefold() for row in rows):
        raise PowerleagueStructureError(
            f"The current standings did not include {TEAM_NAME}."
        )

    return rows


def _desktop_table(container: Tag, section_name: str) -> Tag:
    table = container.select_one(DESKTOP_TABLE_SELECTOR)
    if table is None:
        raise PowerleagueStructureError(
            f"The Powerleague {section_name} table was not found."
        )
    return table


def parse_fixtures(soup: BeautifulSoup) -> list[ScrapedFixture]:
    container = soup.select_one(FIXTURES_CONTAINER_SELECTOR)
    if container is None:
        raise PowerleagueStructureError("The Powerleague fixtures section was not found.")

    table = _desktop_table(container, "fixtures")
    fixtures: list[ScrapedFixture] = []
    current_date: str | None = None

    for row in table.select("tbody > tr"):
        date_element = row.select_one(DATE_ROW_SELECTOR)
        if date_element is not None:
            current_date = _iso_date(_clean_text(date_element))
            continue

        teams = [_clean_text(team) for team in row.select(TEAM_LINK_SELECTOR)]
        if len(teams) != 2 or not any(
            team.casefold() == TEAM_NAME.casefold() for team in teams
        ):
            continue
        if current_date is None:
            raise PowerleagueStructureError("A fixture appeared before its date heading.")

        opponent = next(team for team in teams if team.casefold() != TEAM_NAME.casefold())
        cells = row.find_all("td", recursive=False)
        if len(cells) < 2:
            raise PowerleagueStructureError("A fixture row was missing kick-off details.")
        details = _clean_text(cells[1])
        match = re.fullmatch(r"(\d{2}:\d{2})\s*-\s*(.+)", details)
        if match is None:
            raise PowerleagueStructureError(
                f"Unexpected fixture details: {details!r}."
            )

        fixtures.append(
            ScrapedFixture(
                opponent_club_name=opponent,
                scheduled_date=current_date,
                scheduled_time=match.group(1),
                venue=match.group(2).strip(),
            )
        )

    return fixtures


def parse_results(soup: BeautifulSoup) -> list[ScrapedResult]:
    container = soup.select_one(RESULTS_CONTAINER_SELECTOR)
    if container is None:
        raise PowerleagueStructureError("The Powerleague results section was not found.")

    results: list[ScrapedResult] = []
    current_date: str | None = None

    for row in container.select("table tbody > tr"):
        date_element = row.select_one(DATE_ROW_SELECTOR)
        if date_element is not None:
            current_date = _iso_date(_clean_text(date_element))
            continue

        teams = [_clean_text(team) for team in row.select(TEAM_LINK_SELECTOR)]
        if len(teams) != 2 or not any(
            team.casefold() == TEAM_NAME.casefold() for team in teams
        ):
            continue
        if current_date is None:
            raise PowerleagueStructureError("A result appeared before its date heading.")

        score_elements = row.select(SCORE_SELECTOR)
        if len(score_elements) != 2:
            raise PowerleagueStructureError("A result row did not contain two scores.")
        try:
            scores = [int(_clean_text(score)) for score in score_elements]
        except ValueError as error:
            raise PowerleagueStructureError(
                "A result row contained a non-numeric score."
            ) from error

        team_index = next(
            index for index, team in enumerate(teams) if team.casefold() == TEAM_NAME.casefold()
        )
        results.append(
            ScrapedResult(
                opponent_club_name=teams[1 - team_index],
                date_played=current_date,
                our_score=scores[team_index],
                opponent_score=scores[1 - team_index],
            )
        )

    return results


def parse_powerleague_html(
    html: str,
) -> tuple[list[StandingRow], list[ScrapedFixture], list[ScrapedResult]]:
    soup = BeautifulSoup(html, "html.parser")
    return parse_standings(soup), parse_fixtures(soup), parse_results(soup)

