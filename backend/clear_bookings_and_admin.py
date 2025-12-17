# backend/clear_bookings_and_admin.py
# Скрипт для удаления всех бронирований и пользователя admin
import sqlite3
import os

# Используем тот же путь, что и в database.py
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, 'school21.db')

def clear_bookings_and_admin():
    """Удалить все бронирования и пользователя admin, оставить остальных пользователей"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        print("Очистка базы данных...")
        
        # 1. Удаляем все бронирования
        cursor.execute("DELETE FROM bookings")
        bookings_deleted = cursor.rowcount
        print(f"Удалено бронирований: {bookings_deleted}")
        
        # 2. Удаляем всех пользователей с логином admin (независимо от телефона)
        cursor.execute("""
            DELETE FROM users 
            WHERE LOWER(school_login) = 'admin'
        """)
        admin_deleted = cursor.rowcount
        print(f"Удалено пользователей admin: {admin_deleted}")
        
        # Проверяем, сколько пользователей осталось
        cursor.execute("SELECT COUNT(*) FROM users")
        users_remaining = cursor.fetchone()[0]
        
        # Проверяем, сколько комнат осталось
        cursor.execute("SELECT COUNT(*) FROM rooms")
        rooms_count = cursor.fetchone()[0]
        
        conn.commit()
        print(f"\nOK: База данных очищена!")
        print(f"   Удалено бронирований: {bookings_deleted}")
        print(f"   Удалено пользователей admin: {admin_deleted}")
        print(f"   Пользователей осталось: {users_remaining}")
        print(f"   Комнат осталось: {rooms_count}")
        print("\nВсе бронирования удалены, пользователь admin удален!")
        print("Остальные пользователи и их логины сохранены.")
        
    except Exception as e:
        conn.rollback()
        print(f"ERROR: Ошибка очистки: {e}")
        raise
    finally:
        conn.close()

if __name__ == '__main__':
    # Автоматически очищаем без подтверждения для удобства
    clear_bookings_and_admin()

