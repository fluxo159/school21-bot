"""Persistence and transaction rules for users, rooms and bookings."""

from datetime import datetime
from typing import Any, Optional

from .config import campus_now
from .database import get_connection, get_db_connection


class User:
    """Profiles bound to a verified Telegram user ID."""

    @staticmethod
    def get_or_create(
        telegram_id: int, school_login: str | None = None, phone: str | None = None
    ) -> dict[str, Any]:
        """Return a peer or atomically create one with 1000 booking credits."""
        with get_db_connection() as conn:
            conn.execute("BEGIN IMMEDIATE")
            cursor = conn.execute(
                """INSERT INTO users (telegram_id, school_login, phone, coins, created_at)
                   VALUES (?, ?, ?, 1000, ?) ON CONFLICT(telegram_id) DO NOTHING""",
                (telegram_id, school_login, phone, campus_now().isoformat()),
            )
            is_new = cursor.rowcount == 1
            row = conn.execute(
                "SELECT id, telegram_id, school_login, phone, coins, created_at FROM users WHERE telegram_id = ?",
                (telegram_id,),
            ).fetchone()
        return dict(
            zip(("id", "telegram_id", "school_login", "phone", "coins", "created_at"), row),
            is_new=is_new,
        )

    @staticmethod
    def get_coins(telegram_id: int) -> int:
        """Return the peer booking-credit balance."""
        conn = get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute("SELECT coins FROM users WHERE telegram_id = ?", (telegram_id,))
            result = cursor.fetchone()
            return result[0] if result else 0
        finally:
            conn.close()

    @staticmethod
    def update_profile(telegram_id: int, school_login: str, phone: str) -> dict[str, Any]:
        """Update the caller's profile while serializing uniqueness checks."""
        from .login_validator import validate_login

        is_valid, error = validate_login(school_login)
        if not is_valid:
            return {"success": False, "error": error}
        with get_db_connection() as conn:
            conn.execute("BEGIN IMMEDIATE")
            existing = conn.execute(
                "SELECT 1 FROM users WHERE LOWER(school_login) = ? AND telegram_id != ?",
                (school_login.lower(), telegram_id),
            ).fetchone()
            if existing:
                return {"success": False, "error": "School login is already in use."}
            existing = conn.execute(
                "SELECT 1 FROM users WHERE phone = ? AND telegram_id != ?",
                (phone, telegram_id),
            ).fetchone()
            if existing:
                return {"success": False, "error": "Phone number is already in use."}
            conn.execute(
                """INSERT INTO users (telegram_id, school_login, phone, coins, created_at)
                   VALUES (?, ?, ?, 1000, ?)
                   ON CONFLICT(telegram_id) DO UPDATE
                   SET school_login = excluded.school_login, phone = excluded.phone""",
                (telegram_id, school_login, phone, campus_now().isoformat()),
            )
        return {"success": True}


class Room:
    """Campus room catalog and configured booking prices."""

    @staticmethod
    def get_all() -> list[dict[str, Any]]:
        """Return all active rooms ordered by floor and price."""
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM rooms WHERE is_active = 1 ORDER BY floor, type, price")
        rooms = cursor.fetchall()
        conn.close()

        return [
            {
                "id": r[0],
                "name": r[1],
                "type": r[2],
                "floor": r[3],  # ДОБАВЛЕНО ПОЛЕ ЭТАЖА
                "price": r[4],
                "description": r[5],
                "photo_url": r[6],
                "max_persons": r[7],
            }
            for r in rooms
        ]

    @staticmethod
    def get_by_floor(floor_number: int) -> list[dict[str, Any]]:
        """Return the active rooms on a floor."""
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT * FROM rooms WHERE is_active = 1 AND floor = ? ORDER BY type, price",
            (floor_number,),
        )
        rooms = cursor.fetchall()
        conn.close()

        return [
            {
                "id": r[0],
                "name": r[1],
                "type": r[2],
                "floor": r[3],
                "price": r[4],
                "description": r[5],
                "photo_url": r[6],
                "max_persons": r[7],
            }
            for r in rooms
        ]

    @staticmethod
    def get_by_id(room_id: int) -> Optional[dict[str, Any]]:
        """Return one room or None if it does not exist."""
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM rooms WHERE id = ?", (room_id,))
        room = cursor.fetchone()
        conn.close()

        if room:
            return {
                "id": room[0],
                "name": room[1],
                "type": room[2],
                "floor": room[3],
                "price": room[4],
                "description": room[5],
                "photo_url": room[6],
                "max_persons": room[7],
            }
        return None


class Booking:
    """Reservations and atomic internal-credit transactions."""

    @staticmethod
    def create(
        user_id: int, room_id: int, date: str, start_time: str, end_time: str
    ) -> dict[str, Any]:
        """Reserve a future slot and debit credits in one SQLite write transaction."""
        from datetime import timedelta

        from .database import get_db_connection

        try:
            start = datetime.strptime(f"{date} {start_time}", "%Y-%m-%d %H:%M")
            end = datetime.strptime(f"{date} {end_time}", "%Y-%m-%d %H:%M")
        except ValueError:
            return {"error": "Invalid date or time format."}
        if end < start:
            end += timedelta(days=1)
        if start <= campus_now() or not timedelta(hours=1) <= end - start < timedelta(days=1):
            return {"error": "Choose a future booking between one and 24 hours."}
        with get_db_connection() as conn:
            conn.execute("BEGIN IMMEDIATE")
            room = conn.execute(
                "SELECT price FROM rooms WHERE id = ? AND is_active = 1", (room_id,)
            ).fetchone()
            user = conn.execute("SELECT coins FROM users WHERE id = ?", (user_id,)).fetchone()
            if not room or not user:
                return {"error": "Room or user not found."}
            if user[0] < room[0]:
                return {"error": "Insufficient booking credits."}
            neighbors = conn.execute(
                """SELECT date, start_time, end_time FROM bookings
                   WHERE room_id = ? AND status = 'confirmed' AND date BETWEEN ? AND ?""",
                (room_id, (start.date() - timedelta(days=1)).isoformat(), end.date().isoformat()),
            ).fetchall()
            for existing_date, existing_start, existing_end in neighbors:
                other_start = datetime.fromisoformat(f"{existing_date}T{existing_start}")
                other_end = datetime.fromisoformat(f"{existing_date}T{existing_end}")
                if other_end < other_start:
                    other_end += timedelta(days=1)
                if start < other_end and end > other_start:
                    return {"error": "This slot is already booked."}
            cursor = conn.execute(
                "INSERT INTO bookings (user_id, room_id, date, start_time, end_time) VALUES (?, ?, ?, ?, ?)",
                (user_id, room_id, date, start_time, end_time),
            )
            booking_id = cursor.lastrowid
            conn.execute("UPDATE users SET coins = coins - ? WHERE id = ?", (room[0], user_id))
        return {"success": True, "booking_id": booking_id}

    @staticmethod
    def get_user_bookings(telegram_id: int) -> list[dict[str, Any]]:
        """Return confirmed bookings, including overnight continuations."""
        from datetime import datetime, timedelta

        conn = get_connection()
        cursor = conn.cursor()

        # Получаем все бронирования пользователя
        cursor.execute(
            """
            SELECT b.id, r.name, r.type, r.price, b.date, b.start_time, b.end_time, b.status, b.created_at
            FROM bookings b
            JOIN rooms r ON b.room_id = r.id
            JOIN users u ON b.user_id = u.id
            WHERE u.telegram_id = ? AND b.status = 'confirmed'
            ORDER BY b.date DESC, b.start_time DESC
        """,
            (telegram_id,),
        )

        bookings = cursor.fetchall()
        conn.close()

        result = []
        for b in bookings:
            booking_date = b[4]
            start_time = b[5]
            end_time = b[6]

            # Проверяем, переходит ли бронирование через полночь
            crosses_midnight = end_time < start_time

            result.append(
                {
                    "id": b[0],
                    "room_name": b[1],
                    "type": b[2],
                    "price": b[3],
                    "date": booking_date,
                    "start_time": start_time,
                    "end_time": end_time,
                    "status": b[7],
                    "created_at": b[8],
                    "crosses_midnight": crosses_midnight,
                }
            )

            # Если бронирование переходит через полночь, добавляем его также на следующий день
            if crosses_midnight:
                next_date = (
                    datetime.strptime(booking_date, "%Y-%m-%d") + timedelta(days=1)
                ).strftime("%Y-%m-%d")
                result.append(
                    {
                        "id": b[0],
                        "room_name": b[1],
                        "type": b[2],
                        "price": b[3],
                        "date": next_date,  # Показываем также на следующий день
                        "start_time": start_time,
                        "end_time": end_time,
                        "status": b[7],
                        "created_at": b[8],
                        "crosses_midnight": True,
                        "is_continuation": True,  # Флаг, что это продолжение с предыдущего дня
                    }
                )

        # Сортируем по дате и времени
        result.sort(key=lambda x: (x["date"], x["start_time"]), reverse=True)

        return result

    @staticmethod
    def get_user_bookings_by_id(user_id: int) -> list[dict[str, Any]]:
        """Return confirmed bookings for an internal user ID."""
        from datetime import datetime, timedelta

        conn = get_connection()
        cursor = conn.cursor()

        # Получаем все бронирования пользователя
        cursor.execute(
            """
            SELECT b.id, r.name, r.type, r.price, b.date, b.start_time, b.end_time, b.status, b.created_at
            FROM bookings b
            JOIN rooms r ON b.room_id = r.id
            WHERE b.user_id = ? AND b.status = 'confirmed'
            ORDER BY b.date DESC, b.start_time DESC
        """,
            (user_id,),
        )

        bookings = cursor.fetchall()
        conn.close()

        result = []
        for b in bookings:
            booking_date = b[4]
            start_time = b[5]
            end_time = b[6]

            # Проверяем, переходит ли бронирование через полночь
            crosses_midnight = end_time < start_time

            result.append(
                {
                    "id": b[0],
                    "room_name": b[1],
                    "type": b[2],
                    "price": b[3],
                    "date": booking_date,
                    "start_time": start_time,
                    "end_time": end_time,
                    "status": b[7],
                    "created_at": b[8],
                    "crosses_midnight": crosses_midnight,
                }
            )

            # Если бронирование переходит через полночь, добавляем его также на следующий день
            if crosses_midnight:
                next_date = (
                    datetime.strptime(booking_date, "%Y-%m-%d") + timedelta(days=1)
                ).strftime("%Y-%m-%d")
                result.append(
                    {
                        "id": b[0],
                        "room_name": b[1],
                        "type": b[2],
                        "price": b[3],
                        "date": next_date,  # Показываем также на следующий день
                        "start_time": start_time,
                        "end_time": end_time,
                        "status": b[7],
                        "created_at": b[8],
                        "crosses_midnight": True,
                        "is_continuation": True,  # Флаг, что это продолжение с предыдущего дня
                    }
                )

        # Сортируем по дате и времени
        result.sort(key=lambda x: (x["date"], x["start_time"]), reverse=True)

        return result
