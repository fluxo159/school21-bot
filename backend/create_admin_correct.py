# backend/create_admin_correct.py
# Скрипт для создания админа с правильными данными
import sqlite3
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, 'school21.db')

def create_admin():
    """Создать админа с логином admin и телефоном +998-00-000-00-11"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        # Проверяем, существует ли уже админ с такими данными
        cursor.execute("""
            SELECT id FROM users 
            WHERE LOWER(school_login) = 'admin' AND phone = '+998-00-000-00-11'
        """)
        existing = cursor.fetchone()
        
        if existing:
            print("Админ с логином 'admin' и телефоном '+998-00-000-00-11' уже существует!")
            print(f"ID: {existing[0]}")
            return
        
        # Находим максимальный telegram_id
        cursor.execute('SELECT MAX(telegram_id) FROM users')
        max_telegram_id = cursor.fetchone()[0]
        
        # Создаем админа с telegram_id больше максимального
        admin_telegram_id = (max_telegram_id or 0) + 1000000
        
        # Вставляем админа
        cursor.execute("""
            INSERT INTO users (telegram_id, school_login, phone, coins)
            VALUES (?, ?, ?, ?)
        """, (admin_telegram_id, 'admin', '+998-00-000-00-11', 1000))
        
        conn.commit()
        admin_id = cursor.lastrowid
        
        print("OK: Админ успешно создан!")
        print(f"   ID: {admin_id}")
        print(f"   Telegram ID: {admin_telegram_id}")
        print(f"   Логин: admin")
        print(f"   Телефон: +998-00-000-00-11")
        print(f"   Коины: 1000")
        print("\nТеперь можно войти в админку с этими данными!")
        
    except sqlite3.IntegrityError as e:
        conn.rollback()
        if 'UNIQUE constraint' in str(e):
            print("ERROR: Пользователь с таким telegram_id уже существует. Пробуем другой ID...")
            # Пробуем случайный ID
            import random
            admin_telegram_id = random.randint(1000000000, 9999999999)
            try:
                cursor.execute("""
                    INSERT INTO users (telegram_id, school_login, phone, coins)
                    VALUES (?, ?, ?, ?)
                """, (admin_telegram_id, 'admin', '+998-00-000-00-11', 1000))
                conn.commit()
                admin_id = cursor.lastrowid
                print("OK: Админ создан с альтернативным ID!")
                print(f"   ID: {admin_id}")
                print(f"   Telegram ID: {admin_telegram_id}")
            except Exception as e2:
                print(f"ERROR: Не удалось создать админа: {e2}")
        else:
            print(f"ERROR: Ошибка создания админа: {e}")
    except Exception as e:
        conn.rollback()
        print(f"ERROR: Ошибка создания админа: {e}")
        raise
    finally:
        conn.close()

if __name__ == '__main__':
    create_admin()

