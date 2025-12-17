# backend/clear_all_phones.py
# Скрипт для очистки всех телефонных номеров в базе данных
import sqlite3
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, 'school21.db')

def clear_all_phones():
    """Очистить все телефонные номера у всех пользователей"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        print("Очистка телефонных номеров...")
        
        # Получаем количество пользователей с телефонами
        cursor.execute("SELECT COUNT(*) FROM users WHERE phone IS NOT NULL AND phone != ''")
        users_with_phones = cursor.fetchone()[0]
        
        # Очищаем все телефонные номера
        cursor.execute("UPDATE users SET phone = NULL WHERE phone IS NOT NULL")
        phones_cleared = cursor.rowcount
        
        # Проверяем результат
        cursor.execute("SELECT COUNT(*) FROM users WHERE phone IS NOT NULL AND phone != ''")
        remaining_phones = cursor.fetchone()[0]
        
        # Получаем общее количество пользователей
        cursor.execute("SELECT COUNT(*) FROM users")
        total_users = cursor.fetchone()[0]
        
        conn.commit()
        print(f"\nOK: Телефонные номера очищены!")
        print(f"   Пользователей с телефонами было: {users_with_phones}")
        print(f"   Очищено телефонных номеров: {phones_cleared}")
        print(f"   Осталось телефонов: {remaining_phones}")
        print(f"   Всего пользователей: {total_users}")
        print("\nВсе пользователи должны будут заново указать свои телефонные номера!")
        
    except Exception as e:
        conn.rollback()
        print(f"ERROR: Ошибка очистки: {e}")
        raise
    finally:
        conn.close()

if __name__ == '__main__':
    clear_all_phones()

