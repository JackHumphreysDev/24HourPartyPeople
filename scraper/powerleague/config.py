POWERLEAGUE_URL = (
    "https://www.powerleague.com/league?"
    "league_id=c2eba5a8-76a3-e390-ef14-d1c4c8244ceb&division_id="
)
TEAM_NAME = "24 Hour Party People"

# Confirmed against the live Powerleague page on 8 September 2026. Keeping
# selectors here makes a future markup change a focused configuration update.
STANDINGS_ROWS_SELECTOR = ".League__Current__Standings table tbody > tr"
FIXTURES_CONTAINER_SELECTOR = ".League__Fixtures"
RESULTS_CONTAINER_SELECTOR = ".League__Results"
DESKTOP_TABLE_SELECTOR = "table.hidden"
DATE_ROW_SELECTOR = "tr.header-row strong"
TEAM_LINK_SELECTOR = ".team-link"
SCORE_SELECTOR = "span.w-8"

REQUEST_HEADERS = {
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-GB,en;q=0.9",
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/140.0.0.0 Safari/537.36"
    ),
}
REQUEST_TIMEOUT_SECONDS = 15

