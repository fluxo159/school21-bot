# backend/update_admin_phone.py
# Скрипт для обновления телефона админа
import sqlite3
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, 'school21.db')

def update_admin_phone():
    """Обновить телефон админа на +998-00-000-00-11"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        print("Обновление телефона админа...")
        
        # Ищем админа по логину
        cursor.execute("""
            SELECT id, telegram_id, school_login, phone, coins
            FROM users 
            WHERE LOWER(school_login) = 'admin'
        """)
        
        admin = cursor.fetchone()
        
        if not admin:
            print("ERROR: Админ не найден в базе данных!")
            print("Создайте админа через скрипт create_admin_correct.py")
            return
        
        admin_id = admin[0]
        current_phone = admin[3]
        
        print(f"Найден админ:")
        print(f"  ID: {admin_id}")
        print(f"  Логин: {admin[2]}")
        print(f"  Текущий телефон: {current_phone}")
        
        # Обновляем телефон
        cursor.execute("""
            UPDATE users 
            SET phone = ? 
            WHERE id = ?
        """, ('+998-00-000-00-11', admin_id))
        
        conn.commit()
        
        print(f"\nOK: Телефон админа обновлен!")
        print(f"   Старый телефон: {current_phone}")
        print(f"   Новый телефон: +998-00-000-00-11")
        print("\nТеперь можно войти в админку с логином 'admin' и телефоном '+998-00-000-00-11'!")
        
    except Exception as e:
        conn.rollback()
        print(f"ERROR: Ошибка обновления: {e}")
        raise
    finally:
        conn.close()

if __name__ == '__main__':
    update_admin_phone()

