from pathlib import Path

from powerleague.parser import parse_powerleague_html

FIXTURE_PATH = Path(__file__).parent / "fixtures" / "powerleague_league.html"


def test_known_good_real_markup_is_parsed() -> None:
    standings, fixtures, results = parse_powerleague_html(
        FIXTURE_PATH.read_text(encoding="utf-8")
    )

    assert len(standings) == 2
    assert standings[1].to_dict() == {
        "position": 2,
        "clubName": "24 Hour Party People",
        "played": 4,
        "won": 3,
        "drawn": 0,
        "lost": 1,
        "gf": 10,
        "ga": 8,
        "gd": 2,
        "points": 9,
        "walkoverGames": 0,
    }
    assert [fixture.to_dict() for fixture in fixtures] == [
        {
            "opponentClubName": "Future Opponents",
            "scheduledDate": "2026-09-15",
            "scheduledTime": "19:40",
            "competition": "LEAGUE",
            "venue": "Pitch 1",
        }
    ]
    assert [result.to_dict() for result in results] == [
        {
            "opponentClubName": "League Leaders",
            "datePlayed": "2026-09-01",
            "ourScore": 4,
            "opponentScore": 1,
            "competition": "LEAGUE",
        }
    ]

