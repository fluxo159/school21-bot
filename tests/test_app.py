"""Security and booking regressions using synthetic peers and isolated SQLite."""

import hashlib
import hmac
import json
import os
import tempfile
import time
import unittest
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from unittest.mock import patch
from urllib.parse import urlencode

# Override before importing application configuration; never load campus data.
_TEST_DIRECTORY = tempfile.TemporaryDirectory(prefix="school21-tests-")
os.environ.update(
    {
        "DATABASE_PATH": os.path.join(_TEST_DIRECTORY.name, "test.db"),
        "DEMO_MODE": "false",
        "TELEGRAM_BOT_TOKEN": "12345:synthetic-test-token",
        "BACKEND_URL": "https://school21.example.com",
        "ADMIN_TELEGRAM_IDS": "999",
        "INIT_DATA_MAX_AGE": "3600",
        "TZ": "Asia/Tashkent",
    }
)

from backend import config  # noqa: E402
from backend.app import app  # noqa: E402
from backend.database import get_db_connection, init_db  # noqa: E402
from backend.login_validator import validate_login  # noqa: E402
from backend.models import User  # noqa: E402
from backend.security import validate_init_data  # noqa: E402


def signed_data(user_id: int = 101, age: int = 0) -> str:
    """Create a Telegram-shaped credential using only a synthetic test token."""
    fields = {"auth_date": str(int(time.time()) - age), "user": json.dumps({"id": user_id})}
    secret = hmac.digest(b"WebAppData", config.BOT_TOKEN.encode(), "sha256")
    check = "\n".join(f"{key}={fields[key]}" for key in sorted(fields))
    fields["hash"] = hmac.new(secret, check.encode(), hashlib.sha256).hexdigest()
    return urlencode(fields)


def headers(user_id: int = 101) -> dict[str, str]:
    """Return an authenticated test request header."""
    return {"X-Telegram-Init-Data": signed_data(user_id)}


class SecurityTests(unittest.TestCase):
    """Assert signature validation, authorization and private-data boundaries."""

    def setUp(self) -> None:
        self.client = app.test_client()
        with get_db_connection() as conn:
            conn.execute("DELETE FROM bookings")
            conn.execute("DELETE FROM users")

    def test_valid_telegram_signature(self) -> None:
        self.assertEqual(validate_init_data(signed_data(), config.BOT_TOKEN, 3600), 101)

    def test_forged_expired_and_future_signatures_are_rejected(self) -> None:
        invalid = [
            signed_data().replace("101", "102"),
            signed_data(age=7200),
            signed_data(age=-300),
        ]
        for credential in invalid:
            with self.subTest(credential_age=credential[:20]), self.assertRaises(ValueError):
                validate_init_data(credential, config.BOT_TOKEN, 3600)

    def test_duplicate_and_malformed_fields_are_rejected(self) -> None:
        for credential in [signed_data() + "&auth_date=0", "user=invalid", "bad", ""]:
            with self.subTest(value_length=len(credential)), self.assertRaises(ValueError):
                validate_init_data(credential, config.BOT_TOKEN, 3600)

    def test_health_and_frontend_are_public(self) -> None:
        for url in ["/", "/api/ping", "/api.js", "/style.css"]:
            with self.subTest(url=url):
                response = self.client.get(url)
                self.assertEqual(response.status_code, 200)
                response.close()

    def test_private_endpoints_reject_unsigned_requests(self) -> None:
        self.assertEqual(self.client.post("/api/auth", json={"telegram_id": 101}).status_code, 401)
        for url in ["/api/rooms", "/api/admin/users-stats", "/api/admin/find-user?telegram_id=101"]:
            self.assertEqual(self.client.get(url).status_code, 401)

    def test_signed_identity_cannot_be_overridden(self) -> None:
        result = self.client.post(
            "/api/auth?startapp=202", headers=headers(), json={"telegram_id": 202}
        )
        self.assertEqual(result.status_code, 403)
        result = self.client.post("/api/auth?startapp=202", headers=headers(), json={})
        self.assertEqual(result.json["user"]["telegram_id"], 101)

    def test_all_admin_apis_require_allowlisted_identity(self) -> None:
        for url in [
            "/api/admin/users-stats",
            "/api/admin/online-users",
            "/api/admin/find-user?telegram_id=101",
        ]:
            with self.subTest(url=url):
                self.assertEqual(self.client.get(url, headers=headers()).status_code, 403)
        result = self.client.get("/api/admin/users-stats", headers=headers(999))
        self.assertEqual(result.status_code, 200)
        result = self.client.post("/api/auth", json={}, headers=headers(999))
        self.assertTrue(result.json["user"]["is_admin"])

    def test_admin_reports_with_registered_peers(self) -> None:
        self.client.post("/api/auth", headers=headers(), json={})
        User.update_profile(101, "peerabcd", "+998-90-000-00-00")
        for url in [
            "/api/admin/online-users",
            "/api/admin/users-stats",
            "/api/admin/find-user?telegram_id=101",
        ]:
            with self.subTest(url=url):
                result = self.client.get(url, headers=headers(999))
                self.assertEqual(result.status_code, 200)
                self.assertTrue(result.json["success"])
        report = self.client.get("/api/admin/users-stats", headers=headers(999)).json
        self.assertTrue(any(user["telegram_id"] == 101 for user in report["users"]))

    def test_concurrent_auth_creates_only_one_profile(self) -> None:
        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(lambda _: User.get_or_create(101), range(2)))
        self.assertEqual(results[0]["id"], results[1]["id"])
        self.assertEqual(sum(user["is_new"] for user in results), 1)

    def test_malformed_json_and_profile_types_return_client_errors(self) -> None:
        for payload in [[], None, "text"]:
            self.assertEqual(
                self.client.post("/api/auth", json=payload, headers=headers()).status_code, 400
            )
        result = self.client.post(
            "/api/profile/update", json={"school_login": 7, "phone": []}, headers=headers()
        )
        self.assertEqual(result.status_code, 400)

    def test_login_cannot_take_over_another_telegram_profile(self) -> None:
        User.get_or_create(202, "peerabcd", "+998-90-000-00-00")
        result = self.client.post(
            "/api/login",
            headers=headers(),
            json={
                "school_login": "peerabcd",
                "phone": "+998-90-000-00-00",
            },
        )
        self.assertEqual(result.status_code, 403)
        with get_db_connection() as conn:
            self.assertEqual(
                conn.execute("SELECT phone FROM users WHERE telegram_id = 202").fetchone()[0],
                "+998-90-000-00-00",
            )

    def test_valid_profile_registration_and_own_login(self) -> None:
        self.client.post("/api/auth", json={}, headers=headers())
        payload = {"school_login": "peerabcd", "phone": "+998-90-000-00-00"}
        result = self.client.post("/api/profile/update", json=payload, headers=headers())
        self.assertEqual(result.status_code, 200)
        result = self.client.post("/api/login", json=payload, headers=headers())
        self.assertEqual(result.json["user"]["telegram_id"], 101)
        self.assertFalse(result.json["user"]["is_admin"])

    def test_demo_is_loopback_only_and_cannot_use_admin_apis(self) -> None:
        with patch.object(config, "DEMO_MODE", True):
            self.assertEqual(
                self.client.post(
                    "/api/auth", json={}, environ_base={"REMOTE_ADDR": "203.0.113.1"}
                ).status_code,
                403,
            )
            result = self.client.post("/api/auth", json={})
            self.assertEqual(result.json["user"]["telegram_id"], config.DEMO_USER_ID)
            self.assertFalse(result.json["user"]["is_admin"])
            self.assertEqual(self.client.get("/api/admin/users-stats").status_code, 403)

    def test_response_privacy_headers(self) -> None:
        result = self.client.get("/api/rooms", headers=headers())
        self.assertEqual(result.headers["Cache-Control"], "no-store")
        self.assertEqual(result.headers["X-Content-Type-Options"], "nosniff")
        self.assertNotIn("Access-Control-Allow-Origin", result.headers)

    def test_login_format_has_no_special_admin_exception(self) -> None:
        self.assertTrue(validate_login("peerabcd")[0])
        for login in ["admin", "UPPERABC", "12345678", "bcdfghjk", "<script>"]:
            self.assertFalse(validate_login(login)[0])

    def test_existing_database_migration_is_idempotent(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            with patch("backend.database.DB_PATH", os.path.join(directory, "legacy.db")):
                with get_db_connection() as conn:
                    conn.execute("""CREATE TABLE users (
                        id INTEGER PRIMARY KEY, telegram_id INTEGER UNIQUE NOT NULL,
                        school_login TEXT UNIQUE, phone TEXT, coins INTEGER DEFAULT 1000,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)""")
                    conn.execute("INSERT INTO users (telegram_id) VALUES (101)")
                init_db()
                init_db()
                with get_db_connection() as conn:
                    self.assertIn(
                        "last_activity",
                        {row[1] for row in conn.execute("PRAGMA table_info(users)")},
                    )
                    self.assertEqual(conn.execute("SELECT COUNT(*) FROM users").fetchone()[0], 1)
                    self.assertEqual(conn.execute("SELECT COUNT(*) FROM rooms").fetchone()[0], 12)


class BookingTests(unittest.TestCase):
    """Exercise money-like credit changes and overnight reservation conflicts."""

    def setUp(self) -> None:
        self.client = app.test_client()
        with get_db_connection() as conn:
            conn.execute("DELETE FROM bookings")
            conn.execute("DELETE FROM users")
            self.room_id, self.price = conn.execute(
                "SELECT id, price FROM rooms LIMIT 1"
            ).fetchone()
        User.get_or_create(101)
        User.get_or_create(202)
        self.date = (config.campus_now().date() + timedelta(days=2)).isoformat()

    def book(
        self, start: str = "10:00", end: str = "11:00", user_id: int = 101, date: str | None = None
    ):
        """Submit one booking using a fresh client, safe for threaded tests."""
        with app.test_client() as client:
            return client.post(
                "/api/bookings/create",
                headers=headers(user_id),
                json={
                    "room_id": self.room_id,
                    "date": date or self.date,
                    "start_time": start,
                    "end_time": end,
                },
            )

    def balance(self, user_id: int = 101) -> int:
        """Read the caller's balance through the authorized API."""
        return self.client.post("/api/coins", json={}, headers=headers(user_id)).json["coins"]

    def test_booking_debits_once_and_cancellation_refunds_once(self) -> None:
        result = self.book()
        self.assertEqual(result.status_code, 200)
        booking_id = result.json["booking_id"]
        self.assertEqual(self.balance(), 1000 - self.price)
        url = f"/api/bookings/{booking_id}/cancel"
        self.assertEqual(self.client.post(url, json={}, headers=headers()).status_code, 200)
        self.assertEqual(self.balance(), 1000)
        self.assertEqual(self.client.post(url, json={}, headers=headers()).status_code, 400)
        self.assertEqual(self.balance(), 1000)

    def test_overlap_rejected_and_adjacent_slot_allowed(self) -> None:
        self.assertEqual(self.book("10:00", "12:00").status_code, 200)
        self.assertEqual(self.book("11:00", "13:00", 202).status_code, 400)
        self.assertEqual(self.book("12:00", "13:00", 202).status_code, 200)

    def test_overnight_overlap_is_detected_in_both_directions(self) -> None:
        next_date = (config.campus_now().date() + timedelta(days=3)).isoformat()
        self.assertEqual(self.book("23:00", "02:00").status_code, 200)
        self.assertEqual(self.book("01:00", "03:00", 202, next_date).status_code, 400)
        self.assertEqual(self.book("22:00", "00:00", 202).status_code, 400)
        self.assertEqual(self.book("02:00", "03:00", 202, next_date).status_code, 200)

    def test_next_day_booking_blocks_new_overnight_booking(self) -> None:
        next_date = (config.campus_now().date() + timedelta(days=3)).isoformat()
        self.assertEqual(self.book("01:00", "03:00", 202, next_date).status_code, 200)
        self.assertEqual(self.book("23:00", "02:00").status_code, 400)

    def test_concurrent_bookings_cannot_reserve_the_same_slot(self) -> None:
        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(lambda user: self.book(user_id=user).status_code, [101, 202]))
        self.assertEqual(sorted(results), [200, 400])
        self.assertEqual(self.balance(101) + self.balance(202), 2000 - self.price)

    def test_concurrent_cancellations_refund_only_once(self) -> None:
        booking_id = self.book().json["booking_id"]

        def cancel() -> int:
            with app.test_client() as client:
                return client.post(
                    f"/api/bookings/{booking_id}/cancel", json={}, headers=headers()
                ).status_code

        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(lambda _: cancel(), range(2)))
        self.assertEqual(sorted(results), [200, 400])
        self.assertEqual(self.balance(), 1000)

    def test_other_peer_cannot_cancel_or_read_private_bookings(self) -> None:
        booking_id = self.book().json["booking_id"]
        self.assertEqual(
            self.client.post(
                f"/api/bookings/{booking_id}/cancel", json={}, headers=headers(202)
            ).status_code,
            404,
        )
        result = self.client.post(
            "/api/my-bookings",
            headers=headers(202),
            json={"school_login": "peerabcd", "phone": "anything"},
        )
        self.assertEqual(result.json["bookings"], [])
        self.assertEqual(self.balance(202), 1000)

    def test_invalid_times_past_dates_and_short_slots_are_rejected(self) -> None:
        for start, end in [
            ("bad", "12:00"),
            ("25:00", "26:00"),
            ("10:00", "10:30"),
            ("10:00", "10:00"),
        ]:
            with self.subTest(start=start, end=end):
                self.assertEqual(self.book(start, end).status_code, 400)
        past = (config.campus_now().date() - timedelta(days=1)).isoformat()
        self.assertEqual(self.book(date=past).status_code, 400)
        self.assertEqual(self.balance(), 1000)

    def test_insufficient_credits_and_inactive_rooms_cannot_be_booked(self) -> None:
        with get_db_connection() as conn:
            conn.execute("UPDATE users SET coins = 0 WHERE telegram_id = 101")
        self.assertEqual(self.book().status_code, 400)
        with get_db_connection() as conn:
            conn.execute("UPDATE rooms SET is_active = 0 WHERE id = ?", (self.room_id,))
        try:
            self.assertEqual(self.book(user_id=202).status_code, 400)
        finally:
            with get_db_connection() as conn:
                conn.execute("UPDATE rooms SET is_active = 1 WHERE id = ?", (self.room_id,))

    def test_cancellation_cutoff_preserves_booking_and_balance(self) -> None:
        booking_id = self.book().json["booking_id"]
        start = config.campus_now() + timedelta(minutes=30)
        with get_db_connection() as conn:
            conn.execute(
                "UPDATE bookings SET date = ?, start_time = ? WHERE id = ?",
                (start.date().isoformat(), start.strftime("%H:%M"), booking_id),
            )
        self.assertEqual(
            self.client.post(
                f"/api/bookings/{booking_id}/cancel", json={}, headers=headers()
            ).status_code,
            400,
        )
        self.assertEqual(self.balance(), 1000 - self.price)

    def test_status_includes_previous_night_not_future_night(self) -> None:
        self.assertEqual(self.book("23:00", "02:00").status_code, 200)
        from datetime import datetime

        day = datetime.fromisoformat(self.date)
        with patch("backend.app.campus_now", return_value=day.replace(hour=1)):
            result = self.client.get("/api/rooms/floor/2/current-status", headers=headers())
            self.assertFalse(result.json["busy_rooms"][str(self.room_id)])
        with patch(
            "backend.app.campus_now", return_value=(day + timedelta(days=1)).replace(hour=1)
        ):
            result = self.client.get("/api/rooms/floor/2/current-status", headers=headers())
            self.assertTrue(result.json["busy_rooms"][str(self.room_id)])

    def test_busy_slots_do_not_expose_peer_identifiers(self) -> None:
        self.book()
        result = self.client.get(
            f"/api/rooms/{self.room_id}/busy-slots?date={self.date}", headers=headers(202)
        )
        self.assertEqual(result.status_code, 200)
        self.assertTrue(all(slot.get("user_login") is None for slot in result.json["busy_slots"]))


if __name__ == "__main__":
    unittest.main()
