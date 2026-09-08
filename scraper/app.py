import hmac
import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Header, HTTPException, status

from powerleague.service import scrape_powerleague

load_dotenv(Path(__file__).resolve().parent.parent / "server" / ".env")

app = FastAPI(docs_url=None, redoc_url=None, title="Powerleague scraper")


def require_service_key(authorization: str | None = Header(default=None)) -> None:
    expected_key = os.environ.get("SCRAPER_SERVICE_KEY")
    supplied_key = authorization.removeprefix("Bearer ") if authorization else ""
    if not expected_key or not hmac.compare_digest(supplied_key, expected_key):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Valid internal service credentials are required.",
        )


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/scrape", dependencies=[Depends(require_service_key)])
def scrape() -> dict[str, object]:
    result = scrape_powerleague()
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Powerleague data could not be refreshed.",
        )

    return result.to_dict()
