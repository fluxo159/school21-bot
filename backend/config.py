"""Environment configuration shared by the bot and web server."""

import os
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(PROJECT_ROOT / ".env", override=False)

BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()
BACKEND_URL = os.getenv("BACKEND_URL", "").strip().rstrip("/")
DEMO_MODE = os.getenv("DEMO_MODE", "false").lower() == "true"
DEMO_USER_ID = 123456789
ADMIN_TELEGRAM_IDS = frozenset(
    int(value.strip()) for value in os.getenv("ADMIN_TELEGRAM_IDS", "").split(",") if value.strip()
)
INIT_DATA_MAX_AGE = int(os.getenv("INIT_DATA_MAX_AGE", "86400"))
if INIT_DATA_MAX_AGE <= 0:
    raise ValueError("INIT_DATA_MAX_AGE must be positive.")

CAMPUS_TIMEZONE = ZoneInfo(os.getenv("TZ", "Asia/Tashkent"))
_default_db = "instance/demo.db" if DEMO_MODE else "backend/school21.db"
_db_path = Path(os.getenv("DATABASE_PATH", _default_db)).expanduser()
DB_PATH = str(_db_path if _db_path.is_absolute() else PROJECT_ROOT / _db_path)


def campus_now() -> datetime:
    """Return campus wall time for the legacy naive SQLite timestamps."""
    return datetime.now(CAMPUS_TIMEZONE).replace(tzinfo=None)
