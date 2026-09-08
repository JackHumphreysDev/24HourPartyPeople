from dataclasses import dataclass
from datetime import datetime
from typing import Literal


@dataclass(frozen=True)
class StandingRow:
    position: int
    club_name: str
    played: int
    won: int
    drawn: int
    lost: int
    gf: int
    ga: int
    gd: int
    points: int
    walkover_games: int = 0

    def to_dict(self) -> dict[str, int | str]:
        return {
            "position": self.position,
            "clubName": self.club_name,
            "played": self.played,
            "won": self.won,
            "drawn": self.drawn,
            "lost": self.lost,
            "gf": self.gf,
            "ga": self.ga,
            "gd": self.gd,
            "points": self.points,
            "walkoverGames": self.walkover_games,
        }


@dataclass(frozen=True)
class ScrapedFixture:
    opponent_club_name: str
    scheduled_date: str
    scheduled_time: str | None
    competition: Literal["LEAGUE", "CUP"] = "LEAGUE"
    venue: str | None = None

    def to_dict(self) -> dict[str, str | None]:
        return {
            "opponentClubName": self.opponent_club_name,
            "scheduledDate": self.scheduled_date,
            "scheduledTime": self.scheduled_time,
            "competition": self.competition,
            "venue": self.venue,
        }


@dataclass(frozen=True)
class ScrapedResult:
    opponent_club_name: str
    date_played: str
    our_score: int
    opponent_score: int
    competition: Literal["LEAGUE", "CUP"] = "LEAGUE"

    def to_dict(self) -> dict[str, int | str]:
        return {
            "opponentClubName": self.opponent_club_name,
            "datePlayed": self.date_played,
            "ourScore": self.our_score,
            "opponentScore": self.opponent_score,
            "competition": self.competition,
        }


@dataclass(frozen=True)
class ScrapeResult:
    scraped_at: datetime
    standings: list[StandingRow]
    fixtures: list[ScrapedFixture]
    results: list[ScrapedResult]

    def to_dict(self) -> dict[str, object]:
        return {
            "scrapedAt": self.scraped_at.isoformat().replace("+00:00", "Z"),
            "standings": [row.to_dict() for row in self.standings],
            "fixtures": [fixture.to_dict() for fixture in self.fixtures],
            "results": [result.to_dict() for result in self.results],
        }
