"""Verify Telegram Mini App identity before accessing private API routes."""

import hashlib
import hmac
import json
import time
from urllib.parse import parse_qsl


def validate_init_data(init_data: str, token: str, max_age: int) -> int:
    """Return a signed Telegram user ID; reject forged or expired initData.

    Implements Telegram's HMAC-SHA256 Mini App validation protocol. The
    URL's startapp and the browser's initDataUnsafe are never trusted.
    """
    if not token or not init_data or len(init_data) > 16384:
        raise ValueError("Open this app from Telegram to authenticate.")
    try:
        pairs = parse_qsl(init_data, keep_blank_values=True, strict_parsing=True)
        fields = dict(pairs)
        if len(fields) != len(pairs):
            raise ValueError("Duplicate authentication fields.")
        supplied_hash = fields.pop("hash")
        check_string = "\n".join(f"{key}={value}" for key, value in sorted(fields.items()))
        secret = hmac.new(b"WebAppData", token.encode(), hashlib.sha256).digest()
        expected_hash = hmac.new(secret, check_string.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(expected_hash, supplied_hash):
            raise ValueError("Invalid Telegram signature.")
        age = time.time() - int(fields["auth_date"])
        if age < -30 or age > max_age:
            raise ValueError("Telegram session expired. Reopen the Mini App.")
        user_id = json.loads(fields["user"])["id"]
        if type(user_id) is not int or user_id <= 0:
            raise ValueError("Invalid Telegram user ID.")
        return user_id
    except (KeyError, TypeError, UnicodeError, json.JSONDecodeError) as error:
        raise ValueError("Invalid Telegram authentication data.") from error
