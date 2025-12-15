# backend/database.py
import sqlite3
import os
from contextlib import contextmanager

DB_PATH = 'school21.db'

@contextmanager
def get_db_connection():
    """Context manager для безопасной работы с БД"""
    conn = sqlite3.connect(DB_PATH)
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

def init_db():
    """Создаём все таблицы если их нет"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        # Таблица пользователей
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            telegram_id INTEGER UNIQUE NOT NULL,
            school_login TEXT UNIQUE,
            phone TEXT,
            coins INTEGER DEFAULT 1000,  -- Для тестирования установлено 1000 коинов
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        ''')
        
        # Таблица комнат С ПОЛЕМ ЭТАЖА
        cursor.execute('''
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
        ''')
        
        # Таблица бронирований
        cursor.execute('''
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
        ''')
        
        # ДОБАВЛЕНО: Создаем индексы для оптимизации запросов
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_bookings_room_date 
            ON bookings(room_id, date, status)
        ''')
        
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_bookings_user 
            ON bookings(user_id)
        ''')
        
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_users_telegram 
            ON users(telegram_id)
        ''')
        
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_users_school_login 
            ON users(school_login)
        ''')
        
        # Заполняем комнаты если они пустые С ЭТАЖАМИ
        cursor.execute("SELECT COUNT(*) FROM rooms")
        if cursor.fetchone()[0] == 0:
            # 2 ЭТАЖ - скайпницы (3 одинаковые)
            floor2_rooms = [
            ("Скайпница 1", "skypbox", 2, 7, 
             "Вместимость 4 человека 🔊\nПолная шумоизоляция 🎧\nИдеальна для созвонов и работы в тишине\nКомфортное кресло и стол", 
             "https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=400&fit=crop", 4),
            
            ("Скайпница 2", "skypbox", 2, 7, 
             "Вместимость 4 человека 🔊\nПолная шумоизоляция 🎧\nДля важных звонков и фокусировки\nОснащена розетками и USB", 
             "https://images.unsplash.com/photo-1564069114553-7215e1ff1890?w=400&fit=crop", 4),
            
            ("Скайпница 3", "skypbox", 2, 7, 
             "Вместимость 4 человека 🔊\nПолная шумоизоляция 🎧\nУединенное пространство для работы\nХорошее освещение и вентиляция", 
             "https://images.unsplash.com/photo-1497366216548-37526070297c?w=400&fit=crop", 4),
            ]
            
            # 3 ЭТАЖ - 6 скайпниц и 3 переговорки
            floor3_rooms = [
                # Скайпницы 3 этажа (6 штук) - 7 коинов
                ("Скайпница 1", "skypbox", 3, 7, 
                 "Вместимость 4 человека 🔊\nПолная шумоизоляция 🎧\nСтандартная кабинка на 3 этаже\nТихая зона для работы", 
                 "assets/skype_room.jpg", 4),
                
                ("Скайпница 2", "skypbox", 3, 7, 
                 "Вместимость 4 человека 🔊\nПолная шумоизоляция 🎧\nУютная рабочая зона\nДля индивидуальной работы", 
                 "assets/skype_room.jpg", 4),
                
                ("Скайпница 3", "skypbox", 3, 7, 
                 "Вместимость 4 человека 🔊\nПолная шумоизоляция 🎧\nИзолированное пространство\nИдеально для интервью", 
                 "assets/skype_room.jpg", 4),
                
                ("Скайпница 4", "skypbox", 3, 7, 
                 "Вместимость 4 человека 🔊\nПолная шумоизоляция 🎧\nКомфортная кабинка\nДля важных звонков", 
                 "assets/skype_room.jpg", 4),
                
                ("Скайпница 5", "skypbox", 3, 7, 
                 "Вместимость 4 человека 🔊\nПолная шумоизоляция 🎧\nУединенное пространство\nХорошее освещение", 
                 "assets/skype_room.jpg", 4),
                
                ("Скайпница 6", "skypbox", 3, 7, 
                 "Вместимость 4 человека 🔊\nПолная шумоизоляция 🎧\nТихая рабочая зона\nОснащена розетками и USB", 
                 "assets/skype_room.jpg", 4),
                
                # Переговорки 3 этажа (3 штуки) - 12 коинов
                ("Переговорка 1", "meeting", 3, 12, 
                 "Комфортная переговорная комната 💼\nВместимость до 8 человек\nПроектор и доска для презентаций\nИдеально для встреч и обсуждений", 
                 "assets/meeting_room.jpg", 8),
                
                ("Переговорка 2", "meeting", 3, 12, 
                 "Комфортная переговорная комната 💼\nВместимость до 8 человек\nПроектор и доска для презентаций\nИдеально для встреч и обсуждений", 
                 "assets/meeting_room.jpg", 8),
                
                ("Переговорка 3", "meeting", 3, 12, 
                 "Комфортная переговорная комната 💼\nВместимость до 8 человек\nПроектор и доска для презентаций\nИдеально для встреч и обсуждений", 
                 "assets/meeting_room.jpg", 8),
            ]
            
            cursor.executemany(
                "INSERT INTO rooms (name, type, floor, price, description, photo_url, max_persons) VALUES (?, ?, ?, ?, ?, ?, ?)",
                floor2_rooms + floor3_rooms
            )
        
        conn.commit()
        print("✅ База данных инициализирована с этажами!")
    except Exception as e:
        conn.rollback()
        print(f"❌ Ошибка инициализации БД: {e}")
        raise
    finally:
        conn.close()

def get_connection():
    """Получить соединение с БД (deprecated, используйте get_db_connection)"""
    return sqlite3.connect(DB_PATH)

if __name__ == '__main__':
    init_db()