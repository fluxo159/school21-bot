# backend/update_coins.py
# Скрипт для обновления баланса коинов существующих пользователей
import sqlite3

DB_PATH = 'school21.db'

def update_coins():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        # Обновляем баланс всех пользователей, у которых меньше 1000 коинов
        cursor.execute("UPDATE users SET coins = 1000 WHERE coins < 1000")
        updated_count = cursor.rowcount
        
        conn.commit()
        print(f"OK: Обновлено {updated_count} пользователей. Теперь у всех минимум 1000 коинов.")
        
        # Показываем статистику
        cursor.execute("SELECT COUNT(*) FROM users")
        total_users = cursor.fetchone()[0]
        
        cursor.execute("SELECT MIN(coins), MAX(coins), AVG(coins) FROM users")
        stats = cursor.fetchone()
        print(f"Статистика:")
        print(f"   Всего пользователей: {total_users}")
        print(f"   Минимум коинов: {stats[0]}")
        print(f"   Максимум коинов: {stats[1]}")
        print(f"   Среднее коинов: {int(stats[2]) if stats[2] else 0}")
        
    except Exception as e:
        conn.rollback()
        print(f"ERROR: Ошибка обновления: {e}")
        raise
    finally:
        conn.close()

if __name__ == '__main__':
    update_coins()

