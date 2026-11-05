"""SQLite schema, seed rooms and connection helpers."""

import os
import sqlite3
from contextlib import contextmanager
from typing import Iterator

from .config import DB_PATH


@contextmanager
def get_db_connection() -> Iterator[sqlite3.Connection]:
    """Yield a connection that commits on success and rolls back on failure."""
    # Включаем WAL режим для лучшей параллельности чтения/записи
    conn = sqlite3.connect(DB_PATH, timeout=20.0)  # Таймаут 20 секунд для ожидания блокировки
    try:
        # Включаем WAL (Write-Ahead Logging) режим для лучшей параллельности
        conn.execute("PRAGMA journal_mode=WAL;")
        # Оптимизации для производительности
        conn.execute("PRAGMA synchronous=NORMAL;")  # Баланс между безопасностью и скоростью
        conn.execute("PRAGMA cache_size=10000;")  # Увеличиваем кэш
        conn.execute("PRAGMA temp_store=MEMORY;")  # Временные таблицы в памяти
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db() -> None:
    """Create tables, migrate activity tracking and seed example campus rooms."""
    # Убеждаемся, что директория существует
    db_dir = os.path.dirname(DB_PATH)
    if db_dir and not os.path.exists(db_dir):
        os.makedirs(db_dir, exist_ok=True)

    conn = sqlite3.connect(DB_PATH, timeout=20.0)
    cursor = conn.cursor()

    try:
        # Serialize schema migration and room seeding across Gunicorn workers.
        cursor.execute("BEGIN IMMEDIATE")
        # Таблица пользователей
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            telegram_id INTEGER UNIQUE NOT NULL,
            school_login TEXT UNIQUE,
            phone TEXT,
            coins INTEGER DEFAULT 1000,  -- Для тестирования установлено 1000 коинов
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_activity TIMESTAMP
        )
        """)

        # Upgrade existing databases without resetting users or bookings.
        columns = {row[1] for row in cursor.execute("PRAGMA table_info(users)")}
        if "last_activity" not in columns:
            cursor.execute("ALTER TABLE users ADD COLUMN last_activity TIMESTAMP")

        # Таблица комнат С ПОЛЕМ ЭТАЖА
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS rooms (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            type TEXT NOT NULL,  -- 'skypbox' или 'meeting'
            floor INTEGER NOT NULL DEFAULT 2,
            price INTEGER NOT NULL,
            description TEXT,
            photo_url TEXT,
            max_persons INTEGER,
            is_active BOOLEAN DEFAULT 1
        )
        """)

        # Таблица бронирований
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS bookings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            room_id INTEGER NOT NULL,
            date DATE NOT NULL,
            start_time TIME NOT NULL,
            end_time TIME NOT NULL,
            status TEXT DEFAULT 'confirmed',  -- confirmed, cancelled, completed
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id),
            FOREIGN KEY (room_id) REFERENCES rooms (id)
        )
        """)

        # ДОБАВЛЕНО: Создаем индексы для оптимизации запросов
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_bookings_room_date 
            ON bookings(room_id, date, status)
        """)

        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_bookings_user 
            ON bookings(user_id)
        """)

        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_users_telegram 
            ON users(telegram_id)
        """)

        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_users_school_login 
            ON users(school_login)
        """)

        # Заполняем комнаты если они пустые С ЭТАЖАМИ
        cursor.execute("SELECT COUNT(*) FROM rooms")
        if cursor.fetchone()[0] == 0:
            # 2 ЭТАЖ - скайпницы (3 одинаковые)
            floor2_rooms = [
                (
                    "Скайпница 1",
                    "skypbox",
                    2,
                    4,
                    "Вместимость 4 человека 🔊\nПолная шумоизоляция 🎧\nИдеальна для созвонов и работы в тишине\nКомфортное кресло и стол",
                    "https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=400&fit=crop",
                    4,
                ),
                (
                    "Скайпница 2",
                    "skypbox",
                    2,
                    4,
                    "Вместимость 4 человека 🔊\nПолная шумоизоляция 🎧\nДля важных звонков и фокусировки\nОснащена розетками и USB",
                    "https://images.unsplash.com/photo-1564069114553-7215e1ff1890?w=400&fit=crop",
                    4,
                ),
                (
                    "Скайпница 3",
                    "skypbox",
                    2,
                    4,
                    "Вместимость 4 человека 🔊\nПолная шумоизоляция 🎧\nУединенное пространство для работы\nХорошее освещение и вентиляция",
                    "https://images.unsplash.com/photo-1497366216548-37526070297c?w=400&fit=crop",
                    4,
                ),
            ]

            # 3 ЭТАЖ - 6 скайпниц и 3 переговорки
            floor3_rooms = [
                # Скайпницы 3 этажа (6 штук) - 4 коина
                (
                    "Скайпница 1",
                    "skypbox",
                    3,
                    4,
                    "Вместимость 4 человека 🔊\nПолная шумоизоляция 🎧\nСтандартная кабинка на 3 этаже\nТихая зона для работы",
                    "assets/skype_room.jpg",
                    4,
                ),
                (
                    "Скайпница 2",
                    "skypbox",
                    3,
                    4,
                    "Вместимость 4 человека 🔊\nПолная шумоизоляция 🎧\nУютная рабочая зона\nДля индивидуальной работы",
                    "assets/skype_room.jpg",
                    4,
                ),
                (
                    "Скайпница 3",
                    "skypbox",
                    3,
                    4,
                    "Вместимость 4 человека 🔊\nПолная шумоизоляция 🎧\nИзолированное пространство\nИдеально для интервью",
                    "assets/skype_room.jpg",
                    4,
                ),
                (
                    "Скайпница 4",
                    "skypbox",
                    3,
                    4,
                    "Вместимость 4 человека 🔊\nПолная шумоизоляция 🎧\nКомфортная кабинка\nДля важных звонков",
                    "assets/skype_room.jpg",
                    4,
                ),
                (
                    "Скайпница 5",
                    "skypbox",
                    3,
                    4,
                    "Вместимость 4 человека 🔊\nПолная шумоизоляция 🎧\nУединенное пространство\nХорошее освещение",
                    "assets/skype_room.jpg",
                    4,
                ),
                (
                    "Скайпница 6",
                    "skypbox",
                    3,
                    4,
                    "Вместимость 4 человека 🔊\nПолная шумоизоляция 🎧\nТихая рабочая зона\nОснащена розетками и USB",
                    "assets/skype_room.jpg",
                    4,
                ),
                # Переговорки 3 этажа (3 штуки) - 12 коинов
                (
                    "Переговорка 1",
                    "meeting",
                    3,
                    12,
                    "Комфортная переговорная комната 💼\nВместимость до 8 человек\nПроектор и доска для презентаций\nИдеально для встреч и обсуждений",
                    "assets/meeting_room.jpg",
                    8,
                ),
                (
                    "Переговорка 2",
                    "meeting",
                    3,
                    12,
                    "Комфортная переговорная комната 💼\nВместимость до 8 человек\nПроектор и доска для презентаций\nИдеально для встреч и обсуждений",
                    "assets/meeting_room.jpg",
                    8,
                ),
                (
                    "Переговорка 3",
                    "meeting",
                    3,
                    12,
                    "Комфортная переговорная комната 💼\nВместимость до 8 человек\nПроектор и доска для презентаций\nИдеально для встреч и обсуждений",
                    "assets/meeting_room.jpg",
                    8,
                ),
            ]

            cursor.executemany(
                "INSERT INTO rooms (name, type, floor, price, description, photo_url, max_persons) VALUES (?, ?, ?, ?, ?, ?, ?)",
                floor2_rooms + floor3_rooms,
            )

        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def get_connection() -> sqlite3.Connection:
    """Open a configured SQLite connection; the caller must close it."""
    conn = sqlite3.connect(DB_PATH, timeout=20.0)
    # Включаем WAL режим для лучшей параллельности
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA synchronous=NORMAL;")
    conn.execute("PRAGMA cache_size=10000;")
    return conn


if __name__ == "__main__":
    init_db()
