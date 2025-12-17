# backend/reset_users.py
# Скрипт для очистки базы данных пользователей и бронирований
import sqlite3
import os

# Используем тот же путь, что и в database.py
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, 'school21.db')

def reset_users():
    """Очистить всех пользователей и их бронирования, оставить комнаты"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        print("Очистка базы данных пользователей...")
        
        # Сначала удаляем все бронирования (из-за внешних ключей)
        cursor.execute("DELETE FROM bookings")
        bookings_deleted = cursor.rowcount
        print(f"Удалено бронирований: {bookings_deleted}")
        
        # Затем удаляем всех пользователей
        cursor.execute("DELETE FROM users")
        users_deleted = cursor.rowcount
        print(f"Удалено пользователей: {users_deleted}")
        
        # Проверяем, что комнаты остались
        cursor.execute("SELECT COUNT(*) FROM rooms")
        rooms_count = cursor.fetchone()[0]
        
        conn.commit()
        print(f"\nOK: База данных очищена!")
        print(f"   Удалено пользователей: {users_deleted}")
        print(f"   Удалено бронирований: {bookings_deleted}")
        print(f"   Комнат осталось: {rooms_count}")
        print("\nТеперь все пользователи могут зарегистрироваться заново!")
        
    except Exception as e:
        conn.rollback()
        print(f"ERROR: Ошибка очистки: {e}")
        raise
    finally:
        conn.close()

if __name__ == '__main__':
    # Автоматически очищаем без подтверждения для удобства
    reset_users()

